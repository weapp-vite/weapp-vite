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
  servicePort: vi.fn(),
  inspectExited: vi.fn(),
  sleep: vi.fn(),
}))
vi.mock('node:timers/promises', () => ({ setTimeout: mocks.sleep }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host', () => ({
  readManagedProcessIdentity: mocks.identity,
  sameManagedProcess: (first: { pid: number, started: string, executable: string }, second: { pid: number, started: string, executable: string }) => first.pid === second.pid && first.started === second.started && first.executable === second.executable,
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: mocks.resolve }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsTarget/host', () => ({ resolveWechatDevtoolsInstallationRoot: () => '/tmp/selected.app' }))
vi.mock('../../packages/weapp-ide-cli/src/cli/wechatDevtoolsSettings', () => ({ detectWechatDevtoolsServicePort: mocks.servicePort }))
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
  mocks.servicePort.mockResolvedValue({ servicePort: 16325, servicePortEnabled: true })
  mocks.inspectExited.mockResolvedValue(undefined)
  mocks.sleep.mockImplementation((delay: number) => new Promise(resolve => setTimeout(resolve, delay)))
})

afterEach(async () => {
  await fs.rm(profileDir, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

async function lock(pid: string) {
  await fs.symlink(pid, path.join(profileDir, 'SingletonLock'))
}

function useHostWaitClock() {
  const clock = { now: 0 }
  vi.spyOn(performance, 'now').mockImplementation(() => clock.now)
  mocks.sleep.mockImplementation(async (delay: number) => {
    clock.now += delay
  })
  return clock
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
    const inspection = { platform: 'darwin', installationRoot: '/tmp/selected.app', checkedAt: new Date().toISOString(), selectedProcessCount: 0 }
    mocks.inspectExited.mockResolvedValueOnce(inspection)
    const evidence = await quitClaimedDevtoolsHost(lease!, { timeoutMs: 1_000, pollIntervalMs: 1 })
    expect(evidence).toMatchObject({
      before: { state: 'selected' },
      after: { state: 'cold', identities: [] },
      quitDispatched: true,
      exitedHostIdentities: [{ pid: 42, started: 'first' }],
      installationInspection: inspection,
    })
    expect(mocks.quit).toHaveBeenCalledWith(['quit', '--port=16325'], expect.objectContaining({ target, timeout: 30_000 }))
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: expect.any(Number) })
    expect(mocks.identity).toHaveBeenCalledTimes(2)
  })

  it('verifies the complete installation when the claimed host is already cold without dispatching quit', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const inspection = { platform: 'darwin', installationRoot: '/tmp/selected.app', checkedAt: new Date().toISOString(), selectedProcessCount: 0 }
    mocks.inspectExited.mockResolvedValueOnce(inspection)
    expect(await quitClaimedDevtoolsHost(lease)).toMatchObject({ before: { state: 'cold' }, after: { state: 'cold' }, quitDispatched: false, exitedHostIdentities: [], installationInspection: inspection })
    expect(mocks.quit).not.toHaveBeenCalled()
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: expect.any(Number) })
  })

  it('preserves a residual installation helper when the shared host lock is already gone', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const original = new Error('The selected installation still has a live helper process')
    mocks.inspectExited.mockRejectedValueOnce(original)
    await expect(quitClaimedDevtoolsHost(lease)).rejects.toBe(original)
    expect(mocks.quit).not.toHaveBeenCalled()
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: expect.any(Number) })
  })

  it('refuses a new host that appears during the read-only cold installation check', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    mocks.inspectExited.mockImplementationOnce(async () => {
      await lock('host-42')
      mocks.identity.mockResolvedValue({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'new-host' })
    })
    await expect(quitClaimedDevtoolsHost(lease)).rejects.toThrow('host is still selected')
    expect(mocks.quit).not.toHaveBeenCalled()
    expect(await fs.readlink(path.join(profileDir, 'SingletonLock'))).toBe('host-42')
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

  it('starts the monotonic wait budget after official quit and passes only the remainder after host checks', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const clock = useHostWaitClock()
    await lock('host-42')
    mocks.identity
      .mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
      .mockImplementationOnce(async () => {
        clock.now += 25
      })
    mocks.quit.mockImplementationOnce(async () => {
      clock.now += 500
      await fs.rm(path.join(profileDir, 'SingletonLock'))
    })
    await expect(quitClaimedDevtoolsHost(lease, { timeoutMs: 100 })).resolves.toMatchObject({ quitDispatched: true })
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: 75 })
    expect(mocks.quit).toHaveBeenCalledWith(['quit', '--port=16325'], expect.objectContaining({ timeout: 30_000 }))
  })

  it('keeps a single diminishing budget across failed installation checks and polling', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const clock = useHostWaitClock()
    await lock('host-42')
    mocks.identity.mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
    mocks.quit.mockImplementationOnce(async () => {
      await fs.rm(path.join(profileDir, 'SingletonLock'))
    })
    let checks = 0
    mocks.inspectExited.mockImplementation(async () => {
      clock.now += 10
      if (++checks < 3) {
        throw new Error('Installation inventory is still active')
      }
    })
    await expect(quitClaimedDevtoolsHost(lease, { timeoutMs: 100, pollIntervalMs: 20 })).resolves.toMatchObject({ quitDispatched: true })
    expect(mocks.inspectExited.mock.calls.map(([, , options]) => options.timeoutMs)).toEqual([100, 70, 40])
    expect(mocks.sleep.mock.calls).toEqual([[20], [20]])
    expect(clock.now).toBe(70)
  })

  it('caps the last poll at the remaining deadline and does not start another inspection', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const clock = useHostWaitClock()
    await lock('host-42')
    mocks.identity.mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
    mocks.quit.mockImplementationOnce(async () => {
      await fs.rm(path.join(profileDir, 'SingletonLock'))
    })
    mocks.inspectExited.mockImplementationOnce(async () => {
      clock.now += 60
      throw new Error('Installation inventory is still active')
    })
    await expect(quitClaimedDevtoolsHost(lease, { timeoutMs: 100, pollIntervalMs: 90 })).rejects.toThrow('did not fully exit')
    expect(mocks.sleep).toHaveBeenCalledExactlyOnceWith(40)
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: 100 })
    expect(clock.now).toBe(100)
  })

  it('does not dispatch an installation inventory once a host identity check consumes the wait budget', async () => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const clock = useHostWaitClock()
    await lock('host-42')
    mocks.identity
      .mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
      .mockImplementationOnce(async () => {
        clock.now += 100
      })
    mocks.quit.mockImplementationOnce(async () => {
      await fs.rm(path.join(profileDir, 'SingletonLock'))
    })
    await expect(quitClaimedDevtoolsHost(lease, { timeoutMs: 100 })).rejects.toThrow('deadline expired')
    expect(mocks.inspectExited).not.toHaveBeenCalled()
    expect(mocks.sleep).not.toHaveBeenCalled()
  })

  it.each(['cold', 'selected'] as const)('does not accept an installation result after the %s host wait deadline', async (state) => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    const clock = useHostWaitClock()
    if (state === 'selected') {
      await lock('host-42')
      mocks.identity.mockResolvedValueOnce({ pid: 42, executable: '/tmp/selected.app/Contents/MacOS/Electron', started: 'first' })
      mocks.quit.mockImplementationOnce(async () => {
        await fs.rm(path.join(profileDir, 'SingletonLock'))
      })
    }
    mocks.inspectExited.mockImplementationOnce(async () => {
      clock.now += 100
    })
    await expect(quitClaimedDevtoolsHost(lease, { timeoutMs: 100 })).rejects.toThrow('deadline expired')
    expect(mocks.inspectExited).toHaveBeenCalledExactlyOnceWith(target, 'darwin', { timeoutMs: 100 })
    expect(mocks.sleep).not.toHaveBeenCalled()
  })

  it.each([0, -1, Number.NaN, 0.5])('rejects an invalid host wait or poll interval before inspection: %s', async (value) => {
    const { claimDevtoolsHost, quitClaimedDevtoolsHost } = await import('./devtoolsHostLifecycle')
    const lease = await claimDevtoolsHost(cliPath)
    for (const options of [{ timeoutMs: value }, { pollIntervalMs: value }]) {
      await expect(quitClaimedDevtoolsHost(lease, options)).rejects.toThrow('requires positive timeout and polling interval')
    }
    expect(mocks.inspectExited).not.toHaveBeenCalled()
    expect(mocks.quit).not.toHaveBeenCalled()
  })
})
