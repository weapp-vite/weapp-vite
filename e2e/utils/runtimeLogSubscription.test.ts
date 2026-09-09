import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeLogSubscription, isRuntimeLogSubscriptionResponseTimeout, RuntimeLogSubscriptionDeadlineError, waitForRuntimeLogSubscription } from './runtimeLogSubscription'

function after(ms: number, error?: Error) {
  return new Promise<void>((resolve, reject) => setTimeout(() => error ? reject(error) : resolve(), ms))
}

describe('startup runtime log subscription', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('keeps the same session through two host timeouts until a 29-second cold compile finishes', async () => {
    const subscribe = vi.fn()
      .mockImplementationOnce(() => after(10_000, new Error('timeout waiting for automator response')))
      .mockImplementationOnce(() => after(10_000, new Error('timeout waiting for automator response')))
      .mockImplementationOnce(() => after(9_000))
    const result = waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 60_000, signal: new AbortController().signal, assertClean: vi.fn() })
    const assertion = expect(result).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(subscribe).toHaveBeenCalledTimes(3)
    expect(subscribe.mock.calls.map(call => call[0])).toEqual([15_000, 15_000, 15_000])
  })

  it.each(['appservice App.CDPEnable unimplemented', 'Connection closed, check if wechat web devTools is still running', 'App.CDPEnable timeout', 'compile failed: SyntaxError'])('does not retry %s', async (message) => {
    const failure = new Error(message)
    const subscribe = vi.fn().mockRejectedValue(failure)
    await expect(waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 60_000, signal: new AbortController().signal, assertClean: vi.fn() })).rejects.toBe(failure)
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('caps every request at the remaining phase budget and retains the final cause', async () => {
    const failure = new Error('timeout waiting for automator response')
    const subscribe = vi.fn((budget: number) => after(budget, failure))
    const result = waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 16_000, signal: new AbortController().signal, assertClean: vi.fn() })
    const assertion = expect(result).rejects.toMatchObject({ code: 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE', cause: failure, attempts: 2 })
    await vi.advanceTimersByTimeAsync(16_000)
    await assertion
    expect(subscribe.mock.calls.map(call => call[0])).toEqual([15_000, 750])
  })

  it('does not retry in the background after the outer monitor or attempt deadline cancels an in-flight request', async () => {
    const controller = new AbortController()
    const failure = new Error('compiler diagnostic observed by the outer monitor')
    const subscribe = vi.fn(() => after(10_000, new Error('timeout waiting for automator response')))
    const result = waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 60_000, signal: controller.signal, assertClean: vi.fn() })
    const assertion = expect(result).rejects.toBe(failure)
    setTimeout(() => controller.abort(failure), 1_000)
    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('cancels retry backoff immediately when the surrounding monitor reports a compile error', async () => {
    const controller = new AbortController()
    const failure = new Error('compile error during startup')
    const subscribe = vi.fn().mockRejectedValue(new Error('timeout waiting for automator response'))
    const result = waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 60_000, signal: controller.signal, assertClean: vi.fn() })
    const assertion = expect(result).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(100)
    controller.abort(failure)
    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('checks compile diagnostics before retrying a transport timeout', async () => {
    const failure = new Error('compile failed')
    const assertClean = vi.fn().mockImplementationOnce(() => {}).mockImplementation(() => {
      throw failure
    })
    const subscribe = vi.fn().mockRejectedValue(new Error('timeout waiting for automator response'))
    await expect(waitForRuntimeLogSubscription({ subscribe, deadlineAt: performance.now() + 60_000, signal: new AbortController().signal, assertClean })).rejects.toBe(failure)
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('preserves outer timeout and last protocol failure while leaving unrelated errors intact', async () => {
    const lastCause = new Error('timeout waiting for automator response')
    const outer = new Error('Timeout in runtime log subscription after 16000ms')
    const session = createRuntimeLogSubscription({
      subscribe: vi.fn().mockRejectedValueOnce(lastCause).mockImplementation(() => new Promise<void>(() => {})),
      deadlineAt: performance.now() + 16_000,
      timeoutMessages: [outer.message],
      assertClean: vi.fn(),
    })
    void session.wait()
    await vi.advanceTimersByTimeAsync(300)
    expect(session.normalizeError(outer)).toMatchObject({
      code: 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE',
      attempts: 2,
      cause: outer,
      lastCause,
    })
    for (const error of [new Error('compile failed'), new Error('Connection closed'), new Error(`${outer.message} extra`), Object.assign(new Error(outer.message), { code: 'OTHER_TIMEOUT' })]) {
      expect(session.normalizeError(error)).toBe(error)
    }
    session.abort()
  })

  it('does not normalize timeout-shaped failures after subscription succeeds', async () => {
    const outer = new Error('Timeout in launch automator#1 after 16000ms')
    const session = createRuntimeLogSubscription({
      subscribe: vi.fn().mockResolvedValue(undefined),
      deadlineAt: performance.now() + 16_000,
      timeoutMessages: [outer.message],
      assertClean: vi.fn(),
    })
    await session.wait()
    expect(session.pending).toBe(false)
    expect(session.normalizeError(outer)).toBe(outer)
  })

  it('classifies only subscription protocol methods and preserves the deadline error', () => {
    expect(isRuntimeLogSubscriptionResponseTimeout(Object.assign(new Error('local deadline'), { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'App.CDPEnable' }), 15_000)).toBe(true)
    expect(isRuntimeLogSubscriptionResponseTimeout(Object.assign(new Error('local deadline'), { code: 'DEVTOOLS_PROTOCOL_TIMEOUT', method: 'App.callFunction' }), 15_000)).toBe(false)
    expect(isRuntimeLogSubscriptionResponseTimeout(new RuntimeLogSubscriptionDeadlineError(3), 15_000)).toBe(false)
  })
})
