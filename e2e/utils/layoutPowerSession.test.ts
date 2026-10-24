import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_ROOT, DIST_ROOT, prepareLayoutPowerSession, startLayoutPowerSession } from '../ide/layoutPowerDom/session'

const mocks = vi.hoisted(() => ({
  initialBuild: vi.fn(async () => 'classic build ready'),
  waitFor: vi.fn(async <T>(task: Promise<T>) => task),
  stop: vi.fn(async () => {}),
  trackedCleanup: vi.fn(async () => {}),
  template: vi.fn(async () => {}),
  control: vi.fn(async () => ({ url: 'stateful-control' })),
  opened: vi.fn(),
  launch: vi.fn(),
  provider: vi.fn<() => 'devtools' | 'headless'>(),
  ideCleanup: vi.fn(async () => {}),
  miniProgramClose: vi.fn(async () => {}),
  collectorDispose: vi.fn(),
  attachCollector: vi.fn(),
  start: vi.fn(),
}))

vi.mock('weapp-ide-cli', () => ({ resolveProjectAutomatorPort: vi.fn() }))
vi.mock('./automator', () => ({ launchAutomator: mocks.launch }))
vi.mock('./runtimeProvider', () => ({ resolveRuntimeProviderName: mocks.provider }))
vi.mock('./dev-process', () => ({ startDevProcess: mocks.start, cleanupTrackedDevProcesses: mocks.trackedCleanup }))
vi.mock('./dev-process-env', () => ({ createDevProcessEnv: () => ({}) }))
vi.mock('./hmr-helpers', () => ({ waitForFileContains: mocks.template, waitForStatefulHmrControl: mocks.control }))
vi.mock('./ide-devtools-cleanup', () => ({ cleanupResidualIdeProcesses: mocks.ideCleanup }))
vi.mock('./opened-automator', () => ({ waitForOpenedAutomator: mocks.opened }))
vi.mock('../ide/runtimeErrors', () => ({ attachRuntimeErrorCollector: mocks.attachCollector }))

describe('layout power session readiness and cleanup', () => {
  const miniProgram = { close: mocks.miniProgramClose }
  const collector = { dispose: mocks.collectorDispose }

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.initialBuild.mockResolvedValue('classic build ready')
    mocks.waitFor.mockImplementation(async task => task)
    mocks.stop.mockResolvedValue()
    mocks.trackedCleanup.mockResolvedValue()
    mocks.template.mockResolvedValue()
    mocks.control.mockResolvedValue({ url: 'stateful-control' })
    mocks.opened.mockResolvedValue({ miniProgram })
    mocks.launch.mockResolvedValue(miniProgram)
    mocks.provider.mockReturnValue('devtools')
    mocks.ideCleanup.mockResolvedValue()
    mocks.attachCollector.mockReturnValue(collector)
    mocks.start.mockReturnValue({
      waitForInitialBuild: mocks.initialBuild,
      waitFor: mocks.waitFor,
      stop: mocks.stop,
    })
  })

  it('opens a classic session without requiring a stateful control file', async () => {
    mocks.control.mockRejectedValue(new Error('classic has no stateful control'))
    const session = await startLayoutPowerSession()

    expect(session).toMatchObject({ miniProgram, collector })
    expect(mocks.initialBuild).toHaveBeenCalledWith(90_000)
    expect(mocks.template).toHaveBeenCalledWith(path.join(DIST_ROOT, 'pages/index/index.wxml'), 'layout-power-index-page', 90_000)
    expect(mocks.control).not.toHaveBeenCalled()
    expect(mocks.opened).toHaveBeenCalledWith(APP_ROOT, { connectTimeoutMs: 5_000, timeoutMs: 180_000 })
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.start).toHaveBeenCalledWith(process.execPath, [
      path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js'),
      'dev',
      '-o',
      '--ide-open-strategy',
      'automator',
      '--non-interactive',
      '--login-retry',
      'never',
    ], expect.objectContaining({ cwd: APP_ROOT }))
    expect(mocks.initialBuild).toHaveBeenCalledBefore(mocks.template)
    expect(mocks.template).toHaveBeenCalledBefore(mocks.opened)
    await session.close()
  })

  it('starts the headless provider after the initial build without opening DevTools', async () => {
    mocks.provider.mockReturnValue('headless')
    mocks.opened.mockRejectedValue(new Error('headless cannot use an opened IDE'))
    const session = await startLayoutPowerSession()

    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(process.execPath, [
      path.join(APP_ROOT, 'node_modules/weapp-vite/bin/weapp-vite.js'),
      'dev',
      '--non-interactive',
      '--login-retry',
      'never',
    ], expect.objectContaining({ cwd: APP_ROOT }))
    expect(mocks.launch).toHaveBeenCalledExactlyOnceWith({ projectPath: APP_ROOT })
    expect(mocks.opened).not.toHaveBeenCalled()
    expect(mocks.control).not.toHaveBeenCalled()
    expect(mocks.initialBuild).toHaveBeenCalledBefore(mocks.template)
    expect(mocks.template).toHaveBeenCalledBefore(mocks.launch)
    expect(session).toMatchObject({ miniProgram, collector })
    await session.close()
    expect(mocks.collectorDispose).toHaveBeenCalledBefore(mocks.miniProgramClose)
    expect(mocks.miniProgramClose).toHaveBeenCalledBefore(mocks.stop)
    expect(mocks.stop).toHaveBeenCalledBefore(mocks.trackedCleanup)
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })

  it('prepares only this fixture output for headless without touching IDE sessions', async () => {
    mocks.provider.mockReturnValue('headless')
    const remove = vi.spyOn(fs, 'rm').mockResolvedValue(undefined)
    try {
      await prepareLayoutPowerSession()
      expect(remove).toHaveBeenCalledExactlyOnceWith(DIST_ROOT, { recursive: true, force: true })
      expect(mocks.ideCleanup).not.toHaveBeenCalled()
    }
    finally {
      remove.mockRestore()
    }
  })

  it('keeps the explicit stateful control prerequisite for experimental HMR', async () => {
    const session = await startLayoutPowerSession({ requireStatefulHmr: true })

    expect(mocks.control).toHaveBeenCalledWith(path.join(DIST_ROOT, '__weapp_vite_hmr/control.js'), 90_000)
    expect(mocks.control).toHaveBeenCalledBefore(mocks.opened)
    await session.close()
  })

  it('preserves a startup failure and attempts both dev cleanup stages', async () => {
    const startup = new Error('automator unavailable')
    const stop = new Error('dev cleanup failed')
    const tracked = new Error('registered cleanup failed')
    mocks.opened.mockRejectedValue(startup)
    mocks.stop.mockRejectedValue(stop)
    mocks.trackedCleanup.mockRejectedValue(tracked)

    await expect(startLayoutPowerSession()).rejects.toMatchObject({
      cause: startup,
      errors: [startup, stop, tracked],
    })
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
    expect(mocks.stop).toHaveBeenCalledBefore(mocks.trackedCleanup)
    expect(mocks.attachCollector).not.toHaveBeenCalled()
  })

  it('returns the original startup error when cleanup succeeds', async () => {
    const startup = new Error('initial build failed')
    mocks.initialBuild.mockRejectedValue(startup)

    await expect(startLayoutPowerSession()).rejects.toBe(startup)
    expect(mocks.template).not.toHaveBeenCalled()
    expect(mocks.opened).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })

  it('closes an opened automator when collector initialization fails', async () => {
    const startup = new Error('collector unavailable')
    const close = new Error('automator close failed')
    mocks.attachCollector.mockImplementation(() => {
      throw startup
    })
    mocks.miniProgramClose.mockRejectedValue(close)

    await expect(startLayoutPowerSession()).rejects.toMatchObject({ cause: startup, errors: [startup, close] })
    expect(mocks.miniProgramClose).toHaveBeenCalledOnce()
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })

  it('finishes every close stage and preserves errors in cleanup order', async () => {
    const session = await startLayoutPowerSession()
    const dispose = new Error('collector disposal failed')
    const close = new Error('automator close failed')
    const stop = new Error('dev cleanup failed')
    const tracked = new Error('registered cleanup failed')
    mocks.collectorDispose.mockImplementation(() => {
      throw dispose
    })
    mocks.miniProgramClose.mockRejectedValue(close)
    mocks.stop.mockRejectedValue(stop)
    mocks.trackedCleanup.mockRejectedValue(tracked)

    await expect(session.close()).rejects.toMatchObject({ cause: dispose, errors: [dispose, close, stop, tracked] })
    expect(mocks.collectorDispose).toHaveBeenCalledBefore(mocks.miniProgramClose)
    expect(mocks.miniProgramClose).toHaveBeenCalledBefore(mocks.stop)
    expect(mocks.stop).toHaveBeenCalledBefore(mocks.trackedCleanup)
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })

  it('does not suppress a single close failure', async () => {
    const session = await startLayoutPowerSession()
    const stop = new Error('dev cleanup failed')
    mocks.stop.mockRejectedValue(stop)

    await expect(session.close()).rejects.toBe(stop)
    expect(mocks.collectorDispose).toHaveBeenCalledOnce()
    expect(mocks.miniProgramClose).toHaveBeenCalledOnce()
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })

  it('resolves a normal close only after all cleanup stages finish', async () => {
    const session = await startLayoutPowerSession()
    const stopped = Promise.withResolvers<void>()
    mocks.stop.mockReturnValue(stopped.promise)
    const closing = session.close()
    await vi.waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce())
    expect(mocks.trackedCleanup).not.toHaveBeenCalled()
    stopped.resolve()

    await expect(closing).resolves.toBeUndefined()
    expect(mocks.collectorDispose).toHaveBeenCalledOnce()
    expect(mocks.miniProgramClose).toHaveBeenCalledOnce()
    expect(mocks.trackedCleanup).toHaveBeenCalledOnce()
  })
})
