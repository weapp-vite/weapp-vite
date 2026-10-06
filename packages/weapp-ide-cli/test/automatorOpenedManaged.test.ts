import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectOpenedAutomator } from '../src/cli/automator'

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  connect: vi.fn(),
  readSession: vi.fn(),
  assertPort: vi.fn(),
  disconnect: vi.fn(),
  rawClose: vi.fn(),
}))
const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' }
const projectPath = path.resolve('fixtures/borrowed project')
const wsEndpoint = 'ws://127.0.0.1:19201'

vi.mock('@weapp-vite/miniprogram-automator', () => ({ Launcher: class { connect = mocks.connect } }))
vi.mock('../src/cli/automator/context', () => ({ resolveAutomatorSessionOptions: async () => ({ target, installationId: target.installationId }) }))
vi.mock('../src/cli/automator/sessionStore', () => ({ readPersistedAutomatorSession: mocks.readSession }))
vi.mock('../src/devtoolsTarget', () => ({ assertWechatDevtoolsPort: mocks.assertPort }))
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
    expect(mocks.readSession).toHaveBeenCalledExactlyOnceWith({ projectPath, sessionId: undefined, port: 19201, installationId: target.installationId })
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
})
