import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(async () => {}),
  launch: vi.fn<() => Promise<object>>(),
  provider: vi.fn(() => 'devtools'),
}))

vi.mock('@weapp-core/shared/node', () => ({
  fs: {
    remove: vi.fn(async () => {}),
    ensureDir: vi.fn(async () => {}),
    pathExists: vi.fn(async () => false),
    readJSON: vi.fn(async (file: string): Promise<unknown> => file.endsWith('/app.json')
      ? { pages: ['pages/index/index'] }
      : undefined),
    writeJSON: vi.fn(async () => {}),
  },
}))
vi.mock('../../scripts/testFixtures/configExtends', () => ({
  rebaseTempConfigExtends: vi.fn(async () => {}),
}))
vi.mock('../utils/buildLog', () => ({
  runWeappViteBuildWithLogCapture: vi.fn(async () => {}),
}))
vi.mock('../utils/ide-devtools-cleanup', () => ({
  cleanupResidualIdeProcesses: mocks.cleanup,
}))
vi.mock('../utils/automator', () => ({
  launchAutomator: mocks.launch,
  isDevtoolsSimulatorBootError: vi.fn(() => false),
  isTransientDevtoolsPageMetadataError: vi.fn(() => false),
}))
vi.mock('../utils/ideWarningReport', () => ({
  appendIdeReportEvent: vi.fn(),
  resolveReportProjectPath: vi.fn((project: string) => project),
}))
vi.mock('../utils/runtimeProvider', () => ({
  resolveRuntimeProviderName: mocks.provider,
}))

function createMiniProgram() {
  return {
    close: vi.fn(async () => {}),
    send: vi.fn(async () => ({ version: 'test-version', SDKVersion: 'test-library' })),
  }
}

describe.each(['devtools', 'headless'])('github issues shared launch integration (%s)', (provider) => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.launch.mockReset()
    mocks.provider.mockReturnValue(provider)
  })

  it.each([
    'WeChat DevTools simulator boot error: startup failed before webview page ready',
    'Wechat DevTools login has expired. Please login and retry.',
  ])('preserves the first launch failure without skipping or opening another window: %s', async (message) => {
    const runtime = await import('../ide/github-issues.runtime.shared')
    const failure = new Error(message, { cause: new Error('original launch detail') })
    mocks.launch.mockRejectedValue(failure)
    const context = { skip: vi.fn() }

    await expect(runtime.getSharedMiniProgram(context)).rejects.toBe(failure)
    await expect(runtime.getSharedMiniProgram(context)).rejects.toBe(failure)
    await runtime.closeSharedMiniProgram({ force: true })
    runtime.disconnectSharedMiniProgram({ force: true })
    await expect(runtime.getSharedMiniProgram(context)).rejects.toBe(failure)
    await expect(runtime.launchFreshMiniProgram(context)).rejects.toBe(failure)

    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(context.skip).not.toHaveBeenCalled()
  })

  it('launches once for concurrent acquisition and reuses the same recoverable session', async () => {
    const runtime = await import('../ide/github-issues.runtime.shared')
    const miniProgram = createMiniProgram()
    const deferred = Promise.withResolvers<object>()
    const started = Promise.withResolvers<void>()
    mocks.launch.mockImplementation(() => {
      started.resolve()
      return deferred.promise
    })

    const first = runtime.getSharedMiniProgram()
    const second = runtime.getSharedMiniProgram()
    await started.promise
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    deferred.resolve(miniProgram)
    const [firstSession, secondSession] = await Promise.all([first, second])

    expect(secondSession).toBe(firstSession)
    await expect(runtime.getSharedMiniProgram()).resolves.toBe(firstSession)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    await runtime.closeSharedMiniProgram({ force: true })
    expect(miniProgram.close).toHaveBeenCalledTimes(1)
  })

  it('allows a new successful session after explicit close', async () => {
    const runtime = await import('../ide/github-issues.runtime.shared')
    const first = createMiniProgram()
    const next = createMiniProgram()
    mocks.launch.mockResolvedValueOnce(first).mockResolvedValueOnce(next)

    const previousSession = await runtime.getSharedMiniProgram()
    await runtime.closeSharedMiniProgram({ force: true })
    const currentSession = await runtime.getSharedMiniProgram()

    expect(currentSession === previousSession).toBe(false)
    await expect(runtime.getSharedMiniProgram()).resolves.toBe(currentSession)
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(mocks.launch).toHaveBeenCalledTimes(2)
    await runtime.closeSharedMiniProgram({ force: true })
    expect(next.close).toHaveBeenCalledTimes(1)
  })
})
