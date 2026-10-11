import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REPO_ROOT } from './context'
import { runLifecycleEntry } from './entry'

const mocks = vi.hoisted(() => ({ owned: vi.fn(), checks: vi.fn(), worker: vi.fn(), nested: vi.fn(), lease: vi.fn() }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', () => ({ withMachineE2ELease: mocks.lease }))
vi.mock('../ownedE2ECommand', () => ({ runOwnedE2ECommand: mocks.owned }))
vi.mock('./run', () => ({ runLifecycleChecks: mocks.checks }))
vi.mock('./worker', () => ({ runLifecycleWorker: mocks.worker }))
vi.mock('./nestedRunner/worker', () => ({ runNestedLifecycleWorker: mocks.nested }))

const scriptPath = path.join(REPO_ROOT, 'e2e/scripts/check-devtools-project-lifecycle.ts')

describe('standalone DevTools lifecycle ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', '')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', '')
    mocks.owned.mockResolvedValue(0)
    mocks.lease.mockImplementation(async run => await run())
  })
  afterEach(() => vi.unstubAllEnvs())

  it('keeps the parent responsible until its child and journal cleanup finish', async () => {
    const pending = Promise.withResolvers<number>()
    mocks.owned.mockReturnValue(pending.promise)
    const signal = new AbortController().signal
    let completed = false
    const running = runLifecycleEntry(scriptPath, [], signal).then((code) => {
      completed = true
      return code
    })
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(mocks.checks).not.toHaveBeenCalled()
    expect(mocks.worker).not.toHaveBeenCalled()
    expect(mocks.owned).toHaveBeenCalledExactlyOnceWith(process.execPath, ['--import', 'tsx', scriptPath, '--run'], { cwd: REPO_ROOT, signal })
    pending.resolve(7)
    expect(await running).toBe(7)
  })

  it('does not report success or retry when the parent retains unfinished cleanup', async () => {
    const failure = new Error('Runtime busy: E2E command cleanup remains unfinished')
    mocks.owned.mockRejectedValue(failure)
    await expect(runLifecycleEntry(scriptPath, [], new AbortController().signal)).rejects.toBe(failure)
    expect(mocks.owned).toHaveBeenCalledOnce()
    expect(mocks.checks).not.toHaveBeenCalled()
  })

  it.each([['--run'], ['--worker', '{}'], ['--nested-runner', '{}']])('rejects an internal entry without inherited ownership: %j', async (...args) => {
    const signal = new AbortController().signal
    await expect(runLifecycleEntry(scriptPath, args, signal)).rejects.toThrow('inherited machine lease')
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'inherited-credential')
    await expect(runLifecycleEntry(scriptPath, args, signal)).rejects.toThrow('explicit task journal')
    expect(mocks.checks).not.toHaveBeenCalled()
    expect(mocks.worker).not.toHaveBeenCalled()
    expect(mocks.nested).not.toHaveBeenCalled()
    expect(mocks.owned).not.toHaveBeenCalled()
  })

  it('executes the inherited run once and preserves its failure for parent recovery', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'inherited-credential')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'inherited-journal')
    const failure = new Error('window-close evidence remains incomplete')
    mocks.checks.mockRejectedValue(failure)
    const signal = new AbortController().signal
    await expect(runLifecycleEntry(scriptPath, ['--run'], signal)).rejects.toBe(failure)
    expect(mocks.checks).toHaveBeenCalledExactlyOnceWith(signal, scriptPath)
    expect(mocks.owned).not.toHaveBeenCalled()
  })

  it.each([['--run'], ['--worker', '{}'], ['--nested-runner', '{}']])('validates inherited ownership before journal creation or IDE work: %j', async (...args) => {
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'stale-or-invalid-credential')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'inherited-journal')
    const failure = new Error('Runtime busy: inherited E2E lease is invalid')
    mocks.lease.mockRejectedValue(failure)
    await expect(runLifecycleEntry(scriptPath, args, new AbortController().signal)).rejects.toBe(failure)
    expect(mocks.checks).not.toHaveBeenCalled()
    expect(mocks.worker).not.toHaveBeenCalled()
    expect(mocks.nested).not.toHaveBeenCalled()
  })

  it('preserves the intentional worker SIGKILL route without adding another command parent', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'inherited-credential')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'worker-journal')
    expect(await runLifecycleEntry(scriptPath, ['--worker', '{}'], new AbortController().signal)).toBe(0)
    expect(mocks.worker).toHaveBeenCalledExactlyOnceWith('{}')
    expect(mocks.owned).not.toHaveBeenCalled()
    expect(mocks.checks).not.toHaveBeenCalled()
  })

  it('runs the nested suite worker without creating another command parent', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'inherited-credential')
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'runner-journal')
    expect(await runLifecycleEntry(scriptPath, ['--nested-runner', '{}'], new AbortController().signal)).toBe(0)
    expect(mocks.nested).toHaveBeenCalledExactlyOnceWith('{}')
    expect(mocks.owned).not.toHaveBeenCalled()
    expect(mocks.worker).not.toHaveBeenCalled()
    expect(mocks.checks).not.toHaveBeenCalled()
  })

  it.each([['--unknown'], ['--run', 'unexpected'], ['--worker'], ['--nested-runner']])('rejects malformed entry arguments: %j', async (...args) => {
    await expect(runLifecycleEntry(scriptPath, args, new AbortController().signal)).rejects.toThrow('Only internal lifecycle modes')
    expect(mocks.owned).not.toHaveBeenCalled()
    expect(mocks.checks).not.toHaveBeenCalled()
    expect(mocks.worker).not.toHaveBeenCalled()
  })
})
