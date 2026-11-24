import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectOpenedAutomator } from '../src/cli/automator'

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  launch: vi.fn(),
  connect: vi.fn(),
  readSession: vi.fn(),
  persistSession: vi.fn(),
  assertHost: vi.fn(),
  assertPort: vi.fn(),
  disconnect: vi.fn(),
  rawClose: vi.fn(),
}))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' }
const projectPath = path.resolve('fixtures/borrowed project')
const wsEndpoint = 'ws://127.0.0.1:19201'

vi.mock('@weapp-vite/miniprogram-automator', () => ({ Launcher: class { connect = mocks.connect; launch = mocks.launch } }))
vi.mock('../src/cli/automator/context', () => ({ resolveAutomatorSessionOptions: async () => ({ target, cliPath: target.cliPath, installationId: target.installationId }) }))
vi.mock('../src/cli/automator/sessionStore', () => ({ persistAutomatorSession: mocks.persistSession, readPersistedAutomatorSession: mocks.readSession }))
vi.mock('../src/devtoolsTarget', () => ({
  assertWechatDevtoolsHost: mocks.assertHost,
  assertWechatDevtoolsPort: mocks.assertPort,
}))
vi.mock('../src/devtoolsProjectOwnership', async importOriginal => ({
  ...await importOriginal<object>(),
  beginManagedWechatProject: mocks.begin,
}))

function makeProgram() {
  return { disconnect: mocks.disconnect, close: mocks.rawClose }
}

describe('connecting to an opened managed automator', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', path.resolve('fixture-journal'))
    mocks.readSession.mockResolvedValue({ wsEndpoint })
    mocks.connect.mockImplementation(async () => makeProgram())
    mocks.launch.mockImplementation(async () => ({
      ...makeProgram(),
      __WEAPP_VITE_SESSION_METADATA: {
        port: 19201,
        wsEndpoint: 'ws://127.0.0.1:19201/',
      },
    }))
    mocks.persistSession.mockResolvedValue(undefined)
    mocks.assertHost.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('only disconnects a borrowed connection when callers close it', async () => {
    const program = await connectOpenedAutomator({ projectPath })

    expect(mocks.disconnect).not.toHaveBeenCalled()
    await program.close()

    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.rawClose).not.toHaveBeenCalled()
    expect(mocks.assertPort).toHaveBeenCalledExactlyOnceWith(target, 19201, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('preserves ordinary close behavior without a managed journal', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', undefined)
    const program = await connectOpenedAutomator({ projectPath })

    await program.close()

    expect(mocks.rawClose).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.disconnect).not.toHaveBeenCalled()
  })

  it('connects without another managed start under the one-window budget', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_MAX_WINDOWS', '1')

    const program = await connectOpenedAutomator({ projectPath, port: 19201 })
    await program.close()

    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.connect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ wsEndpoint }))
    expect(mocks.readSession).toHaveBeenCalledExactlyOnceWith({
      projectPath,
      sessionId: undefined,
      port: 19201,
      installationId: target.installationId,
      signal: expect.any(AbortSignal),
      timeout: expect.any(Number),
    })
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.rawClose).not.toHaveBeenCalled()
  })

  it('disconnects a connection completed after cancellation without closing the project', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled while connecting')
    mocks.connect.mockImplementation(async () => {
      controller.abort(reason)
      return makeProgram()
    })

    await expect(connectOpenedAutomator({ projectPath, signal: controller.signal })).rejects.toBe(reason)

    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.rawClose).not.toHaveBeenCalled()
  })

  it('takes over a manually opened project without granting window close ownership', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', undefined)
    mocks.readSession.mockResolvedValue(null)

    const program = await connectOpenedAutomator({ projectPath, port: 19201, trustProject: true })

    expect(mocks.launch).toHaveBeenCalledExactlyOnceWith({
      cliPath: target.cliPath,
      port: 19201,
      projectPath,
      signal: expect.any(AbortSignal),
      timeout: expect.any(Number),
      trustProject: true,
    })
    expect(mocks.assertHost).toHaveBeenCalledExactlyOnceWith(target, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.assertPort).toHaveBeenCalledExactlyOnceWith(target, 19201, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(mocks.persistSession).toHaveBeenCalledExactlyOnceWith({
      installationId: target.installationId,
      port: 19201,
      projectPath,
      signal: expect.any(AbortSignal),
      wsEndpoint: 'ws://127.0.0.1:19201/',
    })

    await program.close()
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.rawClose).not.toHaveBeenCalled()
  })

  it('persists an unconfigured manual takeover under the default project key', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', undefined)
    mocks.readSession.mockResolvedValue(null)
    mocks.launch.mockResolvedValueOnce({
      ...makeProgram(),
      __WEAPP_VITE_SESSION_METADATA: {
        port: 19201,
        wsEndpoint: 'ws://127.0.0.1:19201/',
      },
    })

    await connectOpenedAutomator({ projectPath })

    expect(mocks.persistSession).toHaveBeenCalledExactlyOnceWith({
      installationId: target.installationId,
      projectPath,
      signal: expect.any(AbortSignal),
      wsEndpoint: 'ws://127.0.0.1:19201/',
    })
  })
})
