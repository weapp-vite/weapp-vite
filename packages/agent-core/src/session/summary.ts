import type { SessionSummary } from './types.js'
import { redactor } from '../security.js'
import { readSessionJournal, SessionJournalError } from './reader.js'
import { reduceSession } from './reducer.js'

function displayText(text: string, clean: (text: string) => string, limit = 240): string {
  const safe = clean(text)
    .replace(/data:[^\s,]+,\S+/gi, '[image/data omitted]')
    .replace(/[A-Z0-9+/]{80,}={0,2}/gi, '[binary data omitted]')
    .replace(/\s+/g, ' ')
  return safe.length > limit ? `${safe.slice(0, limit)}…` : safe
}

/** 详情只暴露有限预览，图片载荷和敏感字段不进入展示接口。 */
function preview(value: unknown, clean: (text: string) => string, depth = 0): unknown {
  if (typeof value === 'string') {
    return displayText(value, clean)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (depth >= 3) {
    return '[nested data omitted]'
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 8).map(item => preview(item, clean, depth + 1))
    return value.length > 8 ? [...items, '[additional items omitted]'] : items
  }
  const object = value as Record<string, unknown>
  if (object.type === 'image' || object.type === 'image_url' || object.mediaType !== undefined) {
    return '[image omitted]'
  }
  return Object.fromEntries(Object.entries(object).slice(0, 12).map(([key, item]) => [
    displayText(key, clean, 80),
    /key|token|secret|password|authorization/i.test(key)
      ? '[REDACTED]'
      : /^(?:data|base64|images?|image_url)$/i.test(key)
        ? '[data omitted]'
        : preview(item, clean, depth + 1),
  ]))
}

export async function inspectSession(filename: string, sessionId: string): Promise<SessionSummary> {
  const clean = redactor()
  try {
    const journal = await readSessionJournal(filename, sessionId)
    const { messages: _, ...state } = reduceSession(journal.events)
    return {
      sessionId,
      ...state,
      prompt: displayText(state.prompt, clean),
      pendingCalls: state.pendingCalls.map(call => ({
        id: displayText(call.id, clean, 100),
        name: displayText(call.name, clean, 100),
        input: preview(call.input, clean),
        state: call.state,
      })),
      diagnostics: [...journal.diagnostics, ...state.diagnostics].map(text => displayText(text, clean)),
    }
  }
  catch (error) {
    if (!(error instanceof SessionJournalError)) {
      throw error
    }
    let prefix: SessionSummary = {
      sessionId,
      updatedAt: error.events.at(-1)?.timestamp ?? null,
      prompt: '',
      status: 'invalid',
      steps: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      pendingCalls: [],
      diagnostics: [],
    }
    try {
      const { messages: _, ...state } = reduceSession(error.events)
      prefix = {
        sessionId,
        ...state,
        prompt: displayText(state.prompt, clean),
        pendingCalls: state.pendingCalls.map(call => ({
          id: displayText(call.id, clean, 100),
          name: displayText(call.name, clean, 100),
          input: preview(call.input, clean),
          state: call.state,
        })),
        diagnostics: [],
        status: 'invalid',
      }
    }
    catch {
      // A reducer failure may itself be the corruption; retain the safe empty fallback.
    }
    return {
      ...prefix,
      diagnostics: [displayText(error.message, clean)],
    }
  }
}
