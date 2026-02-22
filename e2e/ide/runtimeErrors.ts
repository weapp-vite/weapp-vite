function resolveConsolePayload(entry: any) {
  if (entry && typeof entry === 'object' && entry.entry && typeof entry.entry === 'object') {
    return entry.entry
  }
  return entry
}

function normalizeConsoleText(entry: any) {
  const payload = resolveConsolePayload(entry)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }
  if (Array.isArray(payload?.args) && payload.args.length > 0) {
    const text = payload.args
      .map((item: any) => {
        const raw = item && typeof item === 'object' && 'value' in item ? item.value : item
        if (typeof raw === 'string') {
          return raw
        }
        try {
          return JSON.stringify(raw)
        }
        catch {
          return String(raw)
        }
      })
      .join(' ')
      .trim()
    if (text) {
      return text
    }
  }
  try {
    return JSON.stringify(entry)
  }
  catch {
    return String(entry)
  }
}

function isErrorConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? '').toLowerCase()
  if (level === 'error' || level === 'fatal') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/.test(text)
}

function formatRuntimeEntry(kind: 'console' | 'exception', entry: any) {
  const text = kind === 'exception' && typeof entry?.exceptionDetails?.text === 'string'
    ? entry.exceptionDetails.text
    : normalizeConsoleText(entry)
  if (kind === 'console') {
    const payload = resolveConsolePayload(entry)
    const level = String(payload?.level ?? 'unknown').toLowerCase()
    return `[console:${level}] ${text}`
  }
  return `[exception] ${text}`
}

export interface RuntimeErrorCollector {
  mark: () => number
  getSince: (marker: number) => string[]
  getAll: () => string[]
  dispose: () => void
}

export function attachRuntimeErrorCollector(miniProgram: any): RuntimeErrorCollector {
  const runtimeEvents: string[] = []
  const onConsole = (entry: any) => {
    if (isErrorConsoleEntry(entry)) {
      runtimeEvents.push(formatRuntimeEntry('console', entry))
    }
  }
  const onException = (entry: any) => {
    runtimeEvents.push(formatRuntimeEntry('exception', entry))
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)

  return {
    mark() {
      return runtimeEvents.length
    },
    getSince(marker) {
      return runtimeEvents.slice(marker)
    },
    getAll() {
      return runtimeEvents.slice()
    },
    dispose() {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
    },
  }
}
