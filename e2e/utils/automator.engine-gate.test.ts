import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isLikelyLaunchRetryableError, prebuildAutomatorProjectIndex, refreshMiniProgramProjectIndex } from './automator'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'

const mocks = vi.hoisted(() => ({
  execa: vi.fn(),
  gate: vi.fn(),
  target: vi.fn(),
  httpBuild: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('../../packages/weapp-ide-cli/src/cli/managedProjectGate', () => ({ ensureManagedWechatProject: mocks.gate }))
vi.mock('../../packages/weapp-ide-cli/src/cli/engine', () => ({ runWechatIdeEngineBuildByHttp: mocks.httpBuild }))
vi.mock('../../packages/weapp-ide-cli/src/cli/http', () => ({ openWechatIdeProjectByHttp: vi.fn(), resetWechatIdeFileUtilsByHttp: mocks.reset }))
vi.mock('./devtoolsSelection', () => ({ resolveSelectedWechatDevtools: mocks.target, assertSelectedWechatDevtoolsRuntime: vi.fn() }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

const target = { cliPath: 'selected-cli', appPath: 'selected-app', profileDir: 'selected-profile', installationId: 'selected' }
const projectPath = path.resolve('fixtures/managed-engine-project')
const operations = [
  ['prebuild', (lifecycle?: AutomatorLaunchLifecycle) => prebuildAutomatorProjectIndex(projectPath, 'fixture', { cliPath: target.cliPath, lifecycle })],
  ['refresh fallback', (lifecycle?: AutomatorLaunchLifecycle) => refreshMiniProgramProjectIndex(projectPath, 'fixture', { cliPath: target.cliPath, lifecycle, allowCliEngineBuildFallback: true, engineBuildFallbackSettleMs: 0 })],
] as const

describe('raw engine build managed project gate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', 'task-journal')
    vi.useFakeTimers()
    mocks.execa.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    mocks.gate.mockResolvedValue(undefined)
    mocks.target.mockResolvedValue(target)
    mocks.httpBuild.mockRejectedValue(new Error('Cannot GET /engine/build'))
    mocks.reset.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it.each(operations)('%s cannot execute or become retryable when the project listener check fails', async (name, run) => {
    const cause = new Error('connect ECONNREFUSED; Connection closed, check if wechat web devTools is still running')
    mocks.gate.mockRejectedValue(cause)
    const error = await run().then(() => undefined, (value: unknown) => value)
    expect(error).toMatchObject({ name: 'ManagedEngineBuildGateError', cause })
    expect(isLikelyLaunchRetryableError(error)).toBe(false)
    expect(mocks.gate).toHaveBeenCalledExactlyOnceWith(target, projectPath, { signal: undefined })
    expect(mocks.execa).not.toHaveBeenCalled()
    expect(mocks.httpBuild).toHaveBeenCalledTimes(name === 'prebuild' ? 0 : 1)
  })

  it.each(operations)('%s preserves selected CLI and process options after confirming the project', async (_name, run) => {
    const events: string[] = []
    mocks.gate.mockImplementation(async () => {
      events.push('project-confirmed')
    })
    mocks.execa.mockImplementation(async () => {
      events.push('engine-build')
      return { exitCode: 0, stdout: '', stderr: '' }
    })
    const pending = run()
    await vi.runAllTimersAsync()
    await pending
    expect(events).toEqual(['project-confirmed', 'engine-build'])
    expect(mocks.target).toHaveBeenCalledExactlyOnceWith(target.cliPath)
    expect(mocks.execa).toHaveBeenCalledExactlyOnceWith(target.cliPath, ['engine', 'build', projectPath], {
      cwd: undefined,
      reject: false,
      timeout: 70_000,
      cancelSignal: undefined,
      killDescendants: true,
    })
  })

  it.each(operations)('%s keeps ordinary unmanaged command behavior', async (_name, run) => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', '')
    const pending = run()
    await vi.runAllTimersAsync()
    await pending
    expect(mocks.target).not.toHaveBeenCalled()
    expect(mocks.gate).not.toHaveBeenCalled()
    expect(mocks.execa).toHaveBeenCalledOnce()
  })

  it.each(operations)('%s does not launch after cancellation during project verification', async (_name, run) => {
    const lifecycle = new AutomatorLaunchLifecycle(10_000, 'engine verification')
    const failure = new Error('verification cancelled')
    mocks.gate.mockImplementation(async () => {
      lifecycle.controller.abort(failure)
    })
    await expect(lifecycle.run(scope => run(scope))).rejects.toBe(failure)
    expect(mocks.gate).toHaveBeenCalledWith(target, projectPath, { signal: lifecycle.signal })
    expect(mocks.execa).not.toHaveBeenCalled()
  })

  it('does not start CLI fallback after a non-endpoint HTTP failure', async () => {
    const failure = new Error('managed project ownership is unconfirmed')
    mocks.httpBuild.mockRejectedValue(failure)
    await expect(refreshMiniProgramProjectIndex(projectPath, 'fixture', { cliPath: target.cliPath })).rejects.toBe(failure)
    expect(mocks.gate).not.toHaveBeenCalled()
    expect(mocks.execa).not.toHaveBeenCalled()
  })
})
