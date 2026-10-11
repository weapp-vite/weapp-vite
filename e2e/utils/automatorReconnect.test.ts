import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { ManagedWechatProjectRecord } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reconnectAutomator, registerAutomatorReconnect } from './automatorReconnect'
import { attachManagedProjectSession, getManagedProjectSessionOwner } from './managedProjectSession'

const mocks = vi.hoisted(() => ({
  installation: vi.fn(),
  inspect: vi.fn(),
  readRecord: vi.fn(),
  lease: vi.fn(),
  lock: vi.fn(),
}))

vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<object>(),
  withMachineE2ELease: mocks.lease,
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host', async importOriginal => ({
  ...await importOriginal<object>(),
  assertManagedInstallation: mocks.installation,
  inspectManagedProjectHost: mocks.inspect,
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal', () => ({
  readManagedRecord: mocks.readRecord,
  withManagedJournalLock: mocks.lock,
}))

function createSession() {
  const disconnect = vi.fn()
  const rawClose = vi.fn(async () => {})
  const session = { close: rawClose, disconnect } as unknown as MiniProgram
  return { session, disconnect, rawClose }
}

function createFixture() {
  const target = {
    cliPath: path.resolve('selected-installation/cli'),
    appPath: path.resolve('selected-installation'),
    profileDir: path.resolve('selected-profile'),
    installationId: 'selected',
    version: '1.0.0',
    channel: 'stable',
  } as const
  const metadata = {
    projectPath: path.resolve('owned-project'),
    wsEndpoint: 'ws://127.0.0.1:9415',
    port: 9415,
    managedProject: { id: 'owned-record', journalPath: path.resolve('task-journal') },
  }
  const host = { pid: 42, executable: 'selected-backend', started: 'original-start' }
  const record: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id: metadata.managedProject.id,
    generation: 'first-generation',
    journalPath: metadata.managedProject.journalPath,
    ownerPid: 10,
    ownerToken: 'test-owner',
    target,
    projectPath: metadata.projectPath,
    port: metadata.port,
    state: 'owned',
    openedProjectWindow: true,
    host,
    createdAt: 'first-created',
    updatedAt: 'first-updated',
  }
  const previous = createSession()
  const next = createSession()
  const closeOwner = vi.fn(async () => {})
  attachManagedProjectSession(previous.session, closeOwner)
  Reflect.set(previous.session, '__WEAPP_VITE_SESSION_METADATA', metadata)
  const connect = vi.fn(async (_options: { wsEndpoint: string, timeout: number, signal: AbortSignal }) => next.session)
  const configure = vi.fn(async () => {})
  registerAutomatorReconnect(previous.session, { target, timeout: 120_000, connect, configure })
  mocks.readRecord.mockResolvedValue(record)
  mocks.inspect.mockResolvedValue(host)
  return { target, metadata, host, record, previous, next, connect, configure, closeOwner }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.lease.mockImplementation(async (run: () => Promise<unknown>) => run())
  mocks.lock.mockImplementation(async (_journal: string, run: () => Promise<unknown>) => run())
  mocks.installation.mockResolvedValue(undefined)
})

describe('managed automator reconnect', () => {
  it('replaces only the socket and preserves the endpoint, metadata and original owner across reloads', async () => {
    const fixture = createFixture()
    const second = createSession()
    fixture.connect.mockResolvedValueOnce(fixture.next.session).mockResolvedValueOnce(second.session)

    const next = await reconnectAutomator(fixture.previous.session)
    expect(next).toBe(fixture.next.session)
    expect(fixture.previous.disconnect).toHaveBeenCalledOnce()
    expect(fixture.connect).toHaveBeenCalledExactlyOnceWith({
      wsEndpoint: fixture.metadata.wsEndpoint,
      timeout: expect.any(Number),
      signal: expect.any(AbortSignal),
    })
    expect(fixture.connect.mock.calls[0]![0].timeout).toBeLessThanOrEqual(120_000)
    expect(fixture.configure).toHaveBeenCalledExactlyOnceWith(next, expect.anything())
    expect(Reflect.get(next, '__WEAPP_VITE_SESSION_METADATA')).toEqual(fixture.metadata)
    expect(getManagedProjectSessionOwner(next)).toBe(fixture.closeOwner)
    expect(fixture.closeOwner).not.toHaveBeenCalled()
    expect(fixture.previous.rawClose).not.toHaveBeenCalled()

    expect(await reconnectAutomator(next)).toBe(second.session)
    expect(getManagedProjectSessionOwner(second.session)).toBe(fixture.closeOwner)
    expect(fixture.connect.mock.calls.map(([options]) => options.wsEndpoint)).toEqual([fixture.metadata.wsEndpoint, fixture.metadata.wsEndpoint])
    expect(mocks.readRecord).toHaveBeenCalledWith(fixture.metadata.managedProject.journalPath, fixture.metadata.managedProject.id)
    await Promise.all([second.session.close(), second.session.close()])
    expect(fixture.closeOwner).toHaveBeenCalledOnce()
    expect(second.rawClose).not.toHaveBeenCalled()
    await expect(reconnectAutomator(fixture.previous.session)).rejects.toThrow('registered direct project session')
  })

  it('shares simultaneous reconnect attempts for one session', async () => {
    const fixture = createFixture()
    const first = reconnectAutomator(fixture.previous.session)
    const second = reconnectAutomator(fixture.previous.session)
    expect(second).toBe(first)
    await first
    expect(fixture.connect).toHaveBeenCalledOnce()
    expect(mocks.lease).toHaveBeenCalledOnce()
    expect(mocks.lock).toHaveBeenCalledOnce()
  })

  it.each(['starting', 'unconfirmed', 'borrowed', 'closing', 'failed', 'released'] as const)('rejects %s ownership without disconnecting or changing it', async (state) => {
    const fixture = createFixture()
    fixture.record.state = state
    await expect(reconnectAutomator(fixture.previous.session)).rejects.toThrow('same owned project')
    expect(fixture.previous.disconnect).not.toHaveBeenCalled()
    expect(fixture.connect).not.toHaveBeenCalled()
    expect(fixture.closeOwner).not.toHaveBeenCalled()
    expect(fixture.record.state).toBe(state)
  })

  it.each(['project', 'port', 'installation', 'generation-host', 'closing-owned'] as const)('rejects changed %s identity', async (change) => {
    const fixture = createFixture()
    if (change === 'project') {
      fixture.record.projectPath = path.resolve('another-project')
    }
    else if (change === 'port') {
      fixture.record.port = fixture.metadata.port + 1
    }
    else if (change === 'installation') {
      fixture.record.target = { ...fixture.target, installationId: 'another-installation' }
    }
    else if (change === 'generation-host') {
      mocks.inspect.mockResolvedValue({ ...fixture.host, started: 'reused-pid' })
    }
    else {
      fixture.record.closeAcknowledgedAt = 'closing-now'
    }
    await expect(reconnectAutomator(fixture.previous.session)).rejects.toThrow(/same owned project|listener identity changed/)
    expect(fixture.previous.disconnect).not.toHaveBeenCalled()
    expect(fixture.connect).not.toHaveBeenCalled()
    expect(fixture.closeOwner).not.toHaveBeenCalled()
  })

  it('preserves the owner and disconnects the new socket when identity changes during connection', async () => {
    const fixture = createFixture()
    mocks.inspect.mockResolvedValueOnce(fixture.host).mockResolvedValueOnce({ ...fixture.host, started: 'replaced-listener' })
    await expect(reconnectAutomator(fixture.previous.session)).rejects.toThrow('listener identity changed')
    expect(fixture.next.disconnect).toHaveBeenCalledOnce()
    expect(fixture.configure).not.toHaveBeenCalled()
    expect(fixture.closeOwner).not.toHaveBeenCalled()
    await fixture.previous.session.close()
    expect(fixture.closeOwner).toHaveBeenCalledOnce()
  })

  it.each(['connect', 'configure'] as const)('keeps the original owner usable after %s failure without launching a replacement', async (stage) => {
    const fixture = createFixture()
    const failure = new Error(`${stage} failed`)
    fixture[stage].mockRejectedValueOnce(failure)
    await expect(reconnectAutomator(fixture.previous.session)).rejects.toBe(failure)
    expect(fixture.connect).toHaveBeenCalledOnce()
    expect(fixture.next.disconnect).toHaveBeenCalledTimes(stage === 'configure' ? 1 : 0)
    expect(fixture.closeOwner).not.toHaveBeenCalled()
    await fixture.previous.session.close()
    expect(fixture.closeOwner).toHaveBeenCalledOnce()
  })

  it('refuses an unregistered or metadata-only session', async () => {
    const fixture = createFixture()
    Reflect.set(fixture.next.session, '__WEAPP_VITE_SESSION_METADATA', fixture.metadata)
    registerAutomatorReconnect(fixture.next.session, { target: fixture.target, timeout: 120_000, connect: fixture.connect, configure: fixture.configure })
    await expect(reconnectAutomator(fixture.next.session)).rejects.toThrow('registered direct project session')
    expect(fixture.connect).not.toHaveBeenCalled()
    expect(fixture.closeOwner).not.toHaveBeenCalled()
  })
})
