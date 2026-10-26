import type { InterpolationPart } from './types'

export function parseInterpolations(value: string): InterpolationPart[] {
  const parts: InterpolationPart[] = []
  if (!value.includes('{{')) {
    return [{ type: 'text', value }]
  }
  let cursor = 0
  while (cursor < value.length) {
    const start = value.indexOf('{{', cursor)
    if (start === -1) {
      parts.push({ type: 'text', value: value.slice(cursor) })
      break
    }
    if (start > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, start) })
    }
    const end = value.indexOf('}}', start + 2)
    if (end === -1) {
      parts.push({ type: 'text', value: value.slice(start) })
      break
    }
    const expr = value.slice(start + 2, end).trim()
    if (expr) {
      parts.push({ type: 'expr', value: expr })
    }
    cursor = end + 2
  }
  return parts
}

export function buildExpression(parts: InterpolationPart[], scopeVar: string, wxsVar: string) {
  if (parts.length === 0) {
    return '""'
  }
  if (parts.length === 1 && parts[0]?.type === 'text') {
    return JSON.stringify(parts[0].value)
  }
  if (parts.length === 1 && parts[0]?.type === 'expr') {
    return `ctx.eval(${JSON.stringify(parts[0].value)}, ${scopeVar}, ${wxsVar})`
  }
  const segments = parts.map((part) => {
    if (part.type === 'text') {
      return JSON.stringify(part.value)
    }
    return `ctx.eval(${JSON.stringify(part.value)}, ${scopeVar}, ${wxsVar})`
  })
  return `(${segments.join(' + ')})`
}

/** 完整表达式保留原值，混合插值逐段转为字符串，避免相邻数字执行加法。 */
export function buildDatasetExpression(value: string, scopeVar: string, wxsVar: string) {
  const trimmedParts = parseInterpolations(value.trim())
  if (trimmedParts.length === 1 && trimmedParts[0]?.type === 'expr') {
    return buildExpression(trimmedParts, scopeVar, wxsVar)
  }
  const parts = parseInterpolations(value)
  if (parts.length <= 1) {
    return buildExpression(parts, scopeVar, wxsVar)
  }
  const segments = parts.map((part) => {
    const expression = buildExpression([part], scopeVar, wxsVar)
    return part.type === 'text' ? expression : `String(${expression} ?? '')`
  })
  return `(${segments.join(' + ')})`
}

function hasTopLevelColon(expression: string) {
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplate = false
  let escaped = false
  let sawTopLevelQuestion = false

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index]!

    if (inSingleQuote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '\'') {
        inSingleQuote = false
      }
      continue
    }
    if (inDoubleQuote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inDoubleQuote = false
      }
      continue
    }
    if (inTemplate) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '`') {
        inTemplate = false
      }
      continue
    }

    if (char === '\'') {
      inSingleQuote = true
      continue
    }
    if (char === '"') {
      inDoubleQuote = true
      continue
    }
    if (char === '`') {
      inTemplate = true
      continue
    }

    if (char === '(' || char === '[' || char === '{') {
      depth += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth !== 0) {
      continue
    }

    if (char === '?') {
      sawTopLevelQuestion = true
      continue
    }
    if (char === ':') {
      return !sawTopLevelQuestion
    }
  }

  return false
}

function shouldWrapShorthandObject(expression: string) {
  const trimmed = expression.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('(')) {
    return false
  }
  return hasTopLevelColon(trimmed)
}

export function buildTemplateDataExpression(raw: string, scopeVar: string, wxsVar: string) {
  const trimmed = raw.trim()
  const parts = parseInterpolations(trimmed)
  if (parts.length === 1 && parts[0]?.type === 'expr') {
    const expr = parts[0].value.trim()
    const normalizedExpr = shouldWrapShorthandObject(expr) ? `{ ${expr} }` : expr
    return buildExpression([{ type: 'expr', value: normalizedExpr }], scopeVar, wxsVar)
  }
  return buildExpression(parseInterpolations(raw), scopeVar, wxsVar)
}
