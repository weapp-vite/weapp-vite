import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { File, Node } from '@weapp-vite/ast/babelTypes'
import type { Value, ValueResolver } from './values'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../../../../utils/babel'
import { createValueResolver } from './values'

/** 两个脚本保留独立模块作用域；模板只接收实际暴露的绑定，循环局部变量仍由 Babel 管理。 */
export function prepareScriptScopes(source: string | File, component: boolean, setupSource: string | undefined, expressions: string | undefined, exported: (source: string, name: string) => Value | undefined) {
  const script = typeof source === 'string' ? parse(source, BABEL_TS_MODULE_PARSER_OPTIONS) : source
  const setup = setupSource === undefined ? undefined : parse(setupSource, BABEL_TS_MODULE_PARSER_OPTIONS)
  const template = expressions ? parse(expressions, BABEL_TS_MODULE_PARSER_OPTIONS) : undefined
  const scopes = new WeakMap<Node, Scope>()
  const observedFunctions = new Set<Node>()
  const templateValues = new Map<string, Value | undefined>()
  for (const ast of [script, setup, template]) {
    if (ast) {
      traverse(ast, {
        Program(p) { scopes.set(p.node, p.scope) },
        Function(p) { scopes.set(p.node, p.scope) },
      })
    }
  }
  const scriptScope = scopes.get(script.program)!
  const setupScope = setup && scopes.get(setup.program)!
  const templateScope = template && scopes.get(template.program)!
  const componentExport = script.program.body.find(statement => t.isExportDefaultDeclaration(statement))
  const sharedBindings = new WeakSet<Node>()
  const visitedDeclarations = new WeakSet<Node>()
  for (const root of [scriptScope, setupScope]) {
    if (!root) {
      continue
    }
    const pending = Object.values(root.bindings).filter(binding => t.isExportNamedDeclaration(binding.path.parent)
      || (t.isVariableDeclaration(binding.path.parent) && t.isExportNamedDeclaration(binding.path.parentPath?.parent))
      || binding.referencePaths.some(reference => t.isExportSpecifier(reference.parent)
        && t.isExportNamedDeclaration(reference.parentPath?.parent)
        && !(t.isIdentifier(reference.parent.exported, { name: 'default' }) || t.isStringLiteral(reference.parent.exported, { value: 'default' }))))
    for (const binding of pending) {
      sharedBindings.add(binding.identifier)
    }
    // 声明和后续赋值都可能暴露模块私有值；每个语法节点只沿词法引用扫描一次。
    for (const binding of pending) {
      for (let index = -1; index < binding.constantViolations.length; index++) {
        const declaration = index === -1 ? binding.path : binding.constantViolations[index]!
        if (visitedDeclarations.has(declaration.node)) {
          continue
        }
        visitedDeclarations.add(declaration.node)
        declaration.traverse({
          ReferencedIdentifier(p) {
            if (!p.isIdentifier()) {
              return
            }
            const dependency = p.scope.getBinding(p.node.name)
            if (dependency?.scope === root && !sharedBindings.has(dependency.identifier)) {
              sharedBindings.add(dependency.identifier)
              pending.push(dependency)
            }
          },
        })
      }
    }
  }
  const values: ValueResolver = createValueResolver(scopes, (name, scope): Value | undefined => {
    const root = scope.getProgramParent()
    if (root === setupScope) {
      const binding = scriptScope.getBinding(name)
      const value = binding ? values.resolve(binding.identifier, binding.scope) : undefined
      if (value?.kind === 'local' && t.isFunction(value.node)) {
        observedFunctions.add(value.node)
      }
      return value
    }
    if (root !== templateScope) {
      return undefined
    }
    if (templateValues.has(name)) {
      return templateValues.get(name)
    }
    let value: Value | undefined
    if (setupScope) {
      const binding = setupScope.getBinding(name) ?? scriptScope.getBinding(name)
      value = binding ? values.resolve(binding.identifier, binding.scope) : undefined
    }
    else if (component) {
      const options = componentExport && values.resolve(componentExport.declaration, scriptScope)
      const setupFunction = values.member(options, 'setup')
      value = values.member(values.functionReturn(setupFunction), name)
    }
    if (value?.kind === 'local' && t.isFunction(value.node)) {
      observedFunctions.add(value.node)
    }
    const unwrapped = value?.kind === 'ref' ? value.value : value
    templateValues.set(name, unwrapped)
    return unwrapped
  }, exported, sharedBindings)
  return { script, setup, template, values, observedFunctions, scriptScope }
}
