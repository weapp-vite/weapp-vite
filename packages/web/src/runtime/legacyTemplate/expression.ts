import type { LegacyTemplateScope } from './types'
import { getRuntimeExecutionMode, warnRuntimeExecutionOnce } from '../execution'

const expressionCache = new Map<string, (scope: LegacyTemplateScope) => any>()

export function createScope(initial?: LegacyTemplateScope) {
  return Object.assign(Object.create(null), initial ?? {})
}

export function createChildScope(parent: LegacyTemplateScope) {
  return Object.assign(Object.create(parent), {})
}

export function normalizeList(value: any): any[] {
  if (Array.isArray(value)) {
    return value
  }
  if (value == null) {
    return []
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const length = Math.max(0, Math.floor(value))
    return Array.from({ length }, (_, index) => index)
  }
  if (typeof value === 'object') {
    return Object.values(value)
  }
  return []
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case '\'':
        return '&#39;'
      default:
        return match
    }
  })
}

export function escapeAttribute(value: string) {
  return escapeHtml(value)
}

function toDisplayString(value: any) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

function unwrapExpression(expression: string) {
  const trimmed = expression.trim()
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2).trim()
  }
  return trimmed
}

export function evaluateExpression(expression: string, scope: LegacyTemplateScope) {
  if (!expression) {
    return undefined
  }
  const trimmed = unwrapExpression(expression)
  if (!trimmed) {
    return undefined
  }
  let evaluator = expressionCache.get(trimmed)
  if (!evaluator) {
    try {
      // eslint-disable-next-line no-new-func -- dynamic expressions are required for template evaluation
      evaluator = new Function('scope', `with(scope){ return (${trimmed}); }`) as (scope: LegacyTemplateScope) => any
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const mode = getRuntimeExecutionMode()
      if (mode === 'safe') {
        warnRuntimeExecutionOnce(
          `safe-legacy-expression-parse:${trimmed}`,
          `[@weapp-vite/web] safe 模式下忽略表达式解析错误 "${trimmed}": ${reason}`,
        )
        evaluator = () => undefined
      }
      else {
        throw new SyntaxError(`[@weapp-vite/web] 无法解析表达式 "${trimmed}": ${reason}`)
      }
    }
    if (evaluator) {
      expressionCache.set(trimmed, evaluator)
    }
  }
  try {
    return evaluator?.(scope)
  }
  catch (error) {
    const mode = getRuntimeExecutionMode()
    if (mode === 'strict') {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`[@weapp-vite/web] strict 模式下表达式执行失败 "${trimmed}": ${reason}`)
    }
    if (mode === 'safe') {
      const reason = error instanceof Error ? error.message : String(error)
      warnRuntimeExecutionOnce(
        `safe-legacy-expression-runtime:${trimmed}`,
        `[@weapp-vite/web] safe 模式下忽略表达式执行错误 "${trimmed}": ${reason}`,
      )
    }
    return undefined
  }
}

export function interpolateText(source: string, scope: LegacyTemplateScope, escapeResult: boolean) {
  if (!source.includes('{{')) {
    return escapeResult ? escapeHtml(source) : source
  }

  let cursor = 0
  let buffer = ''

  while (cursor < source.length) {
    const start = source.indexOf('{{', cursor)
    if (start === -1) {
      buffer += source.slice(cursor)
      break
    }

    buffer += source.slice(cursor, start)

    const end = source.indexOf('}}', start + 2)
    if (end === -1) {
      buffer += source.slice(start)
      break
    }

    const expression = source.slice(start + 2, end).trim()
    const evaluated = toDisplayString(evaluateExpression(expression, scope))
    buffer += evaluated
    cursor = end + 2
  }

  return escapeResult ? escapeHtml(buffer) : buffer
}

export function resolveAttributeValue(value: string, scope: LegacyTemplateScope) {
  return interpolateText(value ?? '', scope, false)
}
