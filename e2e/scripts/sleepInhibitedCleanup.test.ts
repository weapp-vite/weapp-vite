import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runSleepInhibitedE2ESuite } from './run-sleep-inhibited-e2e-suite'
import { runTaskSuite } from './suiteRunner'

const mocks = vi.hoisted(() => ({
  suite: vi.fn(),
  matrix: vi.fn(),
  hmr: vi.fn(),
  inhibitor: vi.fn(),
  close: vi.fn(),
  cleanup: vi.fn(),
  lease: vi.fn(),
}))
vi.mock('./run-e2e-suite', () => ({ runE2ESuiteCli: mocks.suite }))
vi.mock('./run-devtools-matrix', () => ({ runDevtoolsMatrixCli: mocks.matrix }))
vi.mock('./run-hmr-acceptance', () => ({ runHmrAcceptanceCli: mocks.hmr }))
vi.mock('./sleepInhibitedE2E/inhibitor', () => ({ startSleepInhibitor: mocks.inhibitor }))
vi.mock('../../packages/devtools-runtime/src/lease/machine', () => ({ withMachineE2ELease: mocks.lease }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  cleanupManagedWechatProjects: mocks.cleanup,
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
}))
vi.mock('../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: async () => 'owned-journal' }))

type Signal = 'SIGINT' | 'SIGTERM'
let originalHandlers: Record<Signal, ReturnType<typeof process.listeners>>
let originalExitCode: typeof process.exitCode

function interrupt(signal: Signal) {
  const handlers = process.listeners(signal).filter(handler => !originalHandlers[signal].includes(handler))
  expect(handlers).toHaveLength(1)
  ;(handlers[0] as () => void)()
}

beforeEach(() => {
  originalExitCode = process.exitCode
  originalHandlers = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') }
  process.exitCode = undefined
  vi.resetAllMocks()
  mocks.inhibitor.mockResolvedValue({ close: mocks.close, failure: Promise.resolve(undefined) })
  mocks.close.mockResolvedValue(undefined)
  mocks.lease.mockImplementation(async run => await run({
    createChildScope: async () => ({ environment: {}, seal: async () => {}, recoverStoppedDescendants: async () => {}, complete: async () => {} }),
  }))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  expect(process.listeners('SIGINT')).toEqual(originalHandlers.SIGINT)
  expect(process.listeners('SIGTERM')).toEqual(originalHandlers.SIGTERM)
  process.exitCode = originalExitCode
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sleep-inhibited in-process cleanup', () => {
  it.each([
    { args: ['ide-full', '--allow-failures'], selected: 'suite', forwarded: ['ide-full', '--allow-failures'] },
    { args: ['devtools-matrix', '--targets=stable'], selected: 'matrix', forwarded: ['--targets=stable'] },
    { args: ['hmr-acceptance', 'ide'], selected: 'hmr', forwarded: ['ide'] },
  ] as const)('calls the official $selected entry in the current process', async ({ args, selected, forwarded }) => {
    mocks[selected].mockResolvedValue(selected === 'matrix' ? { exitCode: 0 } : 0)
    await runSleepInhibitedE2ESuite([...args])
    expect(mocks[selected]).toHaveBeenCalledExactlyOnceWith([...forwarded], { signal: expect.any(AbortSignal) })
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(process.exitCode).toBe(0)
  })

  it('keeps the runner, lease and inhibitor alive beyond the former shutdown deadline', async () => {
    vi.useFakeTimers()
    const cleanupStarted = Promise.withResolvers<void>()
    const events: string[] = []
    const runTask = vi.fn(async () => 0)
    mocks.cleanup.mockImplementation(async () => {
      events.push('cleanup-start')
      cleanupStarted.resolve()
      await new Promise(resolve => setTimeout(resolve, 15_000))
      events.push('cleanup-finished')
    })
    mocks.lease.mockImplementation(async (run) => {
      const result = await run({
        createChildScope: async () => ({ environment: {}, seal: async () => {}, recoverStoppedDescendants: async () => {}, complete: async () => {} }),
      })
      events.push('lease-released')
      return result
    })
    mocks.close.mockImplementation(async () => {
      events.push('inhibitor-closed')
    })
    mocks.suite.mockImplementation(async (_args, { signal }: { signal: AbortSignal }) => await runTaskSuite('e2e:cancel-boundary', [
      { label: 'finished-task', command: 'unused', args: [] },
      { label: 'must-not-start', command: 'unused', args: [] },
    ], { signal, runTask, writeReport: false, afterAll: () => { events.push('after-all') } }))
    let settled = false
    const running = runSleepInhibitedE2ESuite(['ide-full']).finally(() => {
      settled = true
    })
    try {
      await cleanupStarted.promise
      interrupt('SIGINT')
      interrupt('SIGTERM')
      interrupt('SIGINT')
      await vi.advanceTimersByTimeAsync(10_001)
      expect(settled).toBe(false)
      expect(events).toEqual(['cleanup-start'])
      expect(mocks.close).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(4_999)
      await running
      expect(events).toEqual(['cleanup-start', 'cleanup-finished', 'after-all', 'lease-released', 'inhibitor-closed'])
      expect(runTask).toHaveBeenCalledOnce()
      expect(process.exitCode).toBe(130)
    }
    finally {
      await vi.advanceTimersByTimeAsync(15_000)
      await running
    }
  })

  it('retains preflight cancellation when the runner is initialized later', async () => {
    const preflightStarted = Promise.withResolvers<void>()
    const preflightFinished = Promise.withResolvers<void>()
    const runTask = vi.fn(async () => 0)
    mocks.suite.mockImplementation(async (_args, { signal }: { signal: AbortSignal }) => {
      preflightStarted.resolve()
      await preflightFinished.promise
      return await runTaskSuite('e2e:late-runner', [{ label: 'must-not-start', command: 'unused', args: [] }], { signal, runTask, writeReport: false })
    })
    const running = runSleepInhibitedE2ESuite(['ide-full'])
    await preflightStarted.promise
    interrupt('SIGTERM')
    preflightFinished.resolve()
    await running
    expect(runTask).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(143)
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('captures cancellation before asynchronous inhibitor startup and import', async () => {
    const startup = Promise.withResolvers<{ close: typeof mocks.close, failure: Promise<undefined> }>()
    mocks.inhibitor.mockReturnValue(startup.promise)
    const running = runSleepInhibitedE2ESuite(['ide-full'])
    interrupt('SIGINT')
    startup.resolve({ close: mocks.close, failure: Promise.resolve(undefined) })
    await running
    expect(mocks.suite).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(process.exitCode).toBe(130)
  })

  it('preserves CLI cleanup errors together with inhibitor cleanup errors', async () => {
    const failure = new Error('project window is still present')
    const sidecarFailure = new Error('inhibitor cleanup failed')
    mocks.suite.mockRejectedValue(failure)
    mocks.close.mockRejectedValue(sidecarFailure)
    const error = await runSleepInhibitedE2ESuite(['ide-full']).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toEqual([failure, sidecarFailure])
    expect((error as AggregateError).cause).toBe(failure)
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('cancels on an early inhibitor exit and awaits the same CLI cleanup', async () => {
    const failure = new Error('inhibitor exited early')
    const inhibitorFailed = Promise.withResolvers<Error>()
    const entered = Promise.withResolvers<AbortSignal>()
    const cleaned = Promise.withResolvers<void>()
    mocks.inhibitor.mockResolvedValue({ close: mocks.close, failure: inhibitorFailed.promise })
    mocks.close.mockRejectedValue(failure)
    mocks.suite.mockImplementation(async (_args, { signal }: { signal: AbortSignal }) => {
      entered.resolve(signal)
      await cleaned.promise
      return 1
    })
    const running = runSleepInhibitedE2ESuite(['ide-full'])
    const rejected = expect(running).rejects.toBe(failure)
    const signal = await entered.promise
    inhibitorFailed.resolve(failure)
    await Promise.resolve()
    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBe(failure)
    expect(mocks.close).not.toHaveBeenCalled()
    cleaned.resolve()
    await rejected
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('preserves startup errors without importing a CLI or losing signal handlers', async () => {
    const failure = new Error('caffeinate unavailable')
    mocks.inhibitor.mockRejectedValue(failure)
    await expect(runSleepInhibitedE2ESuite(['ide-full'])).rejects.toBe(failure)
    expect(mocks.suite).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
  })
})
