import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), rm: vi.fn(), connect: vi.fn(), assertPort: vi.fn() }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, default: { ...actual, readFile: mocks.readFile, rm: mocks.rm } }
})
vi.mock('@weapp-vite/miniprogram-automator', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/miniprogram-automator')>(),
  Launcher: class { connect = mocks.connect },
}))
vi.mock('../src/devtoolsTarget', () => ({
  resolveWechatDevtoolsTarget: async ({ cliPath }: { cliPath?: string }) => ({ cliPath: cliPath ?? 'stable-cli', installationId: cliPath ?? 'stable-cli', appPath: 'app', profileDir: 'profile' }),
  assertWechatDevtoolsHost: vi.fn(),
  assertWechatDevtoolsPort: mocks.assertPort,
}))

const projectPath = path.resolve('fixture-project')
const stableSession = { installationId: 'stable-cli', projectPath, port: 19620, wsEndpoint: 'ws://127.0.0.1:19620' }

describe('installation-bound automator connections', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.readFile.mockResolvedValue(JSON.stringify(stableSession))
    mocks.connect.mockResolvedValue({ disconnect: vi.fn() })
  })

  it('preserves matching session metadata after transient connection failure', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    const failure = new Error('temporary connection timeout')
    mocks.connect.mockRejectedValueOnce(failure)
    const options = { projectPath, port: 19620, timeout: 10_000 }
    await expect(connectOpenedAutomator(options)).rejects.toBe(failure)
    expect(mocks.rm).not.toHaveBeenCalled()
    await connectOpenedAutomator(options)
    expect(mocks.assertPort).toHaveBeenCalledWith(expect.objectContaining({ installationId: 'stable-cli' }), 19620, { signal: expect.any(AbortSignal), timeout: expect.any(Number) })
    expect(mocks.connect).toHaveBeenLastCalledWith({ signal: expect.any(AbortSignal), timeout: expect.any(Number), wsEndpoint: 'ws://127.0.0.1:19620' })
  })

  it.each([
    ['legacy metadata', { ...stableSession, installationId: undefined }],
    ['other installation', { ...stableSession, installationId: 'rc-cli' }],
    ['mismatched endpoint', { ...stableSession, wsEndpoint: 'ws://127.0.0.1:19621' }],
    ['unrelated project', { ...stableSession, projectPath: path.resolve('another-project') }],
    ['remote endpoint', { ...stableSession, wsEndpoint: 'ws://example.invalid:19620' }],
  ])('refuses %s without connecting or deleting records', async (_label, metadata) => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    mocks.readFile.mockResolvedValue(JSON.stringify(metadata))
    await expect(connectOpenedAutomator({ projectPath, port: 19620 })).rejects.toThrow('DEVTOOLS_SESSION_IDENTITY_UNVERIFIED')
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.rm).not.toHaveBeenCalled()
  })

  it('refuses a stale matching record when the live listener belongs to another installation', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    const mismatch = Object.assign(new Error('port owner differs'), { code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
    mocks.assertPort.mockRejectedValue(mismatch)
    await expect(connectOpenedAutomator({ projectPath, port: 19620 })).rejects.toBe(mismatch)
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.rm).not.toHaveBeenCalled()
  })

  it('looks up the same project and port separately for different installations', async () => {
    const { connectOpenedAutomator } = await import('../src/cli/automator')
    await connectOpenedAutomator({ projectPath, port: 19620, cliPath: 'stable-cli' })
    const stableFile = mocks.readFile.mock.calls[0]![0]
    mocks.readFile.mockResolvedValue(JSON.stringify({ ...stableSession, installationId: 'rc-cli' }))
    await connectOpenedAutomator({ projectPath, port: 19620, cliPath: 'rc-cli' })
    expect(mocks.readFile.mock.calls[1]![0]).not.toBe(stableFile)
  })
})
