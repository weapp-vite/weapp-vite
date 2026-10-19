import type { SuiteReportContext } from '../suiteReport'
import type { SuiteTask } from '../suiteRunner'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_MAX_WINDOWS_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { runTaskSuite } from '../suiteRunner'

const mocks = vi.hoisted(() => ({
  journal: vi.fn(),
  cleanup: vi.fn(),
  claim: vi.fn(),
  quit: vi.fn(),
  report: vi.fn(),
  validate: vi.fn(),
  recorder: vi.fn(),
  initialize: vi.fn(),
  beforeTask: vi.fn(),
  beforeCleanup: vi.fn(),
  finish: vi.fn(),
}))
vi.mock('../../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../utils/devtoolsScopeCleanup', () => ({ cleanupDevtoolsCommandScope: mocks.cleanup }))
vi.mock('../../utils/devtoolsHostLifecycle', () => ({ DEVTOOLS_HOST_CLAIMED_ENV: 'WEAPP_VITE_E2E_DEVTOOLS_HOST_CLAIMED', claimDevtoolsHost: mocks.claim, quitClaimedDevtoolsHost: mocks.quit }))
vi.mock('../../utils/devtoolsTaskResources', () => ({ createTaskResourceRecorder: mocks.recorder }))
vi.mock('../suiteReport', () => ({ createSuiteReport: mocks.report }))
vi.mock('../domAcceptanceReport/task', () => ({ validateTaskAcceptance: mocks.validate }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', () => ({
  withMachineE2ELease: async <T>(run: (lease: unknown) => Promise<T>) => run({ createChildScope: async () => ({ environment: {}, seal: async () => {} }) }),
}))

let previousExitCode: typeof process.exitCode
const hostLease = { target: {}, initial: { state: 'cold', identities: [] }, claimedAt: 'now' }
const hostExit = { after: { state: 'cold', identities: [] }, quitDispatched: true }
const artifactPath = path.resolve('resource-evidence.json')

function task(label = 'ide/resource.runtime.test.ts'): SuiteTask {
  return { label, command: 'pnpm', args: ['vitest', 'run', '-c', 'e2e/vitest.e2e.devtools.config.ts'] }
}

function context(tasks: SuiteTask[]): SuiteReportContext {
  return { runId: 'resource-evidence-unit', commitSha: 'a'.repeat(40), workingTreeDirty: false, partial: false, strict: true, plannedTasks: tasks }
}

beforeEach(() => {
  previousExitCode = process.exitCode
  process.exitCode = undefined
  vi.resetAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.journal.mockResolvedValue(path.resolve('owned-journal'))
  mocks.claim.mockResolvedValue(hostLease)
  mocks.quit.mockResolvedValue(hostExit)
  mocks.recorder.mockReturnValue({ environment: {}, initialize: mocks.initialize, beforeTask: mocks.beforeTask, beforeCleanup: mocks.beforeCleanup, finish: mocks.finish })
  mocks.finish.mockResolvedValue({ indexPath: artifactPath, errors: [] })
  mocks.report.mockReturnValue({ reportDir: path.resolve('owned-report'), markdownFile: 'index.md', summary: { taskCount: 1, failedCount: 0, artifactCount: 1 } })
})
afterEach(() => {
  process.exitCode = previousExitCode
  vi.restoreAllMocks()
})

describe('suite runner task resource evidence', () => {
  it('links the task resource attachment and reuses the host cleanup return value', async () => {
    const tasks = [{ ...task(), env: { [MANAGED_PROJECT_MAX_WINDOWS_ENV]: '2' } }]
    expect(await runTaskSuite('resource-unit', tasks, { runTask: async () => 0, reportContext: context(tasks) })).toBe(0)
    expect(mocks.recorder).toHaveBeenCalledWith(expect.objectContaining({ env: expect.objectContaining({ [MANAGED_PROJECT_MAX_WINDOWS_ENV]: '2' }) }))
    expect(mocks.finish).toHaveBeenCalledWith({ scopeError: undefined, hostError: undefined, hostExit }, [])
    expect(mocks.report.mock.calls[0]![0]).toMatchObject([{ status: 'passed', artifacts: [{ kind: 'ide-task-resource-report', indexPath: artifactPath }] }])
    expect(mocks.quit).toHaveBeenCalledExactlyOnceWith(hostLease)
  })

  it('keeps both cleanup phases even when the diagnostic sampler and runtime fail', async () => {
    const tasks = [task()]
    const order: string[] = []
    mocks.beforeCleanup.mockImplementation(async () => {
      order.push('observe')
      throw new Error('sampling unavailable')
    })
    mocks.cleanup.mockImplementation(async () => {
      order.push('scope')
      throw new Error('scope cleanup failed')
    })
    mocks.quit.mockImplementation(async () => {
      order.push('quit')
      throw new Error('host exit failed')
    })
    mocks.finish.mockImplementation(async () => {
      order.push('finish')
      return { errors: ['attachment incomplete'] }
    })
    expect(await runTaskSuite('resource-unit', tasks, {
      reportContext: context(tasks),
      runTask: async () => { throw new Error('runtime first error') },
    })).toBe(1)
    expect(order).toEqual(['observe', 'scope', 'quit', 'finish'])
    const [result] = mocks.report.mock.calls[0]![0]
    expect(result.reason).toMatch(/^runtime first error;/)
    expect(result.reason).toContain('scope cleanup failed')
    expect(result.reason).toContain('host exit failed')
    expect(mocks.finish.mock.calls[0]![1]).toEqual([expect.stringContaining('sampling unavailable')])
  })

  it('cannot declare strict acceptance complete when the required resource file cannot be written', async () => {
    const tasks = [task()]
    mocks.finish.mockResolvedValue({ errors: ['resource attachment write failed'] })
    expect(await runTaskSuite('resource-unit', tasks, {
      runTask: async () => 0,
      failOnTaskFailure: false,
      reportContext: context(tasks),
    })).toBe(1)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
    expect(mocks.quit).toHaveBeenCalledOnce()
    expect(mocks.report.mock.calls[0]![0]).toMatchObject([{ status: 'blocked', reason: expect.stringContaining('resource attachment write failed') }])
  })

  it('continues after ordinary diagnostic failure under allow-failures while preserving its failed acceptance', async () => {
    const tasks = [task('first'), task('second')]
    mocks.finish.mockResolvedValueOnce({ errors: ['resource file missing'] }).mockResolvedValueOnce({ indexPath: artifactPath, errors: [] })
    const runTask = vi.fn(async () => 0)
    expect(await runTaskSuite('resource-unit', tasks, {
      runTask,
      failOnTaskFailure: false,
      stopOnTaskFailure: false,
      reportContext: context(tasks),
    })).toBe(1)
    expect(runTask).toHaveBeenCalledTimes(2)
    expect(mocks.report.mock.calls[0]![0]).toMatchObject([{ status: 'blocked' }, { status: 'passed' }])
  })

  it.each([false, true])('stops after an unclaimed host under allow-failures with a callback=%s', async (withCallback) => {
    const tasks = [task('blocked-host'), task('must-not-start')]
    const mismatch = Object.assign(new Error('Cannot claim selected host; preserve the existing host'), { code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
    mocks.claim.mockRejectedValueOnce(mismatch)
    const runTask = vi.fn(async () => 0)
    const onUnsafeRuntime = withCallback ? vi.fn() : undefined
    expect(await runTaskSuite('resource-unit', tasks, {
      runTask,
      failOnTaskFailure: false,
      stopOnTaskFailure: false,
      onUnsafeRuntime,
      reportContext: context(tasks),
    })).toBe(1)
    expect(runTask).not.toHaveBeenCalled()
    expect(mocks.claim).toHaveBeenCalledOnce()
    expect(mocks.cleanup).toHaveBeenCalledOnce()
    expect(mocks.quit).not.toHaveBeenCalled()
    expect(tasks[0]!.unsafeRuntimeReason).toBe(mismatch.message)
    expect(mocks.report.mock.calls[0]![0]).toMatchObject([{ status: 'blocked', reason: mismatch.message }])
    if (onUnsafeRuntime) {
      expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(mismatch.message)
    }
  })
})
