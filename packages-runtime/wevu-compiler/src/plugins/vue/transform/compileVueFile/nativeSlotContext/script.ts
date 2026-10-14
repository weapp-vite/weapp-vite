import type { NodePath, Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { isWevuRuntimeModuleId } from '../../../../../constants'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../../../../utils/babel'
import { JSON_MACROS } from '../../jsonMacros/parse'
import { unwrapTypeLikeExpression } from '../../scriptComponent'

const pureRuntimeApis: Record<string, true> = {
  ref: true,
  shallowRef: true,
  reactive: true,
  shallowReactive: true,
  readonly: true,
  shallowReadonly: true,
  computed: true,
  isRef: true,
  unref: true,
  toRef: true,
  toRefs: true,
  toValue: true,
  isReactive: true,
  isReadonly: true,
  isProxy: true,
  toRaw: true,
  markRaw: true,
  triggerRef: true,
  isShallow: true,
  defineComponent: true,
}
const compilerMacros: Record<string, true> = {
  defineProps: true,
  defineEmits: true,
  defineExpose: true,
  defineOptions: true,
  defineSlots: true,
  withDefaults: true,
  definePage: true,
  definePageMeta: true,
}

function isCompilerMacro(name: string) {
  return compilerMacros[name] === true || JSON_MACROS.has(name)
}

export interface ScriptFacts {
  required: boolean
  imports: Set<string>
}

type Value
  = | { kind: 'api', name: string }
    | { kind: 'module', source: string, name: string }
    | { kind: 'local', node: Node, scope: Scope }

function runtimeModule(source: string) {
  return source === 'vue' || isWevuRuntimeModuleId(source)
}

function propertyName(node: Node, computed: boolean) {
  return t.isStringLiteral(node) ? node.value : !computed && t.isIdentifier(node) ? node.name : undefined
}

function importedValue(source: string, name: string): Value {
  return runtimeModule(source) || ((source === 'weapp-vite' || source === 'wevu/router' || source === 'wevu/dev/router') && isCompilerMacro(name))
    ? { kind: 'api', name }
    : { kind: 'module', source, name }
}

function memberValue(object: Value | undefined, name: string | undefined): Value | undefined {
  if (!object || name === undefined) {
    return undefined
  }
  if (object.kind === 'api' && object.name === '*') {
    return { kind: 'api', name }
  }
  if (object.kind === 'module' && object.name === '*') {
    return importedValue(object.source, name)
  }
  return undefined
}

function resolveValue(input: Node, scope: Scope, seen = new Set<Node>()): Value | undefined {
  const node = t.isExpression(input) ? unwrapTypeLikeExpression(input) : input
  if (seen.has(node)) {
    return undefined
  }
  seen.add(node)
  if (t.isIdentifier(node)) {
    const binding = scope.getBinding(node.name)
    if (!binding) {
      return isCompilerMacro(node.name) ? { kind: 'api', name: node.name } : undefined
    }
    if (!binding.constant) {
      return undefined
    }
    const declaration = binding.path.node
    if (t.isImportSpecifier(declaration) || t.isImportDefaultSpecifier(declaration) || t.isImportNamespaceSpecifier(declaration)) {
      const parent = binding.path.parent
      if (!t.isImportDeclaration(parent) || parent.importKind === 'type' || (t.isImportSpecifier(declaration) && declaration.importKind === 'type')) {
        return undefined
      }
      const name = t.isImportSpecifier(declaration)
        ? propertyName(declaration.imported, false)!
        : t.isImportDefaultSpecifier(declaration) ? 'default' : '*'
      return importedValue(parent.source.value, name)
    }
    if (t.isVariableDeclarator(declaration) && declaration.init) {
      const value = resolveValue(declaration.init, binding.path.scope, seen)
      if (t.isObjectPattern(declaration.id)) {
        const property = declaration.id.properties.find(item => t.isObjectProperty(item) && t.isIdentifier(item.value, { name: node.name }))
        return t.isObjectProperty(property) ? memberValue(value, propertyName(property.key, property.computed)) : undefined
      }
      return t.isIdentifier(declaration.id) ? value : undefined
    }
    if (t.isFunctionDeclaration(declaration)) {
      return { kind: 'local', node: declaration, scope: binding.path.scope }
    }
    return undefined
  }
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    return memberValue(resolveValue(node.object, scope, seen), propertyName(node.property, node.computed))
  }
  return { kind: 'local', node, scope }
}

function isSafeApi(name: string) {
  return pureRuntimeApis[name] === true || isCompilerMacro(name)
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

/** 仅证明已知调用和静态绑定；未能证明的代码必须保留上下文协议。 */
export function analyzeScript(source: string, component = false): ScriptFacts {
  const facts: ScriptFacts = { required: false, imports: new Set() }
  try {
    const ast = parse(source, BABEL_TS_MODULE_PARSER_OPTIONS)
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
        const body = value.node.body
        if (t.isExpression(body)) {
          value = resolveValue(body, value.scope)
        }
        else if (t.isBlockStatement(body) && body.body.length === 1 && t.isReturnStatement(body.body[0]) && body.body[0].argument) {
          value = resolveValue(body.body[0].argument, value.scope)
        }
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
          if (t.isObjectProperty(property)) {
            inspectCallback(resolveValue(property.value, value.scope))
          }
          else if (property.kind !== 'method') {
            facts.required = true
          }
        }
      }
    }
    function inspectCall(callee: Node, args: Node[], scope: Scope) {
      const value = resolveValue(callee, scope)
      if (value?.kind === 'api') {
        facts.required ||= !isSafeApi(value.name)
        if (value.name === 'defineOptions' || value.name === 'defineComponent') {
          inspectOptions(args[0], scope)
        }
        else if (pureRuntimeApis[value.name] === true) {
          for (const argument of args) {
            if (!resolveValue(argument, scope) && !t.isIdentifier(argument, { name: 'undefined' })) {
              facts.required = true
            }
          }
          if (value.name === 'computed' || value.name === 'toValue' || value.name === 'toRef') {
            const callback = args[0] && resolveValue(args[0], scope)
            if (callback?.kind === 'local' && t.isObjectExpression(callback.node) && value.name === 'computed') {
              for (const property of callback.node.properties) {
                if (t.isObjectProperty(property)) {
                  const method = resolveValue(property.value, callback.scope)
                  if (!method || (method.kind === 'local' && !t.isFunction(method.node))) {
                    facts.required = true
                  }
                }
              }
            }
            else if (callback?.kind === 'local' && !t.isFunction(callback.node) && !t.isLiteral(callback.node)) {
              facts.required = true
            }
          }
        }
      }
      else {
        inspectCallback(value)
      }
    }
    const inspectExportValue = (node: Node, scope: Scope) => {
      const value = resolveValue(node, scope)
      if (!value || (value.kind === 'api' && !isSafeApi(value.name))) {
        facts.required = true
      }
      else if (value.kind === 'local' && !(t.isFunction(value.node) || t.isLiteral(value.node) || t.isObjectExpression(value.node) || t.isArrayExpression(value.node))) {
        // 导出的工厂返回值、全局属性和其他动态值可能是未知的上下文函数。
        facts.required = true
      }
    }
    traverse(ast, {
      enter(p) {
        if (t.isTSType(p.node) || t.isTSInterfaceDeclaration(p.node) || t.isTSTypeAliasDeclaration(p.node) || t.isTSDeclareFunction(p.node)) {
          p.skip()
        }
        if (p.isFunctionDeclaration() && p.node.id && !p.parentPath.isExportDeclaration() && !p.scope.getBinding(p.node.id.name)?.referenced) {
          p.skip()
        }
        if ((p.isFunctionExpression() || p.isArrowFunctionExpression()) && p.parentPath.isVariableDeclarator()) {
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
        if (p.isIdentifier() && (p.node.name === 'module' || p.node.name === 'exports') && !p.scope.hasBinding(p.node.name)) {
          facts.required = true
        }
        const value = resolveValue(p.node, p.scope)
        if (value?.kind === 'api' && value.name !== '*' && !isSafeApi(value.name) && !isUnusedAlias(p)) {
          facts.required = true
        }
      },
      MemberExpression(p) {
        const value = resolveValue(p.node, p.scope)
        if (value?.kind === 'api' && !isSafeApi(value.name) && !isUnusedAlias(p)) {
          facts.required = true
        }
      },
      CallExpression(p) {
        const { callee, arguments: args } = p.node
        if ((t.isImport(callee) || (t.isIdentifier(callee, { name: 'require' }) && !p.scope.hasBinding('require'))) && t.isStringLiteral(args[0])) {
          facts.imports.add(args[0].value)
        }
        inspectCall(p.node.callee, p.node.arguments, p.scope)
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
      'NewExpression|TaggedTemplateExpression|ImportExpression|JSXElement|JSXFragment|Class|Decorator|SpreadElement|TSImportEqualsDeclaration|TSExportAssignment': function (p) {
        facts.required = true
        if (p.isImportExpression() && t.isStringLiteral(p.node.source)) {
          facts.imports.add(p.node.source.value)
        }
      },
    })
  }
  catch {
    facts.required = true
  }
  return facts
}
