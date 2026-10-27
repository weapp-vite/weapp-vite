import type { NodePath, Scope } from '@weapp-vite/ast/babelTraverse'
import type { Node } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { unwrap } from './modules'

export interface PropsOwnership {
  props?: Node
  setup?: Node
}

export function isObjectCall(node: Node, scope: Scope, name: string): node is t.CallExpression {
  return t.isCallExpression(node) && t.isMemberExpression(node.callee) && !node.callee.computed
    && t.isIdentifier(node.callee.object, { name: 'Object' }) && !scope.getBinding('Object')
    && t.isIdentifier(node.callee.property, { name })
}

function isGeneratedSetupReturn(reference: NodePath, setup: Node | undefined) {
  const property = reference.parentPath
  const object = property?.parentPath
  const declaration = object?.parentPath
  return Boolean(setup && property?.isObjectProperty() && property.node.value === reference.node
    && object?.isObjectExpression() && declaration?.isVariableDeclarator()
    && t.isIdentifier(declaration.node.id, { name: '__returned__' })
    && declaration.findParent(parent => parent.node === setup))
}

function isSafeReference(reference: NodePath, ownership: PropsOwnership, visiting: Set<Node>): boolean {
  let current = reference
  while (current.parentPath && unwrap(current.parentPath.node) === unwrap(current.node)) {
    current = current.parentPath
  }
  if ((ownership.props && unwrap(current.node) === unwrap(ownership.props)) || isGeneratedSetupReturn(current, ownership.setup)) {
    return true
  }
  if (current.findParent(parent => t.isTSType(parent.node))) {
    return true
  }
  const parent = current.parentPath
  if (parent?.isSpreadElement() && (parent.parentPath.isObjectExpression() || parent.parentPath.isArrayExpression())) {
    return true
  }
  if (parent?.isCallExpression()) {
    return (isObjectCall(parent.node, parent.scope, 'freeze') && parent.node.arguments.length === 1)
      || (isObjectCall(parent.node, parent.scope, 'assign') && parent.node.arguments.indexOf(current.node as t.Expression) > 0)
  }
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id) && parent.node.init === current.node) {
    // eslint-disable-next-line ts/no-use-before-define -- 别名与引用检查互相递归。
    return isSafePropsBinding(parent.scope.getBinding(parent.node.id.name), ownership, visiting)
  }
  return false
}

/** const 不代表对象不可变；只接受已知复制、冻结和注册后的编译器交付。 */
export function isSafePropsBinding(binding: ReturnType<Scope['getBinding']>, ownership: PropsOwnership, visiting = new Set<Node>()): boolean {
  if (!binding?.constant || !binding.path.isVariableDeclarator() || !binding.path.parentPath.isVariableDeclaration()
    || binding.path.parentPath.node.kind !== 'const' || binding.path.parentPath.parentPath?.isExportNamedDeclaration()
    || visiting.has(binding.path.node)) {
    return false
  }
  const next = new Set(visiting).add(binding.path.node)
  return binding.referencePaths.every(reference => isSafeReference(reference, ownership, next))
}
