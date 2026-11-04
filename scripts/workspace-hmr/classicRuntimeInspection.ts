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

function nullishValue(node: Node, scope: Scope) {
  if (node.type === 'NullLiteral') {
    return 1
  }
  if ((node.type === 'UnaryExpression' && node.operator === 'void' && node.argument.type === 'NumericLiteral')
    || (node.type === 'Identifier' && node.name === 'undefined' && !scope.hasBinding('undefined'))) {
    return 2
  }
}

function sameReference(node: Node, scope: Scope, subject: NodePath) {
  return node.type === 'Identifier' && subject.isIdentifier() && node.name === subject.node.name
    && scope.getBinding(node.name) === subject.scope.getBinding(subject.node.name)
}

/** 只合并短路路径上必然执行的空值检查；重新赋值会作废此前值的证明。 */
function guardSteps(node: Node, scope: Scope, subject: NodePath, truthy: boolean): { excluded: number, reset: boolean }[] | undefined {
  if (node.type === 'LogicalExpression' && node.operator === (truthy ? '&&' : '||')) {
    const left = guardSteps(node.left, scope, subject, truthy)
    const right = guardSteps(node.right, scope, subject, truthy)
    return left && right ? [...left, ...right] : undefined
  }
  if (node.type !== 'BinaryExpression' || !['===', '!==', '==', '!='].includes(node.operator)
    || node.operator.startsWith('!') !== truthy) {
    return undefined
  }
  const left = nullishValue(node.left, scope)
  const right = nullishValue(node.right, scope)
  const value = right ? node.left : left ? node.right : undefined
  if (!value) {
    return undefined
  }
  const reset = value.type === 'AssignmentExpression' && value.operator === '='
  if (!sameReference(reset ? value.left : value, scope, subject)) {
    return undefined
  }
  return [{ excluded: node.operator.length === 2 ? 3 : (right ?? left)!, reset }]
}

function excludesNullish(node: Node, scope: Scope, subject: NodePath, truthy: boolean) {
  const steps = guardSteps(node, scope, subject, truthy)
  let excluded = 0
  for (const step of steps ?? []) {
    excluded = (step.reset ? 0 : excluded) | step.excluded
  }
  return excluded === 3
}

/** 识别编译器降低的可选链，不把重复调用、单边检查或带副作用的前缀当作保护。 */
function hasLoweredOptionalGuard(reference: NodePath) {
  const subject = reference.get('object') as NodePath
  if (!subject.isIdentifier()) {
    return false
  }
  let current = reference
  while (current.parentPath) {
    const parent = current.parentPath
    if (parent.isLogicalExpression()) {
      if (parent.node.right === current.node) {
        return excludesNullish(parent.node.left, parent.scope, subject, parent.node.operator === '&&')
      }
    }
    else if (parent.isConditionalExpression()) {
      if (parent.node.test !== current.node) {
        return excludesNullish(parent.node.test, parent.scope, subject, parent.node.consequent === current.node)
      }
    }
    else if ((parent.isAssignmentExpression({ operator: '=' }) && parent.node.right === current.node && parent.node.left.type === 'Identifier')
      || ((parent.isMemberExpression() || parent.isOptionalMemberExpression()) && parent.node.object === current.node)
      || ((parent.isCallExpression() || parent.isOptionalCallExpression()) && parent.node.callee === current.node)
      || (parent.isUnaryExpression() && parent.node.operator !== 'delete')
      || (parent.isBinaryExpression() && nullishValue(parent.node.left === current.node ? parent.node.right : parent.node.left, parent.scope))) {
      // 这些外壳在读取当前值之前不会求值其他有副作用的表达式。
    }
    else {
      return false
    }
    current = parent
  }
  return false
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
    if ((member?.isConditionalExpression() && member.node.test !== current.node)
      || member?.isLogicalExpression()
      || (member?.isSequenceExpression() && member.node.expressions.at(-1) === current.node)) {
      pending.push(member)
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
      if ((parent.isAssignmentExpression() && parent.node.left === nodePath.node)
        || parent.isUpdateExpression()
        || parent.isUnaryExpression({ operator: 'delete' })
        || (!(nodePath.isOptionalMemberExpression() && nodePath.node.optional) && !hasLoweredOptionalGuard(nodePath))) {
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
