import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), rm: vi.fn(), connect: vi.fn() }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, default: { ...actual, readFile: mocks.readFile, rm: mocks.rm } }
})
vi.mock('@weapp-vite/miniprogram-automator', () => ({
  Launcher: class { connect = mocks.connect },
}))

const projectPath = path.resolve('fixture-project')
const persisted = JSON.stringify({ projectPath, port: 19620, wsEndpoint: 'ws://127.0.0.1:19620' })

describe('read-only automator connections', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.readFile.mockResolvedValue(persisted)
  })

  it('preserves session metadata on failure and permits a later successful read-only connection', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    const failure = new Error('temporary connection timeout')
    const session = { disconnect: vi.fn() }
    mocks.connect.mockRejectedValueOnce(failure).mockResolvedValueOnce(session)
    const options = { projectPath, port: 19620, timeout: 20 }
    await expect(connectOpenedAutomator(options)).rejects.toBe(failure)
    expect(mocks.rm).not.toHaveBeenCalled()
    await expect(connectOpenedAutomator(options)).resolves.toBe(session)
    expect(mocks.connect).toHaveBeenLastCalledWith({ timeout: 20, wsEndpoint: 'ws://127.0.0.1:19620' })
  })

  it('does not delete another operation replacement when a previous connection fails', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    mocks.connect.mockImplementationOnce(async () => {
      mocks.readFile.mockResolvedValue(JSON.stringify({ projectPath, port: 19620, wsEndpoint: 'ws://127.0.0.1:19621' }))
      throw new Error('old connection failed')
    }).mockResolvedValueOnce({ disconnect: vi.fn() })
    await expect(connectOpenedAutomator({ projectPath, port: 19620 })).rejects.toThrow('old connection failed')
    expect(mocks.rm).not.toHaveBeenCalled()
    await connectOpenedAutomator({ projectPath, port: 19620 })
    expect(mocks.connect).toHaveBeenLastCalledWith({ timeout: undefined, wsEndpoint: 'ws://127.0.0.1:19621' })
  })

  it('leaves malformed or unrelated metadata untouched', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    mocks.readFile.mockResolvedValue('{ malformed')
    mocks.connect.mockResolvedValue({ disconnect: vi.fn() })
    await connectOpenedAutomator({ projectPath, port: 19620 })
    expect(mocks.connect).toHaveBeenCalledWith({ timeout: undefined, wsEndpoint: 'ws://127.0.0.1:19620' })
    expect(mocks.rm).not.toHaveBeenCalled()
  })
})
