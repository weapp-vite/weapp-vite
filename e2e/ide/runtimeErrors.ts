function normalizeConsoleText(entry: any) {
  if (typeof entry?.text === 'string' && entry.text.trim()) {
    return entry.text.trim()
  }
  if (Array.isArray(entry?.args) && entry.args.length > 0) {
    const text = entry.args
      .map((item: any) => {
        if (typeof item === 'string') {
          return item
        }
        try {
          return JSON.stringify(item)
        }
        catch {
          return String(item)
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
  const level = String(entry?.level ?? '').toLowerCase()
  if (level === 'error' || level === 'fatal') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/.test(text)
}

function formatRuntimeEntry(kind: 'console' | 'exception', entry: any) {
  const text = normalizeConsoleText(entry)
  if (kind === 'console') {
    const level = String(entry?.level ?? 'unknown').toLowerCase()
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
