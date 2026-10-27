import type { Node } from '@weapp-vite/ast/babelTypes'
import type { createPropsModuleResolver, ModuleFacts } from './modules'
import type { PropsOwnership } from './ownership'
import * as t from '@weapp-vite/ast/babelTypes'
import { staticName, unwrap } from './modules'
import { isObjectCall, isSafePropsBinding } from './ownership'

interface PropsShape {
  kind: 'object' | 'array'
  names: Set<string>
  frozen: boolean
}

function constantInitializer(node: Node, module: ModuleFacts) {
  if (!t.isIdentifier(node)) {
    return undefined
  }
  const binding = module.scope.getBinding(node.name)
  if (!binding?.constant || !binding.path.isVariableDeclarator() || !binding.path.parentPath.isVariableDeclaration()
    || binding.path.parentPath.node.kind !== 'const' || !binding.path.node.init) {
    return undefined
  }
  return { binding, node: binding.path.node.init }
}

/** 只证明完整键集合；跨模块复合值还必须能证明已经冻结。 */
export function createPropsShapeAnalyzer(modules: ReturnType<typeof createPropsModuleResolver>, ownership: PropsOwnership) {
  async function primitive(input: Node, module: ModuleFacts, visiting = new Set<Node>()): Promise<string | number | undefined> {
    const node = unwrap(input)
    if (visiting.has(node)) {
      return undefined
    }
    const next = new Set(visiting).add(node)
    if (t.isStringLiteral(node) || t.isNumericLiteral(node)) {
      return node.value
    }
    if (t.isTemplateLiteral(node) && !node.expressions.length) {
      return staticName(node, true)
    }
    const local = constantInitializer(node, module)
    if (local) {
      return primitive(local.node, module, next)
    }
    const imported = await modules.resolveImport(node, module)
    return imported ? primitive(imported.node, imported.module, next) : undefined
  }

  async function analyze(input: Node, module: ModuleFacts, visiting = new Set<Node>()): Promise<PropsShape | undefined> {
    const node = unwrap(input)
    if (visiting.has(node)) {
      return undefined
    }
    const next = new Set(visiting).add(node)
    const local = constantInitializer(node, module)
    if (local) {
      const value = await analyze(local.node, module, next)
      return value && (value.frozen || isSafePropsBinding(local.binding, ownership)) ? value : undefined
    }
    if (t.isIdentifier(node) || t.isMemberExpression(node)) {
      const imported = await modules.resolveImport(node, module)
      const value = imported && await analyze(imported.node, imported.module, next)
      return value?.frozen ? value : undefined
    }
    if (isObjectCall(node, module.scope, 'freeze') && node.arguments.length === 1 && t.isExpression(node.arguments[0])) {
      const value = await analyze(node.arguments[0], module, next)
      return value && { ...value, frozen: true }
    }
    if (isObjectCall(node, module.scope, 'assign')) {
      const first = node.arguments[0] && unwrap(node.arguments[0])
      if (!t.isObjectExpression(first) || first.properties.length) {
        return undefined
      }
      const names = new Set<string>()
      for (const argument of node.arguments.slice(1)) {
        if (!t.isExpression(argument)) {
          return undefined
        }
        const value = await analyze(argument, module, next)
        if (!value || value.kind !== 'object') {
          return undefined
        }
        value.names.forEach(name => names.add(name))
      }
      return { kind: 'object', names, frozen: false }
    }
    if (t.isObjectExpression(node)) {
      const names = new Set<string>()
      for (const property of node.properties) {
        if (t.isSpreadElement(property)) {
          const value = await analyze(property.argument, module, next)
          if (!value || value.kind !== 'object') {
            return undefined
          }
          value.names.forEach(name => names.add(name))
          continue
        }
        // 访问器与方法不作为普通 props 声明，避免隐式执行改变其他声明。
        if (!t.isObjectProperty(property)) {
          return undefined
        }
        const key = property.computed
          ? await primitive(property.key, module, next)
          : staticName(property.key)
        if (key === undefined || key === '__proto__') {
          return undefined
        }
        names.add(String(key))
      }
      return { kind: 'object', names, frozen: false }
    }
    if (t.isArrayExpression(node)) {
      const names = new Set<string>()
      for (const element of node.elements) {
        if (!element) {
          return undefined
        }
        if (t.isSpreadElement(element)) {
          const value = await analyze(element.argument, module, next)
          if (!value || value.kind !== 'array') {
            return undefined
          }
          value.names.forEach(name => names.add(name))
        }
        else {
          const value = await primitive(element, module, next)
          if (typeof value !== 'string') {
            return undefined
          }
          names.add(value)
        }
      }
      return { kind: 'array', names, frozen: false }
    }
  }

  return { analyze }
}
