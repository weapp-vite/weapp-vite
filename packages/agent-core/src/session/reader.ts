import type { Message, SessionEvent } from '../types.js'
import type { SessionJournal } from './types.js'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'

export class SessionJournalError extends Error {
  constructor(message: string, readonly events: SessionEvent[] = []) {
    super(message)
    this.name = 'SessionJournalError'
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function images(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(image =>
    record(image) && image.type === 'image' && typeof image.data === 'string'
    && nonempty(image.mediaType)))
}

function message(value: unknown): value is Message {
  if (!record(value)) {
    return false
  }
  if (value.role === 'user') {
    return typeof value.text === 'string' && images(value.images)
      && (value.origin === undefined || value.origin === 'user' || value.origin === 'engine')
  }
  if (value.role === 'assistant') {
    return typeof value.text === 'string'
      && (value.calls === undefined || (Array.isArray(value.calls) && value.calls.every(call =>
        record(call) && nonempty(call.id) && nonempty(call.name))))
  }
  return value.role === 'tool' && nonempty(value.callId) && nonempty(value.name)
    && (value.error === undefined || typeof value.error === 'boolean')
    && record(value.result) && typeof value.result.text === 'string' && images(value.result.images)
}

function counter(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const KNOWN_EVENT_TYPES = new Set([
  'run.started',
  'message',
  'tool.started',
  'tool.completed',
  'step.started',
  'usage',
  'run.completed',
  'text.delta',
  'context.compacted',
  'recovery.required',
])

function eventData(type: string, data: Record<string, unknown>): boolean {
  if (type === 'message') {
    return message(data.message)
  }
  if (type === 'tool.started') {
    return nonempty(data.callId) && (data.name === undefined || nonempty(data.name))
  }
  if (type === 'tool.completed') {
    // v1 手工日志可能只有 callId/name；如果存在结果字段则必须符合完整结构。
    return nonempty(data.callId)
      && (data.name === undefined || nonempty(data.name))
      && (data.error === undefined || typeof data.error === 'boolean')
      && (data.result === undefined || (
        record(data.result)
        && typeof data.result.text === 'string'
        && images(data.result.images)
      ))
  }
  if (type === 'step.started') {
    return counter(data.step) && Number.isInteger(data.step) && Number(data.step) > 0
  }
  if (type === 'usage') {
    return counter(data.inputTokens) && counter(data.outputTokens)
  }
  if (type === 'run.completed') {
    return ['completed', 'failed', 'cancelled', 'action_required', 'limit_reached'].includes(String(data.status))
      && (data.reason === undefined || data.reason === 'max_steps' || data.reason === 'context_budget')
  }
  return true
}

/** 只读取完整记录；恢复入口持有写锁后才允许修复尾部半行。 */
export async function readSessionJournal(filename: string, sessionId: string): Promise<SessionJournal> {
  const raw = await readFile(filename, 'utf8')
  if (raw.length === 0) {
    return {
      events: [],
      completeBytes: 0,
      incompleteTail: false,
      needsSeparator: false,
      diagnostics: [],
    }
  }
  const hasTrailingNewline = raw.endsWith('\n')
  const lines = raw.split('\n')
  const completeLines = lines.slice(0, -1)
  const tail = hasTrailingNewline ? '' : lines.at(-1) ?? ''
  const events: SessionEvent[] = []
  for (const line of completeLines) {
    if (!line) {
      continue
    }
    let value: unknown
    try {
      value = JSON.parse(line)
    }
    catch {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: malformed JSON; refusing to replay it.`, events)
    }
    if (!record(value) || value.version !== 1 || value.sessionId !== sessionId
      || value.sequence !== events.length + 1 || !nonempty(value.timestamp)
      || !Number.isFinite(Date.parse(value.timestamp)) || !nonempty(value.type)) {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: invalid event or message; refusing to replay it.`, events)
    }
    if (!KNOWN_EVENT_TYPES.has(value.type) && !record(value.data)) {
      events.push(value as unknown as SessionEvent)
      continue
    }
    if (!record(value.data) || !eventData(value.type, value.data)) {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: invalid event or message; refusing to replay it.`, events)
    }
    events.push(value as unknown as SessionEvent)
  }
  if (tail) {
    let value: unknown
    try {
      value = JSON.parse(tail)
    }
    catch {
      return {
        events,
        completeBytes: Buffer.byteLength(raw.slice(0, raw.length - tail.length)),
        incompleteTail: true,
        needsSeparator: false,
        diagnostics: ['Ignored an incomplete trailing journal record; resume repairs it while holding the session lock.'],
      }
    }
    if (!record(value) || value.version !== 1 || value.sessionId !== sessionId
      || value.sequence !== events.length + 1 || !nonempty(value.timestamp)
      || !Number.isFinite(Date.parse(value.timestamp)) || !nonempty(value.type)) {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: invalid event or message; refusing to replay it.`, events)
    }
    if (!KNOWN_EVENT_TYPES.has(value.type) && !record(value.data)) {
      events.push(value as unknown as SessionEvent)
    }
    else if (!record(value.data) || !eventData(value.type, value.data)) {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: invalid event or message; refusing to replay it.`, events)
    }
    else {
      events.push(value as unknown as SessionEvent)
    }
  }
  const completeBytes = Buffer.byteLength(raw)
  return {
    events,
    completeBytes,
    incompleteTail: false,
    needsSeparator: !hasTrailingNewline,
    diagnostics: [],
  }
}
