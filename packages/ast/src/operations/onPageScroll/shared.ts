import type * as t from '@babel/types'
import type { OxcLoc } from './types'

export function isStaticPropertyName(key: t.Expression | t.Identifier | t.PrivateName): string | undefined {
  if (key.type === 'Identifier') {
    return key.name
  }
  if (key.type === 'StringLiteral') {
    return key.value
  }
  return undefined
}

export function getMemberExpressionPropertyName(node: t.MemberExpression | t.OptionalMemberExpression): string | undefined {
  if (node.computed) {
    return node.property.type === 'StringLiteral' ? node.property.value : undefined
  }
  return node.property.type === 'Identifier' ? node.property.name : undefined
}

export function isOnPageScrollCallee(
  callee: t.Expression | t.V8IntrinsicIdentifier,
  hookNames: Set<string>,
  namespaceImports: Set<string>,
): boolean {
  if (callee.type === 'Identifier') {
    return hookNames.has(callee.name)
  }

  if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
    const object = callee.object
    const propName = getMemberExpressionPropertyName(callee)
    return object.type === 'Identifier'
      && namespaceImports.has(object.name)
      && propName === 'onPageScroll'
  }

  return false
}

export function getCallExpressionCalleeName(
  callee: t.Expression | t.V8IntrinsicIdentifier,
): string | undefined {
  if (callee.type === 'Identifier') {
    return callee.name
  }
  if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
    return getMemberExpressionPropertyName(callee)
  }
  return undefined
}

export function getOnPageScrollCallbackArgument(
  node: { arguments?: Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder | null> },
) {
  const arg0 = node.arguments?.[0]
  if (!arg0 || arg0.type === 'SpreadElement') {
    return undefined
  }
  return arg0.type === 'FunctionExpression' || arg0.type === 'ArrowFunctionExpression'
    ? arg0
    : undefined
}

export function createWarningPrefix(filename: string, line?: number, column?: number): string {
  const pos = typeof line === 'number' && typeof column === 'number'
    ? `${line}:${column}`
    : '?:?'
  return `[weapp-vite][onPageScroll] ${filename}:${pos}`
}

export function getOxcStaticPropertyName(node: any): string | undefined {
  if (!node) {
    return undefined
  }
  if (node.type === 'Identifier') {
    return node.name
  }
  if (
    (node.type === 'StringLiteral' || node.type === 'Literal')
    && typeof node.value === 'string'
  ) {
    return node.value
  }
  return undefined
}

export function getOxcMemberExpressionPropertyName(node: any): string | undefined {
  if (!node || node.type !== 'MemberExpression') {
    return undefined
  }
  if (node.computed) {
    return getOxcStaticPropertyName(node.property)
  }
  return node.property?.type === 'Identifier' ? node.property.name : undefined
}

export function isOxcFunctionLike(node: any) {
  return node?.type === 'FunctionExpression'
    || node?.type === 'ArrowFunctionExpression'
}

export function isOxcOnPageScrollCallee(
  callee: any,
  hookNames: Set<string>,
  namespaceImports: Set<string>,
): boolean {
  if (!callee) {
    return false
  }
  if (callee.type === 'Identifier') {
    return hookNames.has(callee.name)
  }
  if (callee.type === 'MemberExpression') {
    const propName = getOxcMemberExpressionPropertyName(callee)
    return callee.object?.type === 'Identifier'
      && namespaceImports.has(callee.object.name)
      && propName === 'onPageScroll'
  }
  return false
}

export function getOxcCallExpressionCalleeName(callee: any): string | undefined {
  if (!callee) {
    return undefined
  }
  if (callee.type === 'Identifier') {
    return callee.name
  }
  if (callee.type === 'MemberExpression') {
    return getOxcMemberExpressionPropertyName(callee)
  }
  return undefined
}

export function createLineStartOffsets(code: string) {
  const offsets = [0]
  for (let index = 0; index < code.length; index += 1) {
    if (code.charCodeAt(index) === 10) {
      offsets.push(index + 1)
    }
  }
  return offsets
}

export function getLocationFromOffset(offset: number | undefined, lineStarts: number[]): OxcLoc | undefined {
  if (typeof offset !== 'number' || offset < 0) {
    return undefined
  }
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lineStarts[mid] <= offset) {
      low = mid + 1
    }
    else {
      high = mid - 1
    }
  }
  const lineIndex = Math.max(0, low - 1)
  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
  }
}
