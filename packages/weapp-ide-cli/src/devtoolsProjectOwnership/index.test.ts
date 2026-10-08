import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginManagedWechatProject, cleanupManagedWechatProjects, closeManagedWechatProject, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from './index'

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  inspect: vi.fn(),
  identity: vi.fn(),
  portClosed: vi.fn(),
  waitClosed: vi.fn(),
  installation: vi.fn(),
  lease: vi.fn(),
  captureWindowClose: vi.fn(),
  waitWindowClosed: vi.fn(),
}))
vi.mock('execa', () => ({ execa: mocks.close }))
vi.mock('./journal/windowsSelfIdentity', () => ({ readWindowsJournalWriterIdentity: () => mocks.identity(process.pid) }))
vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({ ...await importOriginal<object>(), withMachineE2ELease: mocks.lease }))
vi.mock('./windowClose', () => ({ captureManagedWindowClose: mocks.captureWindowClose, waitForManagedWindowClosed: mocks.waitWindowClosed }))
vi.mock('./host', async (importOriginal) => {
  const original = await importOriginal<typeof import('./host')>()
  return {
    ...original,
    inspectManagedProjectHost: mocks.inspect,
    readManagedProcessIdentity: mocks.identity,
    isManagedPortClosed: mocks.portClosed,
    waitForManagedPortClosed: mocks.waitClosed,
    assertManagedInstallation: mocks.installation,
  }
})

let directory: string
let target: ResolvedWechatDevtoolsTarget
const host = { pid: 42, executable: 'selected-host', started: 'first-start' }

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-project-test-'))
  target = { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), installationId: 'selected', version: '1.0.0', channel: 'stable' }
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, path.join(directory, 'journal'))
  mocks.identity.mockImplementation(async (pid: number) => pid === process.pid
    ? { pid, executable: 'test-worker', started: 'test-start' }
    : host)
  mocks.inspect.mockResolvedValue(host)
  mocks.portClosed.mockResolvedValue(false)
  mocks.waitClosed.mockResolvedValue(undefined)
  mocks.installation.mockResolvedValue(undefined)
  mocks.close.mockResolvedValue({ exitCode: 0 })
  mocks.lease.mockImplementation(async (run: () => Promise<unknown>) => run())
  mocks.captureWindowClose.mockImplementation(async () => ({
    protocol: 'wechat-devtools-window-close-trace-v1',
    profileDir: target.profileDir,
    productVersion: target.version,
    capturedAt: new Date().toISOString(),
    cursors: [{ name: 'selected.log', identity: '1:2', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
    calls: [],
  }))
  mocks.waitWindowClosed.mockResolvedValue(undefined)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(directory, { recursive: true, force: true })
})

async function owned(name = 'project', journalPath?: string, maxOwnedWindows?: 1 | 2) {
  const intent = (await beginManagedWechatProject({ target, projectPath: path.join(directory, name), journalPath, maxOwnedWindows }))!
  await intent.confirm({ openedProjectWindow: true, port: 19001 })
  return intent
}

describe('managed DevTools project ownership', () => {
  it('leaves ordinary public sessions unchanged without an explicit journal', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, '')
    expect(await beginManagedWechatProject({ target, projectPath: directory })).toBeUndefined()
    await cleanupManagedWechatProjects()
    expect(await readManagedWechatProjectRecords()).toEqual([])
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('persists intent before launch, and unconfirmed failure blocks cleanup and the next launch', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, generation: 'current-run' }))!
    expect(await readManagedWechatProjectRecords()).toEqual([expect.objectContaining({ id: intent.id, generation: 'current-run', state: 'starting' })])
    expect((await readManagedWechatProjectRecords())[0]).not.toHaveProperty('openedProjectWindow')
    await intent.fail(new Error('worker exited before receipt'))
    await expect(intent.close()).rejects.toThrow('ownership is unconfirmed')
    await expect(cleanupManagedWechatProjects()).rejects.toThrow('stop the acceptance lane')
    await expect(beginManagedWechatProject({ target, projectPath: directory })).rejects.toThrow('unresolved ownership')
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('never closes a borrowed manual project, including after connection failure', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory }))!
    await intent.confirm({ openedProjectWindow: false, port: 19001 })
    await intent.fail(new Error('connection failed'))
    await intent.close()
    await cleanupManagedWechatProjects()
    expect(mocks.close).not.toHaveBeenCalled()
    expect(await readManagedWechatProjectRecords()).toEqual([expect.objectContaining({ state: 'released', releasedReason: 'borrowed' })])
  })

  it('closes only the exact owned project and requires native destruction before port release', async () => {
    const first = await owned('first')
    const second = await owned('second', undefined, 2)
    await first.fail(new Error('connection disconnected'))
    await first.close()
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(target.cliPath, ['close', '--project', path.join(directory, 'first')], { timeout: 30_000, windowsHide: true })
    expect(mocks.waitClosed).toHaveBeenCalledExactlyOnceWith(19001)
    expect(mocks.captureWindowClose.mock.invocationCallOrder[0]).toBeLessThan(mocks.close.mock.invocationCallOrder[0]!)
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(mocks.waitWindowClosed.mock.invocationCallOrder[0]!)
    expect(mocks.waitWindowClosed.mock.invocationCallOrder[0]).toBeLessThan(mocks.waitClosed.mock.invocationCallOrder[0]!)
    expect(mocks.lease).toHaveBeenCalledOnce()
    expect(await readManagedWechatProjectRecords()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.id, state: 'released', releasedReason: 'project-closed' }),
      expect.objectContaining({ id: second.id, state: 'owned' }),
    ]))
  })

  it('shares concurrent close and never closes a later window after release', async () => {
    const intent = await owned()
    const pending = Promise.withResolvers<void>()
    mocks.close.mockImplementation(() => pending.promise)
    const first = intent.close()
    const second = closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    expect(first).toBe(second)
    pending.resolve()
    await Promise.all([first, second])
    await intent.close()
    await cleanupManagedWechatProjects()
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('persists dispatch before the CLI and never repeats a close with an unknown result', async () => {
    const intent = await owned()
    mocks.close.mockImplementationOnce(async () => {
      expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'closing', windowClose: { dispatchedAt: expect.any(String) } })
      throw new Error('CLI exited without a result')
    })
    await expect(intent.close()).rejects.toThrow('CLI exited without a result')
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed', openedProjectWindow: true, windowClose: { dispatchedAt: expect.any(String) } })
    await expect(beginManagedWechatProject({ target, projectPath: directory })).rejects.toThrow('unresolved ownership')
    await intent.close()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.waitWindowClosed).toHaveBeenCalledOnce()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'released' })
  })

  it('blocks after early port exit and resumes only native destruction observation on retry', async () => {
    const intent = await owned()
    mocks.waitWindowClosed.mockRejectedValueOnce(new Error('native destruction missing'))
    await expect(intent.close()).rejects.toThrow('native destruction missing')
    expect(mocks.waitClosed).not.toHaveBeenCalled()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed', closeAcknowledgedAt: expect.any(String), windowClose: { dispatchedAt: expect.any(String) } })
    await expect(beginManagedWechatProject({ target, projectPath: directory })).rejects.toThrow('unresolved ownership')
    mocks.identity.mockResolvedValue(undefined)
    mocks.portClosed.mockResolvedValue(true)
    await intent.close()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.waitWindowClosed).toHaveBeenCalledTimes(2)
    expect(mocks.waitClosed).toHaveBeenCalledOnce()
  })

  it('preserves ownership without sending a close when native log capture is unavailable', async () => {
    const intent = await owned()
    mocks.captureWindowClose.mockRejectedValue(new Error('selected profile log unavailable'))
    await expect(intent.close()).rejects.toThrow('selected profile log unavailable')
    expect(mocks.close).not.toHaveBeenCalled()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed' })
  })

  it('does not accept CLI exit zero while the port remains open', async () => {
    const intent = await owned()
    mocks.waitClosed.mockRejectedValueOnce(new Error('port remains open'))
    await expect(intent.close()).rejects.toThrow('port remains open')
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed', closeAcknowledgedAt: expect.any(String) })
    await intent.close()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(mocks.waitClosed).toHaveBeenCalledTimes(2)
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'released', releasedReason: 'project-closed' })
  })

  it('blocks the lane without closing a path when its original port vanished without a close receipt', async () => {
    const intent = await owned()
    mocks.portClosed.mockResolvedValue(true)
    await expect(intent.close()).rejects.toThrow('port disappeared without a confirmed project close')
    expect(mocks.close).not.toHaveBeenCalled()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed', openedProjectWindow: true })
    await expect(beginManagedWechatProject({ target, projectPath: directory })).rejects.toThrow('unresolved ownership')
  })

  it('keeps window ownership unresolved when only its backend listener has exited', async () => {
    const intent = await owned()
    mocks.identity.mockResolvedValue(undefined)
    await expect(intent.close()).rejects.toThrow('listener exited without a confirmed project close')
    expect(mocks.close).not.toHaveBeenCalled()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'failed', openedProjectWindow: true })
    await expect(cleanupManagedWechatProjects()).rejects.toThrow('stop the acceptance lane')
  })

  it.each(['host', 'port', 'installation'] as const)('preserves a project when its %s identity changes', async (kind) => {
    const intent = await owned()
    if (kind === 'host') {
      mocks.identity.mockResolvedValue({ ...host, started: 'reused-pid' })
    }
    else if (kind === 'port') {
      mocks.inspect.mockResolvedValue({ ...host, pid: 43 })
    }
    else {
      mocks.installation.mockRejectedValue(new Error('installation changed'))
    }
    await expect(intent.close()).rejects.toThrow(/changed|different host/)
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('records an opened receipt even when host verification fails, without granting unsafe cleanup', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, port: 19001 }))!
    mocks.inspect.mockRejectedValue(new Error('listener disappeared'))
    await expect(intent.confirm({ openedProjectWindow: true, port: 19001 })).rejects.toThrow('listener disappeared')
    await intent.fail(new Error('aborted after receipt'))
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'unconfirmed', openedProjectWindow: true, port: 19001 })
    await expect(intent.close()).rejects.toThrow('unconfirmed')
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('rejects a mismatched official port and cannot infer ownership from a project path', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, port: 19001 }))!
    await expect(intent.confirm({ openedProjectWindow: true, port: 19002 })).rejects.toThrow('requested port')
    await expect(intent.close()).rejects.toThrow('unconfirmed')
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('recovers confirmed child journals after a worker exits and preserves unrelated task journals', async () => {
    const parentJournal = path.join(directory, 'journal')
    const child = await owned('child', path.join(parentJournal, 'children', 'task'))
    const other = await owned('other', path.join(directory, 'other-task'))
    const recordFile = path.join(child.journalPath, `${child.id}.json`)
    const record = JSON.parse(await fs.readFile(recordFile, 'utf8')) as Record<string, unknown>
    record.ownerToken = randomUUID()
    await fs.writeFile(recordFile, JSON.stringify(record))
    await cleanupManagedWechatProjects({ scope: 'process' })
    expect(mocks.close).not.toHaveBeenCalled()
    await cleanupManagedWechatProjects({ scope: 'journal' })
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(target.cliPath, ['close', '--project', path.join(directory, 'child')], { timeout: 30_000, windowsHide: true })
    expect((await readManagedWechatProjectRecords(path.join(directory, 'other-task')))[0]).toMatchObject({ id: other.id, state: 'owned' })
  })

  it('recovers a dead worker journal lock without bypassing its recorded project identity', async () => {
    const intent = await owned()
    const lock = path.join(intent.journalPath, '.ownership-lock')
    await fs.mkdir(lock)
    await fs.writeFile(path.join(lock, 'owner'), JSON.stringify({ token: randomUUID(), identity: { pid: 99, executable: 'dead-worker', started: 'old-start' } }))
    mocks.identity.mockImplementation(async (pid: number) => pid === 99 ? undefined : host)
    await closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    expect(mocks.close).toHaveBeenCalledOnce()
    await expect(fs.access(lock)).rejects.toThrow()
  })
})
