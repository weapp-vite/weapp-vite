import type { NodePath, Scope } from '@weapp-vite/ast/babelTraverse'
import type { File, Node } from '@weapp-vite/ast/babelTypes'
import type { Value } from './values'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { prepareScriptScopes } from './scopes'
import { isCompilerMacro, isPrimitive, isSafeApi, propertyName, runtimeModule } from './values'

export interface ScriptFacts {
  required: boolean
  imports: Set<string>
  exports: Map<string, Value | undefined>
}

function isUnusedAlias(reference: NodePath) {
  let expression = reference
  while (expression.parentPath && (expression.parentPath.isTSAsExpression() || expression.parentPath.isTSNonNullExpression() || expression.parentPath.isTSTypeAssertion() || expression.parentPath.isTSSatisfiesExpression())) {
    expression = expression.parentPath
  }
  const declaration = expression.parentPath
  if (!declaration?.isVariableDeclarator() || declaration.node.init !== expression.node || !t.isIdentifier(declaration.node.id) || declaration.parentPath.parentPath?.isExportDeclaration()) {
    return false
  }
  const binding = declaration.scope.getBinding(declaration.node.id.name)
  return Boolean(binding && binding.referencePaths.every(p => p.findParent(parent => t.isTSType(parent.node))))
}

/** 仅证明已知调用、普通字段和静态绑定；未知读取及隐式执行必须保留上下文协议。 */
export async function analyzeScript(source: string | File, component = false, setupSource?: string, expressions?: string, loadModule?: (source: string) => Promise<ScriptFacts | undefined>): Promise<ScriptFacts> {
  const facts: ScriptFacts = { required: false, imports: new Set(), exports: new Map() }
  try {
    const modules = new Map<string, ScriptFacts>()
    const { script, setup, template, values, observedFunctions, scriptScope } = prepareScriptScopes(source, component, setupSource, expressions, (source, name) => modules.get(source)?.exports.get(name))
    if (loadModule) {
      for (const ast of [script, setup]) {
        for (const statement of ast?.program.body ?? []) {
          if ((t.isImportDeclaration(statement) && statement.specifiers.length > 0 && statement.specifiers.every(specifier => t.isImportSpecifier(specifier) && specifier.importKind === 'type'))
            || (t.isExportNamedDeclaration(statement) && statement.specifiers.length > 0 && statement.specifiers.every(specifier => t.isExportSpecifier(specifier) && specifier.exportKind === 'type'))) {
            continue
          }
          const source = (t.isImportDeclaration(statement) && statement.importKind !== 'type') || ((t.isExportNamedDeclaration(statement) || t.isExportAllDeclaration(statement)) && statement.exportKind !== 'type')
            ? statement.source?.value
            : undefined
          if (source && !runtimeModule(source) && !source.endsWith('.vue') && !modules.has(source)) {
            const module = await loadModule(source)
            if (module) {
              modules.set(source, module)
              facts.required ||= module.required
            }
          }
        }
      }
    }
    const { resolve: resolveValue, member, safeData } = values
    const inspectCallback = (value: Value | undefined) => {
      if (value?.kind === 'module') {
        facts.imports.add(value.source)
      }
      else if (!value || value.kind !== 'local' || !t.isFunction(value.node)) {
        facts.required = true
      }
    }
    const inspectOptions = (node: Node | undefined, scope: Scope) => {
      if (!node) {
        return
      }
      let value = resolveValue(node, scope)
      if (value?.kind === 'local' && t.isFunction(value.node)) {
        value = values.functionReturn(value)
      }
      if (value?.kind !== 'local' || !t.isObjectExpression(value.node)) {
        facts.required = true
        return
      }
      for (const property of value.node.properties) {
        if (t.isSpreadElement(property) || property.computed) {
          facts.required = true
          continue
        }
        const name = propertyName(property.key, false)
        if (name === 'provide' || name === 'inject' || name === 'mixins' || name === 'extends' || name === 'render') {
          facts.required = true
        }
        if (name === 'components' && (!t.isObjectProperty(property) || !t.isObjectExpression(property.value))) {
          facts.required = true
        }
        if (name === 'setup') {
          inspectCallback(member(value, 'setup'))
        }
      }
    }
    const inspectCall = (callee: Node, args: Node[], scope: Scope) => {
      const value = resolveValue(callee, scope)
      if (value?.kind !== 'api') {
        inspectCallback(value)
        // 参数可能在本地函数或依赖函数中被读取、解构或隐式转换。
        facts.required ||= args.some(argument => !safeData(resolveValue(argument, scope)))
        return
      }
      facts.required ||= !isSafeApi(value.name)
      if (value.name === 'defineOptions' || value.name === 'defineComponent') {
        inspectOptions(args[0], scope)
        return
      }
      if (isCompilerMacro(value.name)) {
        return
      }
      const first = args[0] && resolveValue(args[0], scope)
      facts.required ||= args.some(argument => !safeData(resolveValue(argument, scope)))
      if (value.name === 'computed') {
        if (first?.kind === 'local' && t.isObjectExpression(first.node)) {
          inspectCallback(member(first, 'get'))
          const setter = member(first, 'set')
          if (setter) {
            inspectCallback(setter)
          }
        }
        else {
          inspectCallback(first)
        }
      }
      else if (value.name === 'toRef' && args.length > 1) {
        facts.required ||= !safeData(member(first, values.key(args[1]!, true, scope)))
      }
      else if ((value.name === 'toValue' || value.name === 'toRef') && first?.kind === 'local' && t.isFunction(first.node)) {
        inspectCallback(first)
      }
    }
    const inspectExportValue = (node: Node, scope: Scope) => {
      const value = resolveValue(node, scope)
      if (!value || (value.kind === 'api' && !isSafeApi(value.name))) {
        facts.required = true
      }
      else if (value.kind === 'local' && !(t.isFunction(value.node) || t.isLiteral(value.node) || t.isObjectExpression(value.node) || t.isArrayExpression(value.node))) {
        facts.required = true
      }
    }
    const inspectPattern = (pattern: Node, value: Value | undefined) => {
      if (t.isObjectPattern(pattern)) {
        for (const property of pattern.properties) {
          if (!t.isObjectProperty(property)) {
            facts.required = true
            continue
          }
          const field = member(value, propertyName(property.key, property.computed))
          facts.required ||= !field
          inspectPattern(property.value, field)
        }
      }
      else if (t.isArrayPattern(pattern)) {
        // 数组解构调用迭代器，只有当前源码创建的数组能够证明其来源。
        facts.required ||= value?.kind !== 'local' || !t.isArrayExpression(value.node)
        pattern.elements.forEach((element, index) => {
          if (element) {
            inspectPattern(element, member(value, String(index)))
          }
        })
      }
      else if (t.isRestElement(pattern)) {
        facts.required = true
      }
    }
    // 先解析模板引用，避免把仅由模板调用的函数误判为未使用。
    for (const ast of [template, setup, script]) {
      if (!ast) {
        continue
      }
      traverse(ast, {
        enter(p) {
          if (t.isTSType(p.node) || t.isTSInterfaceDeclaration(p.node) || t.isTSTypeAliasDeclaration(p.node) || t.isTSDeclareFunction(p.node)) {
            p.skip()
          }
          if (p.isFunctionDeclaration() && p.node.id && !observedFunctions.has(p.node) && !p.parentPath.isExportDeclaration() && !p.parentPath.scope.getBinding(p.node.id.name)?.referenced) {
            p.skip()
          }
          if ((p.isFunctionExpression() || p.isArrowFunctionExpression()) && !observedFunctions.has(p.node) && p.parentPath.isVariableDeclarator()) {
            const declarator = p.parentPath
            if (t.isIdentifier(declarator.node.id) && !declarator.scope.getBinding(declarator.node.id.name)?.referenced && !declarator.parentPath.parentPath?.isExportDeclaration()) {
              p.skip()
            }
          }
        },
        ImportDeclaration(p) {
          if (p.node.importKind === 'type' || (p.node.specifiers.length && p.node.specifiers.every(s => t.isImportSpecifier(s) && s.importKind === 'type'))) {
            p.skip()
            return
          }
          const source = p.node.source.value
          if (component && source.endsWith('.vue') && p.node.specifiers.length > 0 && p.node.specifiers.every(s => !p.scope.getBinding(s.local.name)?.referenced)) {
            return
          }
          const onlyMacros = p.node.specifiers.length > 0 && p.node.specifiers.every(s => t.isImportSpecifier(s) && isCompilerMacro(propertyName(s.imported, false)!))
          if (!runtimeModule(source) && !((source === 'weapp-vite' || source === 'wevu/router' || source === 'wevu/dev/router') && onlyMacros)) {
            facts.imports.add(source)
          }
        },
        ReferencedIdentifier(p) {
          const value = resolveValue(p.node, p.scope)
          if ((!value && p.isIdentifier() && !p.scope.getBinding(p.node.name)) || (value?.kind === 'api' && value.name !== '*' && !isSafeApi(value.name) && !isUnusedAlias(p))) {
            facts.required = true
          }
        },
        'MemberExpression|OptionalMemberExpression': function (p) {
          const value = resolveValue(p.node, p.scope)
          if (!value || (value.kind === 'api' && !isSafeApi(value.name) && !isUnusedAlias(p))) {
            facts.required = true
          }
        },
        Function(p) {
          // 异步返回的 thenable 吸收与生成器恢复均超出同步调用证明范围。
          facts.required ||= Boolean(p.node.async || p.node.generator)
          for (const parameter of p.node.params) {
            inspectPattern(parameter, undefined)
          }
        },
        'ObjectProperty|ObjectMethod': function (p) {
          const node = p.node
          if ((t.isObjectProperty(node) || t.isObjectMethod(node)) && node.computed) {
            facts.required ||= !isPrimitive(resolveValue(node.key, p.scope))
          }
        },
        VariableDeclarator(p) {
          if (p.node.init && !t.isIdentifier(p.node.id)) {
            inspectPattern(p.node.id, resolveValue(p.node.init, p.scope))
          }
        },
        AssignmentExpression(p) {
          facts.required ||= !safeData(resolveValue(p.node.right, p.scope))
          if (t.isPattern(p.node.left)) {
            inspectPattern(p.node.left, resolveValue(p.node.right, p.scope))
          }
          if (p.node.operator !== '=' || t.isMemberExpression(p.node.left)) {
            facts.required ||= !isPrimitive(resolveValue(p.node.left, p.scope)) || !isPrimitive(resolveValue(p.node.right, p.scope))
          }
        },
        UpdateExpression(p) {
          facts.required ||= !isPrimitive(resolveValue(p.node.argument, p.scope))
        },
        UnaryExpression(p) {
          if (p.node.operator === 'delete' || (['+', '-', '~'].includes(p.node.operator) && !isPrimitive(resolveValue(p.node.argument, p.scope)))) {
            facts.required = true
          }
        },
        BinaryExpression(p) {
          if (p.node.operator !== '===' && p.node.operator !== '!==') {
            facts.required ||= !isPrimitive(resolveValue(p.node.left, p.scope)) || !isPrimitive(resolveValue(p.node.right, p.scope))
          }
        },
        TemplateLiteral(p) {
          facts.required ||= p.node.expressions.some(expression => !isPrimitive(resolveValue(expression, p.scope)))
        },
        CallExpression(p) {
          const { callee, arguments: args } = p.node
          if ((t.isImport(callee) || (t.isIdentifier(callee, { name: 'require' }) && !p.scope.hasBinding('require'))) && t.isStringLiteral(args[0])) {
            facts.imports.add(args[0].value)
          }
          inspectCall(callee, args, p.scope)
        },
        OptionalCallExpression(p) {
          inspectCall(p.node.callee, p.node.arguments, p.scope)
        },
        ExportNamedDeclaration(p) {
          if (p.node.exportKind === 'type' || (p.node.specifiers.length > 0 && p.node.specifiers.every(s => t.isExportSpecifier(s) && s.exportKind === 'type'))) {
            p.skip()
            return
          }
          if (p.node.source) {
            if (runtimeModule(p.node.source.value)) {
              facts.required ||= p.node.specifiers.some(s => !t.isExportSpecifier(s) || (s.exportKind !== 'type' && !isSafeApi(propertyName(s.local, false)!)))
            }
            else {
              facts.imports.add(p.node.source.value)
            }
          }
          else if (!component) {
            const declaration = p.node.declaration
            if (t.isVariableDeclaration(declaration)) {
              for (const item of declaration.declarations) {
                if (item.init) {
                  inspectExportValue(item.init, p.scope)
                }
              }
            }
            for (const specifier of p.node.specifiers) {
              if (t.isExportSpecifier(specifier) && specifier.exportKind !== 'type') {
                inspectExportValue(specifier.local, p.scope)
              }
            }
          }
        },
        ExportAllDeclaration(p) {
          if (p.node.exportKind !== 'type') {
            if (runtimeModule(p.node.source.value)) {
              facts.required = true
            }
            else {
              facts.imports.add(p.node.source.value)
            }
          }
        },
        ExportDefaultDeclaration(p) {
          if (component) {
            if (t.isCallExpression(p.node.declaration)) {
              const factory = resolveValue(p.node.declaration.callee, p.scope)
              if (factory?.kind !== 'api' || factory.name !== 'defineComponent') {
                facts.required = true
              }
            }
            else {
              inspectOptions(p.node.declaration, p.scope)
            }
          }
          else {
            inspectExportValue(p.node.declaration, p.scope)
          }
        },
        'NewExpression|TaggedTemplateExpression|ImportExpression|JSXElement|JSXFragment|Class|Decorator|SpreadElement|TSImportEqualsDeclaration|TSExportAssignment|ForOfStatement|ForInStatement|AwaitExpression|YieldExpression': function (p) {
          facts.required = true
          if (p.isImportExpression() && t.isStringLiteral(p.node.source)) {
            facts.imports.add(p.node.source.value)
          }
        },
      })
    }
    if (!component) {
      for (const statement of script.program.body) {
        if (t.isExportDefaultDeclaration(statement)) {
          facts.exports.set('default', resolveValue(statement.declaration, scriptScope))
        }
        else if (t.isExportNamedDeclaration(statement) && statement.exportKind !== 'type') {
          if (statement.declaration) {
            for (const name of Object.keys(t.getBindingIdentifiers(statement.declaration))) {
              facts.exports.set(name, resolveValue(t.identifier(name), scriptScope))
            }
          }
          for (const specifier of statement.specifiers) {
            if (t.isExportSpecifier(specifier) && specifier.exportKind !== 'type') {
              facts.exports.set(propertyName(specifier.exported, false)!, statement.source
                ? values.imported(statement.source.value, propertyName(specifier.local, false)!)
                : resolveValue(specifier.local, scriptScope))
            }
          }
        }
      }
      const explicitExports = new Set(facts.exports.keys())
      for (const statement of script.program.body) {
        if (t.isExportAllDeclaration(statement) && statement.exportKind !== 'type') {
          for (const [name, value] of modules.get(statement.source.value)?.exports ?? []) {
            if (name !== 'default' && !explicitExports.has(name)) {
              // 多个星号导出的同名值未证明同源，不能选择其中一个冒充实际绑定。
              facts.exports.set(name, facts.exports.has(name) ? undefined : value)
            }
          }
        }
      }
    }
  }
  catch {
    facts.required = true
  }
  return facts
}
