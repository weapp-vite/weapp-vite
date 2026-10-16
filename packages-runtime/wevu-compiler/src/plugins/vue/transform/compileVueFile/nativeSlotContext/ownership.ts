import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import type { ResolveValue, Value } from './values'
import * as t from '@weapp-vite/ast/babelTypes'

/** 模块复合值可跨实例共享；仅保留原始值、同步函数身份和未逃逸工厂的新分配。 */
export function createModuleValueBoundary(isPrimitive: (value: Value | undefined) => boolean, isRuntimeApi: (name: string) => boolean) {
  const opaque: Value = { kind: 'opaque' }
  const importedValues = new WeakMap<Value, Value>()
  const factoryProofs = new WeakMap<Node, boolean>()
  const factoryResolvers = new WeakMap<Scope, Map<ResolveValue, ResolveValue>>()

  function safeFactory(fn: Extract<Value, { kind: 'local' }>) {
    if (!t.isFunction(fn.node) || fn.node.async || fn.node.generator) {
      return false
    }
    const cached = factoryProofs.get(fn.node)
    if (cached !== undefined) {
      return cached
    }
    // 函数递归或相互引用在证明完成前保持未知，不递归展开同一工厂。
    factoryProofs.set(fn.node, false)
    let safe = true
    fn.scope.path.traverse({
      ReferencedIdentifier(p) {
        const value = fn.resolve(p.node, p.scope)
        if (value?.kind === 'opaque' || (!isPrimitive(value)
          && (value?.kind === 'ref' || value?.kind === 'refs' || (value?.kind === 'local' && !t.isFunction(value.node)))
          && value.scope.getFunctionParent() !== fn.scope)) {
          safe = false
          p.stop()
        }
      },
      AssignmentExpression(p) {
        let target: Node = p.node.left
        while (t.isMemberExpression(target) || t.isOptionalMemberExpression(target)) {
          target = target.object
        }
        const binding = t.isIdentifier(target) ? p.scope.getBinding(target.name) : undefined
        if (!binding || binding.scope.getFunctionParent() !== fn.scope) {
          safe = false
          p.stop()
        }
      },
      'CallExpression|OptionalCallExpression': function (p) {
        if (!t.isCallExpression(p.node) && !t.isOptionalCallExpression(p.node)) {
          return
        }
        const callee = fn.resolve(p.node.callee, p.scope)
        if (callee?.kind !== 'api' || !isRuntimeApi(callee.name)) {
          safe = false
          p.stop()
        }
      },
    })
    factoryProofs.set(fn.node, safe)
    return safe
  }

  function imported(value: Value | undefined): Value | undefined {
    if (!value || isPrimitive(value) || value.kind === 'api') {
      return value
    }
    const cached = importedValues.get(value)
    if (cached) {
      return cached
    }
    const result: Value = value.kind === 'local' && t.isFunction(value.node) && safeFactory(value)
      ? { ...value, imported: true }
      : value.kind === 'module' ? { ...value, exported: name => imported(value.exported(name)) } : opaque
    importedValues.set(value, result)
    return result
  }

  function fresh(value: Value | undefined, owner: Scope): Value | undefined {
    if (!value || isPrimitive(value) || value.kind === 'api') {
      return value
    }
    if (value.kind === 'local' && t.isFunction(value.node)) {
      return imported(value)
    }
    if ((value.kind !== 'local' && value.kind !== 'ref' && value.kind !== 'refs') || value.scope.getFunctionParent() !== owner) {
      return opaque
    }
    let resolvers = factoryResolvers.get(owner)
    if (!resolvers) {
      resolvers = new Map()
      factoryResolvers.set(owner, resolvers)
    }
    let resolve = resolvers.get(value.resolve)
    if (!resolve) {
      const original = value.resolve
      resolve = (node, scope) => fresh(original(node, scope), owner)
      resolvers.set(original, resolve)
    }
    return value.kind === 'local' ? { ...value, resolve } : { ...value, resolve, value: fresh(value.value, owner) }
  }

  function factoryReturn(fn: Extract<Value, { kind: 'local' }>, value: Value | undefined): Value | undefined {
    return fn.imported ? fresh(value, fn.scope) : value
  }
  return { imported, factoryReturn }
}
