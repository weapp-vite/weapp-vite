import type { NodePath, Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import type { ModuleFacts } from './modules'
import * as t from '@weapp-vite/ast/babelTypes'
import { staticName, unwrap } from './modules'
import { isObjectCall } from './ownership'

type Option = { kind: 'absent' | 'unknown' } | { kind: 'value', node: Node }
const absent = { kind: 'absent' } as const
const unknown = { kind: 'unknown' } as const

function isSafeOptionReference(reference: NodePath, allowed: Set<Node>, visiting: Set<Node>): boolean {
  let current = reference
  while (current.parentPath && unwrap(current.parentPath.node) === unwrap(current.node)) {
    current = current.parentPath
  }
  if (allowed.has(unwrap(current.node)) || current.findParent(parent => t.isTSType(parent.node))) {
    return true
  }
  const parent = current.parentPath
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id) && parent.node.init === current.node) {
    // eslint-disable-next-line ts/no-use-before-define -- 别名与引用检查互相递归。
    return isSafeOptionBinding(parent.scope.getBinding(parent.node.id.name), allowed, visiting)
  }
  return false
}

function isSafeOptionBinding(binding: ReturnType<Scope['getBinding']>, allowed: Set<Node>, visiting = new Set<Node>()): boolean {
  if (!binding?.constant || !binding.path.isVariableDeclarator() || !binding.path.parentPath.isVariableDeclaration()
    || binding.path.parentPath.node.kind !== 'const' || binding.path.parentPath.parentPath?.isExportNamedDeclaration()
    || visiting.has(binding.path.node)) {
    return false
  }
  const next = new Set(visiting).add(binding.path.node)
  return binding.referencePaths.every(reference => isSafeOptionReference(reference, allowed, next))
}

function isComponentFactory(node: t.CallExpression, module: ModuleFacts) {
  if (!t.isIdentifier(node.callee)) {
    return false
  }
  const binding = module.scope.getBinding(node.callee.name)
  return binding?.path.isImportSpecifier() && t.isIdentifier(binding.path.node.imported, { name: 'defineComponent' })
    && binding.path.parentPath.isImportDeclaration()
    && ['vue', 'wevu', 'wevu/internal-runtime', 'virtual:weapp-vite/runtime'].includes(binding.path.parentPath.node.source.value)
}

/** assign 会触发 target setter 和 source getter，覆盖顺序不能代替操作数证明。 */
function isSafeMergeOperand(input: Node, module: ModuleFacts, visiting: Set<Node>): boolean {
  const node = unwrap(input)
  if (visiting.has(node)) {
    return false
  }
  const next = new Set(visiting).add(node)
  if (t.isIdentifier(node)) {
    const binding = module.scope.getBinding(node.name)
    return isSafeOptionBinding(binding, next) && Boolean(binding?.path.isVariableDeclarator() && binding.path.node.init
      && isSafeMergeOperand(binding.path.node.init, module, next))
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every((property) => {
      if (t.isSpreadElement(property)) {
        return isSafeMergeOperand(property.argument, module, next)
      }
      const key = staticName(property.key, property.computed)
      return key !== undefined && key !== '__proto__' && (t.isObjectProperty(property) || property.kind === 'method')
    })
  }
  if (t.isCallExpression(node)) {
    if (isComponentFactory(node, module) && node.arguments.length === 1 && t.isExpression(node.arguments[0])) {
      return isSafeMergeOperand(node.arguments[0], module, next)
    }
    if (isObjectCall(node, module.scope, 'assign')) {
      return node.arguments.every(argument => t.isExpression(argument) && isSafeMergeOperand(argument, module, next))
    }
  }
  return false
}

/** 只展开已知的组件包装和合并形态，不把任意函数参数猜成组件选项。 */
export function findCompiledOption(input: Node, name: string, module: ModuleFacts, visiting = new Set<Node>()): Option {
  const node = unwrap(input)
  if (visiting.has(node)) {
    return unknown
  }
  const next = new Set(visiting).add(node)
  if (t.isIdentifier(node)) {
    const binding = module.scope.getBinding(node.name)
    return isSafeOptionBinding(binding, next) && binding?.path.isVariableDeclarator() && binding.path.node.init
      ? findCompiledOption(binding.path.node.init, name, module, next)
      : unknown
  }
  if (t.isObjectExpression(node)) {
    for (const property of [...node.properties].reverse()) {
      if (t.isSpreadElement(property)) {
        const inherited = findCompiledOption(property.argument, name, module, next)
        if (inherited.kind !== 'absent') {
          return inherited
        }
        continue
      }
      const key = staticName(property.key, property.computed)
      if (key === undefined || key === '__proto__') {
        return unknown
      }
      if (key === name) {
        return t.isObjectProperty(property) || property.kind === 'method'
          ? { kind: 'value', node: t.isObjectProperty(property) ? property.value : property }
          : unknown
      }
    }
    return absent
  }
  if (t.isCallExpression(node)) {
    if (isComponentFactory(node, module) && node.arguments.length === 1 && t.isExpression(node.arguments[0])) {
      return findCompiledOption(node.arguments[0], name, module, next)
    }
    if (isObjectCall(node, module.scope, 'assign')) {
      if (!node.arguments.every(argument => t.isExpression(argument) && isSafeMergeOperand(argument, module, next))) {
        return unknown
      }
      for (const argument of [...node.arguments].reverse()) {
        const option = t.isExpression(argument) ? findCompiledOption(argument, name, module, next) : unknown
        if (option.kind !== 'absent') {
          return option
        }
      }
      return absent
    }
  }
  return unknown
}

export function excludePropsObjectAliases(keys: string[], setup: Node | undefined) {
  if (!setup || !(t.isObjectMethod(setup) || t.isFunctionExpression(setup) || t.isArrowFunctionExpression(setup))
    || !t.isIdentifier(setup.params[0]) || !t.isBlockStatement(setup.body)) {
    return keys
  }
  const aliases = new Set<string>()
  for (const statement of setup.body.body) {
    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (t.isIdentifier(declaration.id) && t.isIdentifier(declaration.init, { name: setup.params[0].name })) {
          aliases.add(declaration.id.name)
        }
      }
    }
  }
  return keys.filter(key => !aliases.has(key))
}
