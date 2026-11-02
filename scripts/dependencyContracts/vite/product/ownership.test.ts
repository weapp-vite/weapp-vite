import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProductReport } from '../../report.mjs'
import { ViteProductTerminationError, withViteProductOwnership } from './ownership.mjs'

function harness() {
  const scope = { seal: vi.fn(async () => {}), complete: vi.fn(async () => {}) }
  const lease = { createChildScope: vi.fn(async () => scope) }
  const report = createProductReport('vite', ['hooks'])
  const signals = new EventEmitter()
  const pending: string[] = []
  const exit = vi.fn()
  const persist = vi.fn(async () => {})
  const execute = vi.fn(async () => {})
  const options = { reportFile: 'report.json', report, execute, pendingFixtures: () => [...pending], persist, exit, signals, timeoutMs: 100 }
  return { scope, lease, report, signals, pending, exit, persist, execute, options }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Vite product resource supervision', () => {
  it('completes the bound scope only after execution confirms every fixture is gone', async () => {
    const state = harness()
    state.execute.mockImplementationOnce(async () => {
      expect(state.scope.complete).not.toHaveBeenCalled()
      state.pending.push('owned-fixture')
      state.pending.length = 0
    })
    await withViteProductOwnership(state.lease, state.options)
    expect(state.lease.createChildScope).toHaveBeenCalledWith({ cleanupKey: expect.stringContaining('vite-product:') })
    expect(state.scope.seal).toHaveBeenCalledTimes(1)
    expect(state.scope.complete).toHaveBeenCalledTimes(1)
    expect(state.report).toMatchObject({ ownership: { scope: 'completed', bindingSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }, cleanup: { status: 'confirmed', fixtures: [] } })
    expect(state.exit).not.toHaveBeenCalled()
    expect(state.signals.eventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([undefined, null, false, 0, new AggregateError([new Error('assertion')], 'Product assertion failed')])('preserves %j execution failure after confirmed cleanup', async (error) => {
    const state = harness()
    state.execute.mockRejectedValueOnce(error)
    const outcome = await withViteProductOwnership(state.lease, state.options).then(() => ({ status: 'fulfilled' }), reason => ({ status: 'rejected', reason }))
    expect(outcome).toEqual({ status: 'rejected', reason: error })
    expect(state.scope.complete).toHaveBeenCalledTimes(1)
    expect(state.report.cleanup).toMatchObject({ status: 'confirmed' })
    expect(state.exit).not.toHaveBeenCalled()
  })

  it('preserves a live fixture, the original failure and an incomplete sealed scope', async () => {
    const state = harness()
    const original = new Error('Native owner close failed')
    state.pending.push('owned-fixture')
    state.execute.mockRejectedValueOnce(original)
    await expect(withViteProductOwnership(state.lease, state.options)).rejects.toBeInstanceOf(ViteProductTerminationError)
    expect(state.scope.seal).toHaveBeenCalledTimes(1)
    expect(state.scope.complete).not.toHaveBeenCalled()
    expect(state.report).toMatchObject({ status: 'failed', ownership: { scope: 'sealed' }, cleanup: { status: 'unconfirmed', pendingFixtures: ['owned-fixture'], lease: 'preserved' }, error: { message: original.message } })
    expect(state.persist).toHaveBeenCalledTimes(1)
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('times out without completing the scope and cannot complete it after late work resolves', async () => {
    const state = harness()
    const held = Promise.withResolvers<void>()
    state.pending.push('pending-fixture')
    state.execute.mockImplementationOnce(() => held.promise)
    const observed = withViteProductOwnership(state.lease, state.options).catch(error => error)
    await vi.advanceTimersByTimeAsync(101)
    expect(await observed).toBeInstanceOf(ViteProductTerminationError)
    expect(state.report).toMatchObject({ status: 'timeout', cleanup: { status: 'unconfirmed', pendingFixtures: ['pending-fixture'] } })
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(2)
    state.pending.length = 0
    held.resolve()
    await Promise.resolve()
    expect(state.scope.complete).not.toHaveBeenCalled()
    expect(state.signals.eventNames()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('seals on interruption and keeps one termination result for simultaneous requests', async () => {
    const state = harness()
    const held = Promise.withResolvers<void>()
    state.execute.mockImplementationOnce(() => held.promise)
    const observed = withViteProductOwnership(state.lease, state.options).catch(error => error)
    await vi.advanceTimersByTimeAsync(0)
    state.signals.emit('SIGTERM')
    state.signals.emit('SIGINT')
    expect(await observed).toBeInstanceOf(ViteProductTerminationError)
    expect(state.report.status).toBe('interrupted')
    expect(state.scope.seal).toHaveBeenCalledTimes(1)
    expect(state.scope.complete).not.toHaveBeenCalled()
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(143)
    held.resolve()
  })

  it('retains both execution and scope failures without claiming fixture or lease release', async () => {
    const state = harness()
    const original = new Error('Product assertion failed')
    const scopeError = new Error('Scope completion failed')
    state.execute.mockRejectedValueOnce(original)
    state.scope.complete.mockRejectedValueOnce(scopeError)
    await expect(withViteProductOwnership(state.lease, state.options)).rejects.toMatchObject({ cause: expect.objectContaining({ errors: [original, scopeError] }) })
    expect(state.report).toMatchObject({ status: 'failed', ownership: { scope: 'sealed' }, cleanup: { status: 'unconfirmed' }, error: { errors: [{ message: original.message }, { message: scopeError.message }] } })
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('records a failed seal and still exits unsuccessfully when report persistence also fails', async () => {
    const state = harness()
    const sealError = new Error('Scope sealing failed')
    const reportError = new Error('Report persistence failed')
    state.pending.push('pending-fixture')
    state.scope.seal.mockRejectedValue(sealError)
    state.persist.mockRejectedValueOnce(reportError)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(withViteProductOwnership(state.lease, state.options)).rejects.toBeInstanceOf(ViteProductTerminationError)
    expect(state.report).toMatchObject({ cleanup: { status: 'unconfirmed', sealError: { message: String(sealError) } } })
    expect(log).toHaveBeenCalledWith(expect.any(String), reportError)
    expect(state.scope.complete).not.toHaveBeenCalled()
    expect(state.exit).toHaveBeenCalledExactlyOnceWith(1)
  })
})
