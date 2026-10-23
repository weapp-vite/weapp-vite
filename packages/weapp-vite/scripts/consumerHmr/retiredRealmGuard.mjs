import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'

/** 仅允许 classic 入口最前方严格 IIFE 中对退役客户端的无副作用读取。 */
export function isRetiredRealmGuardRead(nodePath) {
  const { node } = nodePath
  if (!nodePath.isMemberExpression() || node.optional || !node.computed
    || node.object.type !== 'Identifier' || node.object.name !== 'globalThis'
    || nodePath.scope.getBinding('globalThis')
    || node.property.type !== 'StringLiteral' || node.property.value !== WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY) {
    return false
  }
  const guard = nodePath.parentPath
  if (!guard.isIfStatement() || guard.node.test !== node || guard.node.alternate
    || guard.node.consequent.type !== 'ReturnStatement' || guard.node.consequent.argument) {
    return false
  }
  const body = guard.parentPath
  if (!body.isBlockStatement() || body.node.body[0] !== guard.node
    || body.node.directives.length !== 1 || body.node.directives[0].value.value !== 'use strict') {
    return false
  }
  const wrapper = body.parentPath
  if (!wrapper.isArrowFunctionExpression() || wrapper.node.body !== body.node
    || wrapper.node.async || wrapper.node.params.length !== 0) {
    return false
  }
  const call = wrapper.parentPath
  if (!call.isCallExpression() || call.node.callee !== wrapper.node
    || call.node.optional || call.node.arguments.length !== 0) {
    return false
  }
  const statement = call.parentPath
  return statement.isExpressionStatement() && statement.node.expression === call.node
    && statement.parentPath.isProgram() && statement.parentPath.node.body[0] === statement.node
}
