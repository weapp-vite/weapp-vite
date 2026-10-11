import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runSleepInhibitedE2ESuite } from './run-sleep-inhibited-e2e-suite'

const mocks = vi.hoisted(() => ({ run: vi.fn(), scope: vi.fn() }))
vi.mock('./ownedE2ECommand', () => ({ runOwnedE2ECommand: mocks.run }))
vi.mock('./suiteRunner/signals', () => ({ createSuiteSignalScope: mocks.scope }))

describe('sleep-inhibited outer cleanup', () => {
  const originalExitCode = process.exitCode
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    process.exitCode = originalExitCode
    vi.restoreAllMocks()
  })

  it('keeps cancellation handlers installed until the owned command cleanup completes', async () => {
    const finished = Promise.withResolvers<number>()
    const controller = new AbortController()
    const scope = { signal: controller.signal, exitCode: undefined as number | undefined, dispose: vi.fn() }
    mocks.scope.mockReturnValue(scope)
    mocks.run.mockReturnValue(finished.promise)
    const running = runSleepInhibitedE2ESuite(['ide-full'])
    expect(mocks.run).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['ide-full']), { signal: controller.signal })
    controller.abort()
    scope.exitCode = 130
    expect(scope.dispose).not.toHaveBeenCalled()
    finished.resolve(1)
    await running
    expect(process.exitCode).toBe(130)
    expect(scope.dispose).toHaveBeenCalledOnce()
  })

  it('preserves an incomplete cleanup error and removes only its own signal scope', async () => {
    const failure = new Error('project window is still present')
    const scope = { signal: new AbortController().signal, exitCode: undefined, dispose: vi.fn() }
    mocks.scope.mockReturnValue(scope)
    mocks.run.mockRejectedValue(failure)
    await expect(runSleepInhibitedE2ESuite(['ide-full'])).rejects.toBe(failure)
    expect(scope.dispose).toHaveBeenCalledOnce()
  })
})
