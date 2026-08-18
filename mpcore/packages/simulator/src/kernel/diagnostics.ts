export type RuntimeDiagnosticLevel = 'error' | 'exception' | 'warn'

export interface RuntimeDiagnosticEntry {
  args: unknown[]
  level: RuntimeDiagnosticLevel
  timestamp: number
}

export interface RuntimeConsoleEntry {
  args: unknown[]
  level: 'debug' | 'error' | 'info' | 'log' | 'warn'
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

  createConsole(baseConsole: Console = console, onConsole?: (entry: RuntimeConsoleEntry) => void): Console {
    const runtimeConsole = Object.create(baseConsole) as Console
    const wrap = (level: RuntimeConsoleEntry['level'], method: (...args: unknown[]) => void) => (...args: unknown[]) => {
      if (level === 'error' || level === 'warn') {
        this.record(level, args)
      }
      onConsole?.({ args: [...args], level })
      method(...args)
    }
    runtimeConsole.debug = wrap('debug', baseConsole.debug.bind(baseConsole))
    runtimeConsole.info = wrap('info', baseConsole.info.bind(baseConsole))
    runtimeConsole.log = wrap('log', baseConsole.log.bind(baseConsole))
    runtimeConsole.error = (...args: unknown[]) => {
      wrap('error', baseConsole.error.bind(baseConsole))(...args)
    }
    runtimeConsole.warn = (...args: unknown[]) => {
      wrap('warn', baseConsole.warn.bind(baseConsole))(...args)
    }
    return runtimeConsole
  }
}
