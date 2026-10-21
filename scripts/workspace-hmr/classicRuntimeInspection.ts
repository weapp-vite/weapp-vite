import type { parse } from '@babel/parser'
import type { NodePath, Scope } from '@babel/traverse'
import type { Node } from '@babel/types'
import traverseModule from '@babel/traverse'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

function resolveKey(node: Node | null | undefined, scope: Scope, seen = new Set<Node>()): string | undefined {
  if (node?.type === 'StringLiteral') {
    return node.value
  }
  if (node?.type !== 'Identifier' || seen.has(node)) {
    return undefined
  }
  seen.add(node)
  const binding = scope.getBinding(node.name)
  if (!binding?.constant || !binding.path.isVariableDeclarator()) {
    return undefined
  }
  return resolveKey(binding.path.node.init, binding.path.scope, seen)
}

function propertyKey(node: { computed?: boolean, property: Node }, scope: Scope) {
  return !node.computed && node.property.type === 'Identifier' ? node.property.name : resolveKey(node.property, scope)
}

function fail(): never {
  throw new Error('Classic fallback output retained an active stateful bridge or generated registration wrapper.')
}

function isRegistrationMethod(method: string | undefined) {
  return method === 'installNative' || method === 'takeNativeDefinitions'
}

function registrationTargetReferences(target: Node, scope: Scope): NodePath[] {
  if (target.type === 'Identifier') {
    return scope.getBinding(target.name)?.referencePaths ?? []
  }
  const references: NodePath[] = []
  if (target.type === 'ObjectPattern') {
    for (const property of target.properties) {
      if (property.type === 'ObjectProperty' && isRegistrationMethod(propertyKey({
        computed: property.computed,
        property: property.key,
      }, scope))) {
        fail()
      }
      if (property.type === 'RestElement') {
        references.push(...registrationTargetReferences(property.argument, scope))
      }
    }
  }
  return references
}

function assertNoRegistrationCall(reference: NodePath) {
  const pending = [reference]
  const seen = new Set<Node>()
  while (pending.length) {
    const current = pending.pop()!
    if (seen.has(current.node)) {
      continue
    }
    seen.add(current.node)
    const member = current.parentPath
    if (member?.isMemberExpression() || member?.isOptionalMemberExpression()) {
      const method = propertyKey(member.node, member.scope)
      if (isRegistrationMethod(method)) {
        fail()
      }
    }
    if (member?.isVariableDeclarator() && member.node.init === current.node) {
      pending.push(...registrationTargetReferences(member.node.id, member.scope))
    }
    if (member?.isAssignmentExpression() && member.node.operator === '=' && member.node.right === current.node) {
      pending.push(...registrationTargetReferences(member.node.left, member.scope), member)
    }
  }
}

/** 保留运行时只读可选能力探针，拒绝安装、必需桥接及其常量别名，避免按项目或打包名称判断。 */
export function inspectClassicEmittedScript(ast: ReturnType<typeof parse>) {
  traverse(ast, {
    'MemberExpression|OptionalMemberExpression': (nodePath) => {
      if (!nodePath.isMemberExpression() && !nodePath.isOptionalMemberExpression()) {
        return
      }
      if (propertyKey(nodePath.node, nodePath.scope) !== WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY) {
        return
      }
      const parent = nodePath.parentPath
      if (!nodePath.isOptionalMemberExpression() || !nodePath.node.optional
        || (parent.isAssignmentExpression() && parent.node.left === nodePath.node)
        || parent.isUnaryExpression({ operator: 'delete' })) {
        fail()
      }
      assertNoRegistrationCall(nodePath)
    },
    ObjectProperty(nodePath) {
      if (nodePath.parentPath.isObjectPattern()
        && (nodePath.node.computed ? resolveKey(nodePath.node.key, nodePath.scope) : nodePath.node.key.type === 'Identifier' ? nodePath.node.key.name : resolveKey(nodePath.node.key, nodePath.scope)) === WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY) {
        fail()
      }
    },
  })
}
