function resolveConsolePayload(entry: any) {
  if (entry && typeof entry === 'object' && entry.entry && typeof entry.entry === 'object') {
    return entry.entry
  }
  if (entry && typeof entry === 'object' && entry.message && typeof entry.message === 'object') {
    return entry.message
  }
  if (entry && typeof entry === 'object' && entry.params && typeof entry.params === 'object') {
    return entry.params
  }
  return entry
}

function normalizeConsoleArg(raw: any) {
  if (typeof raw === 'string') {
    return raw
  }
  if (raw && typeof raw === 'object') {
    const description = typeof raw.description === 'string' ? raw.description : ''
    const value = 'value' in raw ? raw.value : raw
    if (value && typeof value === 'object') {
      const name = typeof value.name === 'string' ? value.name : ''
      const message = typeof value.message === 'string' ? value.message : ''
      const stack = typeof value.stack === 'string' ? value.stack : ''
      const errorText = [name, message].filter(Boolean).join(': ')
      return [description || errorText, stack].filter(Boolean).join('\n')
    }
    if (typeof value === 'string') {
      return value
    }
    if (description) {
      return description
    }
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  try {
    return JSON.stringify(raw)
  }
  catch {
    return String(raw)
  }
}

function normalizeConsoleText(entry: any) {
  const payload = resolveConsolePayload(entry)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }
  if (Array.isArray(payload?.args) && payload.args.length > 0) {
    const text = payload.args
      .map((item: any) => normalizeConsoleArg(item && typeof item === 'object' && 'value' in item ? item.value : item))
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

function resolveConsoleLevel(entry: any): 'debug' | 'info' | 'log' | 'warn' | 'error' {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? '').toLowerCase()
  if (level === 'debug') {
    return 'debug'
  }
  if (level === 'info') {
    return 'info'
  }
  if (level === 'warn' || level === 'warning') {
    return 'warn'
  }
  if (level === 'error' || level === 'fatal') {
    return 'error'
  }
  const text = normalizeConsoleText(entry)
  if (/\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/.test(text)) {
    return 'error'
  }
  return 'log'
}

function formatRuntimeEntry(kind: 'console' | 'exception', entry: any, level?: string) {
  const text = kind === 'exception' && typeof entry?.exceptionDetails?.text === 'string'
    ? entry.exceptionDetails.text
    : normalizeConsoleText(entry)
  if (kind === 'console') {
    return `[console:${level ?? resolveConsoleLevel(entry)}] ${text}`
  }
  const frames = Array.isArray(entry?.exceptionDetails?.stackTrace?.callFrames)
    ? entry.exceptionDetails.stackTrace.callFrames
    : []
  const frameText = frames
    .slice(0, 3)
    .map((frame: any) => {
      const location = [
        frame?.url,
        Number.isFinite(frame?.lineNumber) ? Number(frame.lineNumber) + 1 : undefined,
        Number.isFinite(frame?.columnNumber) ? Number(frame.columnNumber) + 1 : undefined,
      ].filter(value => value !== undefined && value !== '').join(':')
      return [frame?.functionName, location].filter(Boolean).join('@')
    })
    .filter(Boolean)
    .join(' <- ')
  return frameText ? `[exception] ${text} ${frameText}` : `[exception] ${text}`
}

export interface RuntimeErrorCollector {
  mark: () => number
  getSince: (marker: number) => string[]
  getLogsSince: (marker: number) => string[]
  getAll: () => string[]
  getAllLogs: () => string[]
  dispose: () => void
}

export function attachRuntimeErrorCollector(miniProgram: any): RuntimeErrorCollector {
  const runtimeEvents: Array<{ seq: number, text: string }> = []
  const runtimeLogs: Array<{ seq: number, text: string }> = []
  let seq = 0
  const onConsole = (entry: any) => {
    seq += 1
    const level = resolveConsoleLevel(entry)
    const formatted = formatRuntimeEntry('console', entry, level)
    runtimeLogs.push({ seq, text: formatted })
    if (level === 'error') {
      runtimeEvents.push({ seq, text: formatted })
    }
  }
  const onException = (entry: any) => {
    seq += 1
    const formatted = formatRuntimeEntry('exception', entry)
    runtimeEvents.push({ seq, text: formatted })
    runtimeLogs.push({ seq, text: formatted })
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)

  return {
    mark() {
      return seq
    },
    getSince(marker) {
      return runtimeEvents
        .filter(entry => entry.seq > marker)
        .map(entry => entry.text)
    },
    getLogsSince(marker) {
      return runtimeLogs
        .filter(entry => entry.seq > marker)
        .map(entry => entry.text)
    },
    getAll() {
      return runtimeEvents.map(entry => entry.text)
    },
    getAllLogs() {
      return runtimeLogs.map(entry => entry.text)
    },
    dispose() {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
    },
  }
}
