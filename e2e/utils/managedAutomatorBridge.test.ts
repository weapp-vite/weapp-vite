import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startManagedAutomatorBridge } from './managedAutomatorBridge'

const mocks = vi.hoisted(() => ({ begin: vi.fn(), start: vi.fn(), resolve: vi.fn() }))
vi.mock('../../packages/weapp-ide-cli/src/cli/agentStart', () => ({ startWechatIdeAgent: mocks.start }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({ beginManagedWechatProject: mocks.begin }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: mocks.resolve }))

const options = { projectPath: 'fixture', cliPath: 'selected-cli', port: 9415, timeout: 1_000 }
const receipt = { openedProjectWindow: true, autoPort: options.port, version: 'selected-version' }
function owner() {
  return { id: 'project-owner', journalPath: 'task-journal', confirm: vi.fn(async () => {}), fail: vi.fn(async () => {}), close: vi.fn(async () => {}) }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolve.mockResolvedValue({ cliPath: options.cliPath })
})

describe('managed automator bridge', () => {
  it('records the official receipt before exposing the connection endpoint', async () => {
    const project = owner()
    mocks.begin.mockResolvedValue(project)
    mocks.start.mockImplementation(async (options) => {
      await options.onStarted(receipt)
      expect(project.confirm).toHaveBeenCalledExactlyOnceWith({ openedProjectWindow: true, port: 9415 })
      return receipt
    })
    expect(await startManagedAutomatorBridge(options)).toEqual({
      wsEndpoint: 'ws://127.0.0.1:9415',
      managedProject: { id: project.id, journalPath: project.journalPath },
    })
    expect(project.close).not.toHaveBeenCalled()
  })

  it('cannot start a window before a task journal exists', async () => {
    mocks.begin.mockResolvedValue(undefined)
    await expect(startManagedAutomatorBridge(options)).rejects.toThrow('task-owned project journal')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('awaits owner cleanup after a confirmed start is canceled', async () => {
    const project = owner()
    const failure = new Error('canceled after receipt')
    mocks.begin.mockResolvedValue(project)
    mocks.start.mockImplementation(async (options) => {
      await options.onStarted(receipt)
      throw failure
    })
    await expect(startManagedAutomatorBridge(options)).rejects.toBe(failure)
    expect(project.fail).toHaveBeenCalledExactlyOnceWith(failure)
    expect(project.close).toHaveBeenCalledOnce()
  })

  it('preserves both an unknown start result and its blocked cleanup', async () => {
    const project = owner()
    const failure = new Error('response lost')
    const cleanup = new Error('unconfirmed ownership')
    project.close.mockRejectedValue(cleanup)
    mocks.begin.mockResolvedValue(project)
    mocks.start.mockRejectedValue(failure)
    await expect(startManagedAutomatorBridge(options)).rejects.toMatchObject({ errors: [failure, cleanup] })
    expect(mocks.start).toHaveBeenCalledOnce()
  })
})
