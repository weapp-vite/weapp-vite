import type { ResolvedWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  quit: vi.fn(),
  resolve: vi.fn(),
  inspectExited: vi.fn(),
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host', () => ({
  readManagedProcessIdentity: mocks.identity,
  sameManagedProcess: (first: { pid: number, started: string, executable: string }, second: { pid: number, started: string, executable: string }) => first.pid === second.pid && first.started === second.started && first.executable === second.executable,
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: mocks.resolve }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/tmp/selected.app' }))
vi.mock('../../packages/weapp-ide-cli/src/cli/run-wechat-cli', () => ({ runWechatCliCommand: mocks.quit }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/installationExit/processes', () => ({ inspectExitedWechatInstallation: mocks.inspectExited }))

const cliPath = '/tmp/selected.app/Contents/MacOS/cli'
let profileDir: string
let target: ResolvedWechatDevtoolsTarget

beforeEach(async () => {
  vi.resetAllMocks()
  // 这些用例验证 POSIX SingletonLock 归属逻辑；Windows 使用 CIM 进程清单，
  // 应由专门的 Windows 集成覆盖，不能让同一组 symlink 断言误走另一实现。
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-host-lifecycle-'))
  target = {
    cliPath,
    appPath: '/tmp/selected.app/Contents/Resources/app.asar',
    installationId: 'selected',
    profileDir,
    version: '2.0.0',
    channel: 'stable',
  }
  mocks.resolve.mockResolvedValue(target)
  mocks.identity.mockResolvedValue(undefined)
  mocks.quit.mockResolvedValue(undefined)
  mocks.inspectExited.mockResolvedValue(undefined)
})

afterEach(async () => {
  await fs.rm(profileDir, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

async function lock(pid: string) {
  await fs.symlink(pid, path.join(profileDir, 'SingletonLock'))
}

describe('DevTools host lifecycle ownership', () => {
  it('claims a cold host and does not claim an existing host', async () => {
    const { claimDevtoolsHost } = await import('./devtoolsHostLifecycle')
    await expect(claimDevtoolsHost(cliPath)).resolves.toMatchObject({ target, initial: { state: 'cold' } })

    await lock('host-42')
    mocks.identity.mockResolvedValue({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
    await expect(claimDevtoolsHost(cliPath)).rejects.toThrow('selected')
  })

  it.each([
    ['malformed', 'not-a-pid', undefined],
    ['dead PID', 'host-99', undefined],
    ['foreign installation', 'host-42', { pid: 42, executable: '/tmp/other.app/Contents/MacOS/Electron', started: 'first' }],
  ] as const)('refuses a %s lock before starting another task', (_label, link, identity) => import('./devtoolsHostLifecycle').then(async ({ claimDevtoolsHost }) => {
    await lock(link)
    mocks.identity.mockResolvedValue(identity)
    await expect(claimDevtoolsHost(cliPath)).rejects.toThrow(/unknown|foreign/)
  }))

  it('quits a claimed host and waits for the lock, process, and installation inventory to disappear', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    expect(lease).toBeDefined()
    await lock('host-42')
    mocks.identity
      .mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
      .mockResolvedValueOnce(undefined)
    mocks.quit.mockImplementationOnce(async () => {
      await fs.rm(path.join(profileDir, 'SingletonLock'))
    })
    await quitClaimedDevtoolsHost(lease!, { timeoutMs: 1_000, pollIntervalMs: 1 })
    expect(mocks.quit).toHaveBeenCalledWith(['quit'], expect.objectContaining({ target, timeout: 30_000 }))
    expect(mocks.inspectExited).toHaveBeenCalledWith(target)
  })

  it('preserves an existing host when shutdown evidence is incomplete', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    await lock('host-42')
    const identity = { pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' }
    mocks.identity.mockResolvedValue(identity)
    await expect(quitClaimedDevtoolsHost(lease!, { timeoutMs: 3, pollIntervalMs: 1 })).rejects.toThrow('did not fully exit')
    expect(mocks.quit).toHaveBeenCalledOnce()
    expect(await fs.readlink(path.join(profileDir, 'SingletonLock'))).toBe('host-42')
  })
})
