/* eslint-disable ts/no-use-before-define -- 递归表达式解释器的求值 helper 会互相调用。 */
import { parseExpression } from '@babel/parser'
import { captureTemplateValueReads, recordTemplateControlRead, recordTemplateDependencies, recordTemplatePropertyRead, recordTemplateSpreadRead, recordTemplateValueRead } from './nativeBindings/reads'
import { resolveWxmlStringLiteral } from './templateExpression/stringLiteral'
import { isTemplateExpression } from './templateInterpolation'
import { callWxsFunction } from './wxs'

type ExpressionNode = Record<string, any>

const expressionCache = new Map<string, ExpressionNode | null>()
const BLOCKED_MEMBER_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const NUMERIC_DOT_PATH_RE = /\.(\d+)(?=[.[\s,}\]]|$)/g

function unwrapMustacheExpression(expression: string) {
  const normalized = expression.trim()
  if (isTemplateExpression(normalized)) {
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
  const value = source[name]
  recordTemplateValueRead(source, value, name)
  return value
}

function resolveMemberKey(node: ExpressionNode, source: Record<string, any>) {
  if (node.computed) {
    return evaluateExpressionNode(node.property, source)
  }
  return node.property?.name
}

function readMemberValue(node: ExpressionNode, source: Record<string, any>) {
  // 构造对象先定位接收者，再消费实际字段；不能提前把兄弟字段都算作依赖。
  const targetRead = captureTemplateValueReads(source, () => evaluateExpressionNode(node.object, source), false)
  const target = targetRead.value
  if (target === null || typeof target !== 'object') {
    recordTemplateDependencies(source, targetRead.source.paths)
  }
  if (target == null) {
    return undefined
  }
  const key = resolveMemberKey(node, source)
  if ((typeof key !== 'string' && typeof key !== 'number') || BLOCKED_MEMBER_KEYS.has(String(key))) {
    return undefined
  }
  const value = target[key]
  recordTemplateValueRead(source, value, key, target)
  return value
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
      const spread = captureTemplateValueReads(source, () => evaluateExpressionNode(property.argument, source))
      if (spread.value && typeof spread.value === 'object') {
        recordTemplateSpreadRead(source, result, spread)
        Object.assign(result, spread.value)
        for (const key of Object.keys(spread.value)) {
          recordTemplatePropertyRead(source, result, key, spread.propertySource(key))
        }
      }
      continue
    }
    if (property.type !== 'ObjectProperty') {
      continue
    }
    const keyRead = captureTemplateValueReads(source, () => property.computed
      ? evaluateExpressionNode(property.key, source)
      : property.key?.type === 'StringLiteral'
        ? resolveWxmlStringLiteral(property.key)
        : property.key?.name ?? property.key?.value)
    const key = keyRead.value
    if ((typeof key !== 'string' && typeof key !== 'number') || BLOCKED_MEMBER_KEYS.has(String(key))) {
      continue
    }
    const value = captureTemplateValueReads(source, () => evaluateExpressionNode(property.value, source))
    result[key] = value.value
    recordTemplatePropertyRead(source, result, key, {
      ...value.source,
      paths: [...value.source.paths, ...keyRead.source.paths],
      controls: [...(value.source.controls ?? []), ...keyRead.source.paths],
    })
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

function evaluateCallExpression(node: ExpressionNode, source: Record<string, any>) {
  const member = node.callee?.type === 'MemberExpression' || node.callee?.type === 'OptionalMemberExpression'
  const receiver = member ? evaluateExpressionNode(node.callee.object, source) : undefined
  const key = member ? resolveMemberKey(node.callee, source) : undefined
  const fn = member
    ? receiver != null && (typeof key === 'string' || typeof key === 'number') && !BLOCKED_MEMBER_KEYS.has(String(key))
      ? receiver[key]
      : undefined
    : evaluateExpressionNode(node.callee, source)
  const args = (node.arguments ?? []).flatMap((argument: ExpressionNode) => argument.type === 'SpreadElement'
    ? evaluateExpressionNode(argument.argument, source)
    : [evaluateExpressionNode(argument, source)])
  return callWxsFunction(fn, receiver, args)
}

function evaluateExpressionNode(node: ExpressionNode | null | undefined, source: Record<string, any>): any {
  if (!node) {
    return undefined
  }
  switch (node.type) {
    case 'Identifier':
      return resolveIdentifier(source, node.name)
    case 'StringLiteral':
      return resolveWxmlStringLiteral(node)
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return readMemberValue(node, source)
    case 'CallExpression':
    case 'OptionalCallExpression':
      return evaluateCallExpression(node, source)
    case 'UnaryExpression':
      return evaluateUnaryExpression(node, source)
    case 'BinaryExpression':
      return evaluateBinaryExpression(node, source)
    case 'LogicalExpression': {
      const left = captureTemplateValueReads(source, () => evaluateExpressionNode(node.left, source))
      const useRight = node.operator === '&&' ? Boolean(left.value) : node.operator === '||' ? !left.value : node.operator === '??' && left.value == null
      const value = useRight ? evaluateExpressionNode(node.right, source) : left.value
      recordTemplateControlRead(source, value, left.source.paths)
      return value
    }
    case 'ConditionalExpression': {
      const condition = captureTemplateValueReads(source, () => evaluateExpressionNode(node.test, source))
      const value = evaluateExpressionNode(condition.value ? node.consequent : node.alternate, source)
      recordTemplateControlRead(source, value, condition.source.paths)
      return value
    }
    case 'ArrayExpression': {
      const result: unknown[] = []
      node.elements.forEach((item: ExpressionNode | null, index: number) => {
        const value = captureTemplateValueReads(source, () => evaluateExpressionNode(item, source))
        recordTemplatePropertyRead(source, result, index, value.source)
        result.push(value.value)
      })
      return result
    }
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
