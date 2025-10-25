import type { BindingErrorLike } from './buildPlugin'

// eslint-disable-next-line no-control-regex -- intentionally matching ANSI escape sequences
const ANSI_ESCAPE_PATTERN = /\u001B\[[0-9;]*m/g

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '')
}

function isErrorInstance(value: unknown): value is Error {
  return value instanceof Error
}

function formatSummary(payload: Record<string, unknown>): string {
  const parts: string[] = []

  const code = payload.code
  if (typeof code === 'string' && code.trim()) {
    parts.push(`code: ${code.trim()}`)
  }

  const plugin = payload.plugin
  if (typeof plugin === 'string' && plugin.trim()) {
    parts.push(`plugin: ${plugin.trim()}`)
  }

  const id = payload.id
  if (typeof id === 'string' && id.trim()) {
    parts.push(`id: ${id.trim()}`)
  }

  if (!parts.length) {
    return ''
  }

  return ` (${parts.join(', ')})`
}

function collectDetails(payload: Record<string, unknown>): string[] {
  const details: string[] = []

  const frame = payload.frame
  if (typeof frame === 'string' && frame.trim()) {
    details.push(frame.trim())
  }

  const stack = payload.stack
  if (typeof stack === 'string' && stack.trim()) {
    details.push(stack.trim())
  }

  return details
}

function extractMessage(value: unknown, seen: Set<unknown>): string | undefined {
  if (!value || seen.has(value)) {
    return undefined
  }

  if (typeof value === 'string') {
    const trimmed = stripAnsi(value).trim()
    return trimmed || undefined
  }

  if (isErrorInstance(value)) {
    const trimmed = stripAnsi(value.message ?? '').trim()
    if (trimmed) {
      return trimmed
    }
    if (value.cause) {
      return extractMessage(value.cause, seen)
    }
    return undefined
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    seen.add(record)

    const directMessage = extractMessage(record.message, seen)
    if (directMessage) {
      return directMessage
    }

    const nestedKeys = ['reason', 'detail', 'details', 'error', 'field0', 'field1', 'cause']
    for (const key of nestedKeys) {
      if (key in record) {
        const nestedMessage = extractMessage(record[key], seen)
        if (nestedMessage) {
          return nestedMessage
        }
      }
    }
  }

  return undefined
}

export function createIndependentBuildError(root: string, cause?: unknown): Error {
  const fallback = `Independent bundle for ${root} failed`

  if (isErrorInstance(cause)) {
    if (!cause.message || cause.message.trim() === '') {
      return new Error(fallback, { cause })
    }
    return cause
  }

  if (!cause) {
    return new Error(fallback)
  }

  if (typeof cause === 'string') {
    const trimmed = stripAnsi(cause).trim()
    if (!trimmed) {
      return new Error(fallback, { cause })
    }
    return new Error(trimmed, { cause })
  }

  if (typeof cause === 'object') {
    const payload = cause as BindingErrorLike & Record<string, unknown>
    const seen = new Set<unknown>()
    const extracted = extractMessage(payload, seen)
    const summary = formatSummary(payload)
    const detailLines = collectDetails(payload)

    if (extracted) {
      let composedMessage = extracted
      if (summary) {
        composedMessage += summary
      }
      if (detailLines.length) {
        composedMessage += `\n${detailLines.join('\n')}`
      }
      return new Error(composedMessage, { cause })
    }

    if (summary || detailLines.length) {
      const composed = detailLines.length ? `${fallback}${summary}\n${detailLines.join('\n')}` : `${fallback}${summary}`
      if (composed.trim()) {
        return new Error(composed, { cause })
      }
    }
  }

  try {
    // fall back to JSON representation
    const serialized = JSON.stringify(cause)
    if (serialized && serialized !== '{}') {
      return new Error(`${fallback}: ${serialized}`, { cause })
    }
  }
  catch {
    // ignore serialization errors
  }

  return new Error(fallback, { cause })
}
