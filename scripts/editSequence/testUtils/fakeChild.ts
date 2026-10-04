import { EventEmitter } from 'node:events'
import { vi } from 'vitest'

export class FakeChild extends EventEmitter {
  exitCode: number | null = null
  signalCode: string | null = null
  connected = true
  pid = 42
  send = vi.fn((_message: unknown, callback?: (error: Error | null) => void) => {
    callback?.(null)
    return true
  })

  kill = vi.fn((signal: string) => {
    this.exit(null, signal)
    return true
  })

  exit(code: number | null = 0, signal: string | null = null) {
    this.exitCode = code
    this.signalCode = signal
    this.connected = false
    this.emit('exit', code, signal)
  }
}

export async function flush() {
  for (let index = 0; index < 12; index++) {
    await Promise.resolve()
  }
}
