/* eslint-disable ts/no-use-before-define -- 递归表达式解释器的求值 helper 会互相调用。 */
import { parseExpression } from '@babel/parser'

type ExpressionNode = Record<string, any>

const expressionCache = new Map<string, ExpressionNode | null>()
const BLOCKED_MEMBER_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const NUMERIC_DOT_PATH_RE = /\.(\d+)(?=[.[\s,}\]]|$)/g

function isMustacheOnly(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') && !trimmed.includes('{{', 2)
}

function unwrapMustacheExpression(expression: string) {
  const normalized = expression.trim()
  if (isMustacheOnly(normalized)) {
    return normalized.slice(2, -2).trim()
  }
  return normalized
}

function parseTemplateExpression(expression: string) {
  const normalized = expression.replace(NUMERIC_DOT_PATH_RE, '[$1]')
  if (expressionCache.has(normalized)) {
    return expressionCache.get(normalized) ?? null
  }
  let parsed: ExpressionNode | null = null
  try {
    parsed = parseExpression(normalized) as unknown as ExpressionNode
  }
  catch {
    parsed = null
  }
  expressionCache.set(normalized, parsed)
  return parsed
}

function resolveIdentifier(source: Record<string, any>, name: string) {
  if (name === 'undefined') {
    return undefined
  }
  if (name === 'NaN') {
    return Number.NaN
  }
  if (name === 'Infinity') {
    return Number.POSITIVE_INFINITY
  }
  return source[name]
}

function resolveMemberKey(node: ExpressionNode, source: Record<string, any>) {
  if (node.computed) {
    return evaluateExpressionNode(node.property, source)
  }
  return node.property?.name
}

function readMemberValue(node: ExpressionNode, source: Record<string, any>) {
  const target = evaluateExpressionNode(node.object, source)
  if (target == null) {
    return undefined
  }
  const key = resolveMemberKey(node, source)
  if ((typeof key !== 'string' && typeof key !== 'number') || BLOCKED_MEMBER_KEYS.has(String(key))) {
    return undefined
  }
  return target[key]
}

function evaluateUnaryExpression(node: ExpressionNode, source: Record<string, any>) {
  const value = evaluateExpressionNode(node.argument, source)
  if (node.operator === '!') {
    return !value
  }
  if (node.operator === '+') {
    return Number(value)
  }
  if (node.operator === '-') {
    return -Number(value)
  }
  if (node.operator === '~') {
    return ~Number(value)
  }
  if (node.operator === 'typeof') {
    return typeof value
  }
  if (node.operator === 'void') {
    return undefined
  }
  return undefined
}

function evaluateBinaryExpression(node: ExpressionNode, source: Record<string, any>) {
  const left = evaluateExpressionNode(node.left, source)
  const right = evaluateExpressionNode(node.right, source)
  switch (node.operator) {
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '==':
      // eslint-disable-next-line eqeqeq -- WXML preserves JavaScript abstract equality semantics.
      return left == right
    case '!=':
      // eslint-disable-next-line eqeqeq -- WXML preserves JavaScript abstract equality semantics.
      return left != right
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    case '+':
      return left + right
    case '-':
      return Number(left) - Number(right)
    case '*':
      return Number(left) * Number(right)
    case '/':
      return Number(left) / Number(right)
    case '%':
      return Number(left) % Number(right)
    case '**':
      return Number(left) ** Number(right)
    case '|':
      return Number(left) | Number(right)
    case '&':
      return Number(left) & Number(right)
    case '^':
      return Number(left) ^ Number(right)
    case '<<':
      return Number(left) << Number(right)
    case '>>':
      return Number(left) >> Number(right)
    case '>>>':
      return Number(left) >>> Number(right)
    case 'in':
      return right != null && (typeof right === 'object' || typeof right === 'function')
        ? left in right
        : false
    default:
      return undefined
  }
}

function evaluateObjectExpression(node: ExpressionNode, source: Record<string, any>) {
  const result: Record<string, any> = {}
  for (const property of node.properties ?? []) {
    if (property.type === 'SpreadElement') {
      const spreadValue = evaluateExpressionNode(property.argument, source)
      if (spreadValue && typeof spreadValue === 'object') {
        Object.assign(result, spreadValue)
      }
      continue
    }
    if (property.type !== 'ObjectProperty') {
      continue
    }
    const key = property.computed
      ? evaluateExpressionNode(property.key, source)
      : property.key?.name ?? property.key?.value
    if ((typeof key !== 'string' && typeof key !== 'number') || BLOCKED_MEMBER_KEYS.has(String(key))) {
      continue
    }
    result[key] = evaluateExpressionNode(property.value, source)
  }
  return result
}

function evaluateTemplateLiteral(node: ExpressionNode, source: Record<string, any>) {
  let result = ''
  for (let index = 0; index < node.quasis.length; index += 1) {
    result += node.quasis[index]?.value?.cooked ?? ''
    if (index < node.expressions.length) {
      result += String(evaluateExpressionNode(node.expressions[index], source) ?? '')
    }
  }
  return result
}

function evaluateExpressionNode(node: ExpressionNode | null | undefined, source: Record<string, any>): any {
  if (!node) {
    return undefined
  }
  switch (node.type) {
    case 'Identifier':
      return resolveIdentifier(source, node.name)
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return readMemberValue(node, source)
    case 'UnaryExpression':
      return evaluateUnaryExpression(node, source)
    case 'BinaryExpression':
      return evaluateBinaryExpression(node, source)
    case 'LogicalExpression': {
      const left = evaluateExpressionNode(node.left, source)
      if (node.operator === '&&') {
        return left ? evaluateExpressionNode(node.right, source) : left
      }
      if (node.operator === '||') {
        return left || evaluateExpressionNode(node.right, source)
      }
      if (node.operator === '??') {
        return left ?? evaluateExpressionNode(node.right, source)
      }
      return undefined
    }
    case 'ConditionalExpression':
      return evaluateExpressionNode(node.test, source)
        ? evaluateExpressionNode(node.consequent, source)
        : evaluateExpressionNode(node.alternate, source)
    case 'ArrayExpression':
      return node.elements.map((item: ExpressionNode | null) => evaluateExpressionNode(item, source))
    case 'ObjectExpression':
      return evaluateObjectExpression(node, source)
    case 'TemplateLiteral':
      return evaluateTemplateLiteral(node, source)
    case 'SequenceExpression':
      return node.expressions.reduce((_value: unknown, item: ExpressionNode) => evaluateExpressionNode(item, source), undefined)
    default:
      return undefined
  }
}

export function resolveTemplateExpression(source: Record<string, any>, expression: string): unknown {
  const normalized = unwrapMustacheExpression(expression)
  if (!normalized) {
    return undefined
  }
  const parsed = parseTemplateExpression(normalized)
  return evaluateExpressionNode(parsed, source)
}
