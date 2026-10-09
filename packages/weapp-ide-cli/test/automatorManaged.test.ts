import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { launchAutomator, resolveProjectAutomatorPort } from '../src/cli/automator'

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  connect: vi.fn(),
  start: vi.fn(),
  begin: vi.fn(),
  confirm: vi.fn(),
  fail: vi.fn(),
  close: vi.fn(),
  persist: vi.fn(),
  lease: vi.fn(),
  release: vi.fn(),
  assertHost: vi.fn(),
  assertPort: vi.fn(),
  bootstrap: vi.fn(),
  ready: vi.fn(),
  disconnect: vi.fn(),
  rawClose: vi.fn(),
}))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' }
const projectPath = path.resolve('fixtures/managed project')
const journalPath = path.resolve('fixture-journal.json')
const options = { projectPath, port: 19201, target, preserveProjectRoot: true }
const intent = { id: 'fixture-intent', journalPath, confirm: mocks.confirm, fail: mocks.fail, close: mocks.close }

vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => await run() }))
vi.mock('@weapp-vite/miniprogram-automator', () => ({
  Launcher: class { launch = mocks.launch; connect = mocks.connect },
  acquireAutomatorPortLease: mocks.lease,
}))
vi.mock('../src/cli/automator/context', () => ({ resolveAutomatorSessionOptions: async (value: object) => ({ ...value, target, installationId: target.installationId, cliPath: target.cliPath }) }))
vi.mock('../src/config/custom', () => ({ readCustomConfig: async () => ({}) }))
vi.mock('../src/devtoolsTarget', () => ({ assertWechatDevtoolsHost: mocks.assertHost, assertWechatDevtoolsPort: mocks.assertPort }))
vi.mock('../src/devtoolsProjectOwnership', () => ({ beginManagedWechatProject: mocks.begin }))
vi.mock('../src/cli/agentStart', () => ({ startWechatIdeAgent: mocks.start }))
vi.mock('../src/cli/projectImport', () => ({ importManagedDevtoolsProject: vi.fn(async () => {}) }))
vi.mock('../src/cli/wechatDevtoolsSettings', () => ({ bootstrapWechatDevtoolsSettings: mocks.bootstrap }))
vi.mock('../src/cli/automator/sessionStore', () => ({ persistAutomatorSession: mocks.persist, readPersistedAutomatorSession: vi.fn() }))

function makeProgram() {
  return { disconnect: mocks.disconnect, close: mocks.rawClose, waitForAppReady: mocks.ready }
}

describe('managed automator launch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', journalPath)
    mocks.begin.mockResolvedValue(intent)
    mocks.confirm.mockResolvedValue(undefined)
    mocks.close.mockResolvedValue(undefined)
    mocks.fail.mockResolvedValue(undefined)
    mocks.ready.mockResolvedValue(undefined)
    mocks.persist.mockResolvedValue(undefined)
    mocks.release.mockResolvedValue(undefined)
    mocks.lease.mockResolvedValue({ port: options.port, release: mocks.release })
    mocks.connect.mockImplementation(async () => makeProgram())
    mocks.launch.mockImplementation(async () => makeProgram())
    mocks.start.mockImplementation(async ({ port, onStarted }) => {
      const result = { autoPort: port, openedProjectWindow: true, version: '2.02.2608070' }
      await onStarted(result)
      return result
    })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('records the intent before start, verifies the port, connects, waits for app ready and persists metadata', async () => {
    const events: string[] = []
    mocks.begin.mockImplementation(async () => {
      events.push('intent')
      return intent
    })
    mocks.confirm.mockImplementation(async () => {
      events.push('confirmed')
    })
    mocks.assertPort.mockImplementation(async () => {
      events.push('port')
    })
    mocks.connect.mockImplementation(async () => {
      events.push('connect')
      return makeProgram()
    })
    mocks.ready.mockImplementation(async () => {
      events.push('ready')
    })
    mocks.persist.mockImplementation(async () => {
      events.push('persist')
    })

    const program = await launchAutomator({ ...options, sessionId: 'test-worker', trustProject: true })

    expect(events).toEqual(['intent', 'confirmed', 'port', 'connect', 'ready', 'persist'])
    expect(mocks.begin).toHaveBeenCalledExactlyOnceWith({ target, projectPath, port: options.port })
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ target, projectPath, port: options.port, trustProject: true }))
    expect(mocks.connect).toHaveBeenCalledExactlyOnceWith({ wsEndpoint: `ws://127.0.0.1:${options.port}`, signal: expect.any(AbortSignal), timeout: expect.any(Number) })
    expect(mocks.persist).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ projectPath, sessionId: 'test-worker', installationId: target.installationId, port: options.port }))
    expect(Reflect.get(program, '__WEAPP_VITE_SESSION_METADATA')).toEqual({
      projectPath,
      port: options.port,
      wsEndpoint: `ws://127.0.0.1:${options.port}`,
      managedProject: { id: intent.id, journalPath },
    })
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('uses a stable project port and also persists the requested default session', async () => {
    await launchAutomator({ projectPath, target, preserveProjectRoot: true, persistAsDefaultSession: true })
    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ port: resolveProjectAutomatorPort(projectPath) }))
    expect(mocks.persist).toHaveBeenCalledTimes(2)
    expect(mocks.persist).toHaveBeenLastCalledWith({ projectPath, installationId: target.installationId, signal: expect.any(AbortSignal), wsEndpoint: `ws://127.0.0.1:${resolveProjectAutomatorPort(projectPath)}` })
  })

  it.each([true, false])('binds close to the ownership receipt (%s) while disconnect stays independent', async (openedProjectWindow) => {
    mocks.start.mockImplementation(async ({ port, onStarted }) => {
      const result = { autoPort: port, openedProjectWindow, version: '2.02.2608070' }
      await onStarted(result)
      return result
    })
    const program = await launchAutomator(options)
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith({ openedProjectWindow, port: options.port })
    program.disconnect()
    expect(mocks.close).not.toHaveBeenCalled()
    await Promise.all([program.close(), program.close()])
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.rawClose).not.toHaveBeenCalled()
  })

  it.each(['start', 'confirm', 'assertPort', 'connect', 'ready', 'persist'] as const)('cleans up %s failure before returning and never relaunches', async (stage) => {
    const failure = new Error('Wait timed out after 15000 ms')
    mocks[stage].mockRejectedValue(failure)
    await expect(launchAutomator(options)).rejects.toBe(failure)
    expect(mocks.fail).toHaveBeenCalledExactlyOnceWith(failure)
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.disconnect).toHaveBeenCalledTimes(stage === 'ready' || stage === 'persist' ? 1 : 0)
  })

  it('retains an unknown resource failure and refuses to retry startup after cleanup fails', async () => {
    const launchFailure = new Error('agent command returned no complete response')
    const cleanupFailure = new Error('window ownership could not be established')
    mocks.start.mockRejectedValue(launchFailure)
    mocks.close.mockRejectedValue(cleanupFailure)
    await expect(launchAutomator(options)).rejects.toMatchObject({ errors: [launchFailure, cleanupFailure], cause: launchFailure })
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('waits for a late official receipt and full cleanup after cancellation', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled while opening')
    const commandStarted = Promise.withResolvers<void>()
    const receipt = Promise.withResolvers<void>()
    const closeStarted = Promise.withResolvers<void>()
    const cleaned = Promise.withResolvers<void>()
    mocks.start.mockImplementation(async ({ port, onStarted, signal }) => {
      commandStarted.resolve()
      await receipt.promise
      await onStarted({ autoPort: port, openedProjectWindow: true, version: '2.02.2608070' })
      signal.throwIfAborted()
    })
    mocks.close.mockImplementation(async () => {
      closeStarted.resolve()
      await cleaned.promise
    })
    let settled = false
    const pending = launchAutomator({ ...options, signal: controller.signal })
    const assertion = expect(pending).rejects.toBe(reason)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await commandStarted.promise
    controller.abort(reason)
    await Promise.resolve()
    expect(settled).toBe(false)
    receipt.resolve()
    await closeStarted.promise
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith({ openedProjectWindow: true, port: options.port })
    expect(settled).toBe(false)
    expect(mocks.connect).not.toHaveBeenCalled()
    cleaned.resolve()
    await assertion
  })

  it('disconnects a late connection before awaiting project cleanup', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled during connection')
    mocks.connect.mockImplementation(async () => {
      controller.abort(reason)
      return makeProgram()
    })
    await expect(launchAutomator({ ...options, signal: controller.signal })).rejects.toBe(reason)
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(mocks.ready).not.toHaveBeenCalled()
  })

  it('waits beyond the expired launch deadline until the receipt and project cleanup settle', async () => {
    vi.useFakeTimers()
    const started = Promise.withResolvers<void>()
    const receipt = Promise.withResolvers<void>()
    const cleanup = Promise.withResolvers<void>()
    mocks.start.mockImplementation(async ({ port, onStarted, signal }) => {
      started.resolve()
      await receipt.promise
      await onStarted({ autoPort: port, openedProjectWindow: true, version: '2.02.2608070' })
      signal.throwIfAborted()
    })
    mocks.close.mockReturnValue(cleanup.promise)
    let settled = false
    const pending = launchAutomator({ ...options, timeout: 100 })
    const assertion = expect(pending).rejects.toMatchObject({ code: 'DEVTOOLS_OPERATION_TIMEOUT' })
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await started.promise
    await vi.advanceTimersByTimeAsync(100)
    expect(settled).toBe(false)
    receipt.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith({ openedProjectWindow: true, port: options.port })
    expect(mocks.close).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    cleanup.resolve()
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a project if the managed journal is unavailable', async () => {
    mocks.begin.mockResolvedValue(undefined)
    await expect(launchAutomator(options)).rejects.toThrow('DEVTOOLS_MANAGED_PROJECT_JOURNAL_REQUIRED')
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.launch).not.toHaveBeenCalled()
  })

  it('keeps ordinary developer launch behavior when no managed journal is selected', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', undefined)
    await launchAutomator(options)
    expect(mocks.bootstrap).toHaveBeenCalledTimes(1)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('keeps headless launches outside managed IDE ownership even with the journal environment', async () => {
    await launchAutomator({ ...options, runtimeProvider: 'headless' })
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'headless' }))
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.assertHost).not.toHaveBeenCalled()
  })
})
