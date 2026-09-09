import { afterEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from './ideWarningReport'
import { flushRuntimeConsoleSessions, registerRuntimeConsoleSession } from './runtimeConsoleSessions'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn() }))

const disposers: Array<() => boolean> = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose()
  }
  vi.clearAllMocks()
})

describe('runtime console session boundaries', () => {
  it('waits for every active session and releases sessions independently', async () => {
    const first = { flushConsole: vi.fn(async () => {}) }
    const second = { flushConsole: vi.fn(async () => {}) }
    disposers.push(registerRuntimeConsoleSession(first, 'e2e-apps/first'))
    disposers.push(registerRuntimeConsoleSession(second, 'e2e-apps/second'))
    await flushRuntimeConsoleSessions()
    expect(first.flushConsole).toHaveBeenCalledTimes(1)
    expect(second.flushConsole).toHaveBeenCalledTimes(1)
    disposers[0]!()
    await flushRuntimeConsoleSessions()
    expect(first.flushConsole).toHaveBeenCalledTimes(1)
    expect(second.flushConsole).toHaveBeenCalledTimes(2)
  })

  it('waits for other sessions after a failure, records the failure, and preserves its identity', async () => {
    const failure = new Error('inspection connection closed')
    let release!: () => void
    disposers.push(registerRuntimeConsoleSession({
      flushConsole: async () => {
        throw failure
      },
    }, 'e2e-apps/first'))
    disposers.push(registerRuntimeConsoleSession({ flushConsole: async () => await new Promise<void>(resolve => release = resolve) }, 'e2e-apps/second'))
    const result = expect(flushRuntimeConsoleSessions()).rejects.toBe(failure)
    expect(appendIdeReportEvent).not.toHaveBeenCalled()
    release()
    await result
    expect(appendIdeReportEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      project: 'e2e-apps/first',
      level: 'error',
      channel: 'console-inspection',
      text: 'Failed to flush runtime console: inspection connection closed',
    }))
  })

  it('preserves multiple failures and permits providers without asynchronous console inspection', async () => {
    const first = new Error('first')
    const second = new Error('second')
    disposers.push(registerRuntimeConsoleSession({}, 'e2e-apps/headless'))
    disposers.push(registerRuntimeConsoleSession({
      flushConsole: async () => {
        throw first
      },
    }, 'e2e-apps/first'))
    disposers.push(registerRuntimeConsoleSession({
      flushConsole: async () => {
        throw second
      },
    }, 'e2e-apps/second'))
    await expect(flushRuntimeConsoleSessions()).rejects.toMatchObject({ errors: [first, second] })
    expect(appendIdeReportEvent).toHaveBeenCalledTimes(2)
  })
})
