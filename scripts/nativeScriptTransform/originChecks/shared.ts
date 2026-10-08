import type * as t from '@babel/types'
import { parseExpression } from '@babel/parser'

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Inline origin: ${message}`)
  }
}

export function object(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected object')
  return value as Record<string, unknown>
}

/** 独立诊断解析，不复用上游注册器的 AST 或把额外工作计作热点收益。 */
export function expression(source: string) {
  return parseExpression(source, { sourceType: 'module', plugins: ['typescript'] })
}

export function directCallee(node: t.Node) {
  return node.type === 'Identifier'
    ? node
    : node.type === 'CallExpression' && node.callee.type === 'Identifier'
      ? node.callee
      : undefined
}

export interface CheckedAsset {
  id: string
  expression: string
  parameterNames: { context: string, scope: string, event: string }
  node: t.Expression
  callee?: t.Identifier
}

export function assets(options: unknown): CheckedAsset[] {
  const values = object(options).inlineExpressions
  ensure(Array.isArray(values), 'actual inline assets are missing')
  return values.map((value, index) => {
    const asset = object(value)
    const parameters = object(asset.parameterNames)
    ensure(asset.id === `i${index.toString(36)}` && typeof asset.expression === 'string', 'actual inline asset identity/order differs')
    ensure(['context', 'scope', 'event'].every(key => typeof parameters[key] === 'string' && parameters[key]), 'actual inline parameters are missing')
    const parameterNames = parameters as CheckedAsset['parameterNames']
    ensure(new Set(Object.values(parameterNames)).size === 3, 'actual inline parameters alias each other')
    const node = expression(asset.expression)
    const callee = node.type === 'CallExpression' ? node.callee : undefined
    const member = callee?.type === 'MemberExpression' && !callee.computed
      && callee.object.type === 'Identifier' && callee.object.name === parameterNames.context
      && callee.property.type === 'Identifier'
      ? callee.property
      : undefined
    return { id: asset.id as string, expression: asset.expression, parameterNames, node, callee: member }
  })
}

/** 只忽略解析器位置及原始打印信息，保留全部表达式语义字段。 */
export function semantics(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(semantics)
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['start', 'end', 'loc', 'extra', 'errors', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key))
    .map(([key, child]) => [key, semantics(child)]))
}
