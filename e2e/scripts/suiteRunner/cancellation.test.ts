import type { SuiteTask } from '../suiteRunner'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runTaskSuite } from '../suiteRunner'

const mocks = vi.hoisted(() => ({
  execa: vi.fn(),
  cleanup: vi.fn(),
  journal: vi.fn(),
  lease: vi.fn(),
  seal: vi.fn(),
  stop: vi.fn(),
  scope: vi.fn(),
}))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', () => ({ withMachineE2ELease: mocks.lease }))
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  cleanupManagedWechatProjects: mocks.cleanup,
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
}))
vi.mock('../../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../ownedE2ECommand/shutdown', async original => ({
  ...await original<typeof import('../ownedE2ECommand/shutdown')>(),
  stopOwnedCommand: mocks.stop,
}))

const tasks: SuiteTask[] = [
  { label: 'owned-worker', command: 'fixture-command', args: [] },
  { label: 'must-not-start', command: 'fixture-command', args: [] },
]
const options = {
  writeReport: false,
  failOnTaskFailure: false,
  stopOnTaskFailure: false,
  reportContext: { runId: 'cancel-test', commitSha: 'fixture-commit', workingTreeDirty: false, partial: false, strict: false, plannedTasks: tasks },
}
type Signal = 'SIGINT' | 'SIGTERM'
let originalHandlers: Record<Signal, ReturnType<typeof process.listeners>>
let originalExitCode: typeof process.exitCode

function signalRunner(signal: Signal) {
  const handlers = process.listeners(signal).filter(handler => !originalHandlers[signal].includes(handler))
  expect(handlers).toHaveLength(1)
  ;(handlers[0] as () => void)()
}

function childFixture() {
  const completion = Promise.withResolvers<{ exitCode: number }>()
  const nodeChildProcess = Object.assign(new EventEmitter(), { pid: process.pid })
  const kill = vi.fn()
  const child = Object.assign(completion.promise, { nodeChildProcess, kill, stdout: null, stderr: null })
  return {
    child,
    kill,
    exit(code = 0) {
      nodeChildProcess.emit('exit', code)
      completion.resolve({ exitCode: code })
    },
  }
}

beforeEach(() => {
  originalHandlers = { SIGINT: process.listeners('SIGINT'), SIGTERM: process.listeners('SIGTERM') }
  originalExitCode = process.exitCode
  process.exitCode = undefined
  vi.resetAllMocks()
  vi.useFakeTimers()
  mocks.journal.mockResolvedValue('owned-task-journal')
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.seal.mockResolvedValue(undefined)
  mocks.stop.mockImplementation(async (child) => {
    child.kill('SIGTERM')
    await new Promise<void>(resolve => setTimeout(resolve, 5_000))
    child.kill('SIGKILL')
  })
  mocks.lease.mockImplementation(async run => await run({
    createChildScope: mocks.scope,
  }))
  mocks.scope.mockResolvedValue({ environment: {}, recoverStoppedDescendants: async () => {}, seal: mocks.seal, complete: async () => {} })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  expect(process.listeners('SIGINT')).toEqual(originalHandlers.SIGINT)
  expect(process.listeners('SIGTERM')).toEqual(originalHandlers.SIGTERM)
  process.exitCode = originalExitCode
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('suite runner cancellation ownership', () => {
  it.each([['SIGINT', 130], ['SIGTERM', 143]] as const)('awaits child exit and journal cleanup after %s even when task failures are allowed', async (signal, code) => {
    const worker = childFixture()
    const started = Promise.withResolvers<void>()
    const cleanupStarted = Promise.withResolvers<void>()
    const cleanupFinished = Promise.withResolvers<void>()
    const afterAll = vi.fn()
    mocks.execa.mockImplementation(() => {
      started.resolve()
      return worker.child
    })
    mocks.cleanup.mockImplementation(async () => {
      cleanupStarted.resolve()
      await cleanupFinished.promise
    })
    let settled = false
    const running = runTaskSuite('e2e:cancel-test', tasks, { ...options, afterAll }).finally(() => {
      settled = true
    })

    try {
      await started.promise
      signalRunner(signal)
      signalRunner(signal)
      signalRunner(signal === 'SIGINT' ? 'SIGTERM' : 'SIGINT')
      expect(worker.kill.mock.calls).toEqual([['SIGTERM']])
      expect(mocks.cleanup).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(5_000)
      expect(worker.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']])
      expect(settled).toBe(false)
      expect(mocks.cleanup).not.toHaveBeenCalled()

      worker.exit()
      await cleanupStarted.promise
      expect(settled).toBe(false)
      expect(afterAll).not.toHaveBeenCalled()
      signalRunner(signal)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(worker.kill).toHaveBeenCalledTimes(2)
      expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith({ journalPath: 'owned-task-journal', scope: 'journal' })
      cleanupFinished.resolve()
      expect(await running).toBe(code)
      expect(process.exitCode).toBe(code)
      expect(afterAll).toHaveBeenCalledOnce()
      expect(mocks.execa).toHaveBeenCalledOnce()
      expect(mocks.execa.mock.calls[0]![2]).toMatchObject({ killDescendants: true, killSignal: 'SIGKILL', forceKillAfterDelay: false })
    }
    finally {
      worker.exit()
      cleanupFinished.resolve()
      await vi.advanceTimersByTimeAsync(5_000)
      await running
    }
  })

  it('still clears the held process group after the entry exits during graceful cancellation', async () => {
    const worker = childFixture()
    const started = Promise.withResolvers<void>()
    mocks.execa.mockImplementation(() => {
      started.resolve()
      return worker.child
    })
    const running = runTaskSuite('e2e:cancel-tree-test', tasks, options)
    try {
      await started.promise
      signalRunner('SIGINT')
      worker.exit()
      await vi.advanceTimersByTimeAsync(4_999)
      expect(mocks.cleanup).not.toHaveBeenCalled()
      expect(worker.kill.mock.calls).toEqual([['SIGTERM']])
      await vi.advanceTimersByTimeAsync(1)
      expect(await running).toBe(130)
      expect(worker.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']])
      expect(mocks.cleanup).toHaveBeenCalledOnce()
    }
    finally {
      worker.exit()
      await vi.advanceTimersByTimeAsync(5_000)
      await running
    }
  })

  it('cancels before child creation when interrupted during the preflight hook', async () => {
    const beforeEachTask = vi.fn(async () => {
      signalRunner('SIGTERM')
    })
    expect(await runTaskSuite('e2e:cancel-preflight-test', tasks, { ...options, beforeEachTask })).toBe(143)
    expect(beforeEachTask).toHaveBeenCalledOnce()
    expect(mocks.execa).not.toHaveBeenCalled()
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it('cancels during cleanup without closing a finished child twice or starting another task', async () => {
    const cleanupStarted = Promise.withResolvers<void>()
    const cleanupFinished = Promise.withResolvers<void>()
    const runTask = vi.fn(async () => 0)
    mocks.cleanup.mockImplementation(async () => {
      cleanupStarted.resolve()
      await cleanupFinished.promise
    })
    const running = runTaskSuite('e2e:cancel-cleanup-test', tasks, { ...options, runTask })
    try {
      await cleanupStarted.promise
      signalRunner('SIGINT')
      signalRunner('SIGINT')
    }
    finally {
      cleanupFinished.resolve()
      expect(await running).toBe(130)
    }
    expect(runTask).toHaveBeenCalledOnce()
    expect(mocks.execa).not.toHaveBeenCalled()
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it('removes only its handlers after a normal run', async () => {
    expect(await runTaskSuite('e2e:normal-test', tasks, { ...options, runTask: async () => 0 })).toBe(0)
    expect(process.exitCode).toBeUndefined()
    expect(mocks.cleanup).toHaveBeenCalledTimes(2)
  })

  it('restores handlers when the final cleanup hook throws', async () => {
    const failure = new Error('afterAll cleanup failed')
    await expect(runTaskSuite('e2e:cleanup-throw-test', tasks.slice(0, 1), {
      ...options,
      runTask: async () => 0,
      afterAll: async () => { throw failure },
    })).rejects.toBe(failure)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it('restores handlers when another owner holds the machine lease', async () => {
    const failure = new Error('Runtime busy')
    mocks.lease.mockRejectedValueOnce(failure)
    await expect(runTaskSuite('e2e:lease-busy-test', tasks, options)).rejects.toBe(failure)
    expect(mocks.execa).not.toHaveBeenCalled()
    expect(mocks.journal).not.toHaveBeenCalled()
  })

  it('does not leave a task scope when journal preparation fails', async () => {
    mocks.journal.mockRejectedValueOnce(new Error('journal storage unavailable'))
    const runTask = vi.fn(async () => 0)
    expect(await runTaskSuite('e2e:journal-unavailable', tasks.slice(0, 1), { ...options, runTask })).toBe(1)
    expect(mocks.scope).not.toHaveBeenCalled()
    expect(runTask).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })

  it('blocks parent journal cleanup and the next task while the task scope has a live borrower', async () => {
    mocks.seal.mockRejectedValue(new Error('child is still running'))
    const runTask = vi.fn(async () => 0)
    expect(await runTaskSuite('e2e:live-child-scope', tasks, { ...options, runTask })).toBe(1)
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(runTask).toHaveBeenCalledOnce()
  })
})
