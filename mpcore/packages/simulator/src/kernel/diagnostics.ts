export type RuntimeDiagnosticLevel = 'error' | 'exception' | 'warn'

export interface RuntimeDiagnosticEntry {
  args: unknown[]
  level: RuntimeDiagnosticLevel
  timestamp: number
}

export class RuntimeDiagnostics {
  private readonly entries: RuntimeDiagnosticEntry[] = []

  clear() {
    this.entries.length = 0
  }

  getEntries() {
    return this.entries.map(entry => ({
      ...entry,
      args: [...entry.args],
    }))
  }

  record(level: RuntimeDiagnosticLevel, args: unknown[]) {
    this.entries.push({
      args: [...args],
      level,
      timestamp: Date.now(),
    })
  }

  createConsole(baseConsole: Console = console): Console {
    const runtimeConsole = Object.create(baseConsole) as Console
    runtimeConsole.error = (...args: unknown[]) => {
      this.record('error', args)
      baseConsole.error(...args)
    }
    runtimeConsole.warn = (...args: unknown[]) => {
      this.record('warn', args)
      baseConsole.warn(...args)
    }
    return runtimeConsole
  }
}
