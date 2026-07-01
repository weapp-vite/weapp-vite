import * as t from '@weapp-vite/ast/babelTypes'
import { recursive as mergeRecursive } from 'merge'
import { hasOwn } from '../../../../utils/object'

function unwrapTsExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSNonNullExpression(node) || t.isTSTypeAssertion(node)) {
    return unwrapTsExpression(node.expression as t.Expression)
  }
  return node
}

export function resolveStaticLiteralValue(node: t.Expression): unknown {
  const normalized = unwrapTsExpression(node)
  if (t.isStringLiteral(normalized) || t.isNumericLiteral(normalized) || t.isBooleanLiteral(normalized)) {
    return normalized.value
  }
  if (t.isNullLiteral(normalized)) {
    return null
  }
  if (
    t.isUnaryExpression(normalized)
    && (normalized.operator === '-' || normalized.operator === '+')
    && t.isNumericLiteral(normalized.argument)
  ) {
    return normalized.operator === '-' ? -normalized.argument.value : normalized.argument.value
  }
  if (t.isArrayExpression(normalized)) {
    const values: unknown[] = []
    for (const element of normalized.elements) {
      if (!element || t.isSpreadElement(element) || !t.isExpression(element)) {
        throw new Error('unsupported static json macro array item')
      }
      values.push(resolveStaticLiteralValue(element))
    }
    return values
  }
  if (t.isObjectExpression(normalized)) {
    const value: Record<string, unknown> = {}
    for (const property of normalized.properties) {
      if (!t.isObjectProperty(property) || property.computed || !t.isExpression(property.value)) {
        throw new Error('unsupported static json macro object property')
      }
      const key = property.key
      const keyName = t.isIdentifier(key)
        ? key.name
        : t.isStringLiteral(key) || t.isNumericLiteral(key)
          ? String(key.value)
          : undefined
      if (!keyName) {
        throw new Error('unsupported static json macro object key')
      }
      value[keyName] = resolveStaticLiteralValue(property.value)
    }
    return value
  }
  throw new Error('unsupported static json macro value')
}

export function resolveStaticJsonMacroConfig(
  macroStatements: any[],
  options?: {
    merge?: (target: Record<string, any>, source: Record<string, any>) => Record<string, any> | void
  },
) {
  let accumulator: Record<string, any> = {}
  for (const statementPath of macroStatements) {
    const callPath = statementPath.get('expression')
    const argPath = callPath.get('arguments.0')
    const arg = argPath?.node
    if (!arg || !t.isExpression(arg)) {
      return undefined
    }
    let next: unknown
    try {
      next = resolveStaticLiteralValue(arg)
    }
    catch {
      return undefined
    }
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return undefined
    }
    if (hasOwn(next, '$schema')) {
      delete (next as Record<string, unknown>).$schema
    }
    if (options?.merge) {
      const merged = options.merge(accumulator, next as Record<string, any>)
      if (merged && typeof merged === 'object' && !Array.isArray(merged)) {
        accumulator = merged as Record<string, any>
      }
    }
    else {
      mergeRecursive(accumulator, next)
    }
  }
  return Object.keys(accumulator).length ? accumulator : undefined
}
