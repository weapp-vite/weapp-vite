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

function eventData(type: string, data: Record<string, unknown>): boolean {
  if (type === 'message') {
    return message(data.message)
  }
  if (type === 'tool.started' || type === 'tool.completed') {
    return nonempty(data.callId) && (data.name === undefined || nonempty(data.name))
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
  const end = raw.lastIndexOf('\n') + 1
  const complete = raw.slice(0, end)
  const events: SessionEvent[] = []
  for (const line of complete.split('\n').slice(0, -1)) {
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
      || !Number.isFinite(Date.parse(value.timestamp)) || !nonempty(value.type)
      || !record(value.data) || !eventData(value.type, value.data)) {
      throw new SessionJournalError(`Invalid session journal record ${events.length + 1}: invalid event or message; refusing to replay it.`, events)
    }
    events.push(value as unknown as SessionEvent)
  }
  return {
    events,
    completeBytes: Buffer.byteLength(complete),
    incompleteTail: end !== raw.length,
    diagnostics: end === raw.length ? [] : ['Ignored an incomplete trailing journal record; resume repairs it while holding the session lock.'],
  }
}
