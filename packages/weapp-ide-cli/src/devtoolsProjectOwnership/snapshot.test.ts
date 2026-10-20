import type { MachineE2ELeaseRecoveryScope } from '@weapp-vite/devtools-runtime'
import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginManagedWechatProject, closeManagedWechatProject, isManagedWechatProjectFullyReleased, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords, recoverManagedWechatProjectsAfterInstallationExit } from './index'
import { createManagedWechatProjectJournal, writeManagedRecord } from './journal'

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  captureWindow: vi.fn(),
  identity: vi.fn(),
  inspect: vi.fn(),
  lease: vi.fn(),
  waitClosed: vi.fn(),
  waitWindow: vi.fn(),
  portClosed: vi.fn(),
  inventory: vi.fn(),
}))
vi.mock('execa', () => ({ execa: mocks.close }))
vi.mock('@weapp-vite/devtools-runtime', async original => ({ ...await original<object>(), withMachineE2ELease: mocks.lease, assertMachineE2ELeaseRecoveryScope: vi.fn(async () => {}), withMachineE2ELeaseRecoveryOperation: async (_scope: unknown, run: () => Promise<unknown>) => await run() }))
vi.mock('./installationExit/processes', () => ({ inspectExitedWechatInstallation: mocks.inventory }))
vi.mock('./journal/windowsSelfIdentity', () => ({ readWindowsJournalWriterIdentity: () => mocks.identity(process.pid) }))
vi.mock('./host', async original => ({
  ...await original<object>(),
  inspectManagedProjectHost: mocks.inspect,
  readManagedProcessIdentity: mocks.identity,
  isManagedPortClosed: mocks.portClosed,
  waitForManagedPortClosed: mocks.waitClosed,
  assertManagedInstallation: vi.fn(async () => {}),
}))
vi.mock('./windowClose', () => ({
  captureManagedWindowClose: mocks.captureWindow,
  waitForManagedWindowClosed: mocks.waitWindow,
}))

let directory: string
let target: ResolvedWechatDevtoolsTarget
const host = { pid: 42, executable: 'selected-host', started: 'selected-start' }
const marker = '.weapp-ide-snapshot-owner'

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-snapshot-test-'))
  target = { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), installationId: 'selected' }
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, path.join(directory, 'journal'))
  mocks.identity.mockImplementation(async (pid: number) => pid === process.pid ? { pid, executable: 'test-worker', started: 'test-start' } : host)
  mocks.inspect.mockResolvedValue(host)
  mocks.close.mockResolvedValue({ exitCode: 0 })
  mocks.lease.mockImplementation(async (run: () => Promise<unknown>) => await run())
  mocks.waitClosed.mockResolvedValue(undefined)
  mocks.waitWindow.mockResolvedValue(undefined)
  mocks.portClosed.mockResolvedValue(false)
  mocks.captureWindow.mockImplementation(async () => ({
    protocol: 'wechat-devtools-window-close-trace-v1',
    profileDir: target.profileDir,
    productVersion: 'test',
    capturedAt: new Date().toISOString(),
    cursors: [{ name: 'selected.log', identity: 'original-log', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
    calls: [],
  }))
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(directory, { force: true, recursive: true })
})

async function snapshot() {
  const intent = (await beginManagedWechatProject({ target, projectPath: path.join(directory, 'source'), port: 19001, snapshotProject: true }))!
  await intent.prepareSnapshot(async destination => await fs.writeFile(path.join(destination, 'app.js'), 'App({})'))
  return intent
}

async function ownedSnapshot() {
  const intent = await snapshot()
  await intent.markLaunchDispatched()
  await intent.confirm({ openedProjectWindow: true, port: 19001 })
  return intent
}

describe('managed project snapshot ownership', () => {
  it('reserves its exact generation without touching snapshot files before preparation', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, snapshotProject: true }))!
    await expect(fs.access(intent.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
    const [record] = await readManagedWechatProjectRecords()
    expect(record).toMatchObject({ id: intent.id, projectPath: path.join(record!.journalPath, 'snapshots', intent.id), snapshot: { state: 'reserved', sourceProjectPath: directory } })
    await intent.close()
    expect(isManagedWechatProjectFullyReleased((await readManagedWechatProjectRecords())[0]!)).toBe(true)
  })

  it('rejects another window before creating or altering a snapshot', async () => {
    const first = (await beginManagedWechatProject({ target, projectPath: path.join(directory, 'first') }))!
    await first.confirm({ openedProjectWindow: true, port: 19001 })
    await expect(beginManagedWechatProject({ target, projectPath: path.join(directory, 'second'), snapshotProject: true })).rejects.toThrow('window budget exhausted')
    expect(await readManagedWechatProjectRecords()).toHaveLength(1)
    await expect(fs.access(path.join(first.journalPath, 'snapshots'))).rejects.toMatchObject({ code: 'ENOENT' })
    await first.close()
  })

  it('recovers an unstarted half-populated snapshot without sending native close', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, snapshotProject: true }))!
    const failure = new Error('copy interrupted')
    await expect(intent.prepareSnapshot(async (destination) => {
      await fs.writeFile(path.join(destination, 'partial.js'), 'partial')
      throw failure
    })).rejects.toBe(failure)
    await intent.fail(failure)
    await intent.close()
    await expect(fs.access(intent.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(mocks.close).not.toHaveBeenCalled()
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'released', releasedReason: 'not-started', snapshot: { state: 'removed' } })
  })

  it('retains creation identity when marker writing fails and permits exact pre-dispatch cleanup', async () => {
    const intent = (await beginManagedWechatProject({ target, projectPath: directory, snapshotProject: true }))!
    const write = fs.writeFile.bind(fs)
    const failure = new Error('marker unavailable')
    vi.spyOn(fs, 'writeFile').mockImplementation(async (file, data, options) => {
      if (path.basename(String(file)) === marker) {
        throw failure
      }
      await write(file, data, options)
    })
    await expect(intent.prepareSnapshot(async () => {})).rejects.toBe(failure)
    expect((await readManagedWechatProjectRecords())[0]!.snapshot!.directoryIdentity).toBeDefined()
    await intent.close()
    await expect(fs.access(intent.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves an unknown start receipt and blocks subsequent starts', async () => {
    const intent = await snapshot()
    await intent.markLaunchDispatched()
    await intent.fail(new Error('start receipt unavailable'))
    await expect(intent.close()).rejects.toThrow('ownership is unconfirmed')
    await expect(fs.access(path.join(intent.projectPath, 'app.js'))).resolves.toBeUndefined()
    await expect(beginManagedWechatProject({ target, projectPath: path.join(directory, 'next') })).rejects.toThrow('unresolved ownership')
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('keeps a borrowed snapshot because its window was not granted to this task', async () => {
    const intent = await snapshot()
    await intent.markLaunchDispatched()
    await intent.confirm({ openedProjectWindow: false, port: 19001 })
    await expect(intent.close()).rejects.toThrow('borrowed window receipt')
    await expect(fs.access(intent.projectPath)).resolves.toBeUndefined()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('waits for existing window and port destruction before removing W', async () => {
    const intent = await ownedSnapshot()
    mocks.waitWindow.mockImplementation(async () => await fs.access(intent.projectPath))
    mocks.waitClosed.mockImplementation(async () => await fs.access(intent.projectPath))
    await intent.close()
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(target.cliPath, ['close', '--project', intent.projectPath], expect.any(Object))
    await expect(fs.access(intent.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retries deletion after window release without sending native close again', async () => {
    const intent = await ownedSnapshot()
    const remove = fs.rm.bind(fs)
    const failure = new Error('snapshot still busy')
    let rejectOnce = true
    vi.spyOn(fs, 'rm').mockImplementation(async (file, options) => {
      if (String(file) === intent.projectPath && rejectOnce) {
        rejectOnce = false
        throw failure
      }
      await remove(file, options)
    })
    await expect(intent.close()).rejects.toBe(failure)
    const [pending] = await readManagedWechatProjectRecords()
    expect(pending).toMatchObject({ state: 'released', releasedReason: 'project-closed', snapshot: { state: 'ready', cleanupError: failure.message } })
    expect(isManagedWechatProjectFullyReleased(pending!)).toBe(false)
    await expect(beginManagedWechatProject({ target, projectPath: path.join(directory, 'next') })).rejects.toThrow('unresolved ownership')
    await closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(isManagedWechatProjectFullyReleased((await readManagedWechatProjectRecords())[0]!)).toBe(true)
  })

  it('shares concurrent close results and permits parent cleanup from the persistent record', async () => {
    const intent = await ownedSnapshot()
    const first = closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    const second = closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    expect(first).toBe(second)
    await first
    await closeManagedWechatProject({ journalPath: intent.journalPath, id: intent.id })
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it.each(['marker', 'directory'] as const)('refuses deletion after %s replacement', async (change) => {
    const intent = await ownedSnapshot()
    if (change === 'marker') {
      await fs.writeFile(path.join(intent.projectPath, marker), 'another-owner')
    }
    else {
      const preserved = path.join(directory, 'preserved')
      await fs.mkdir(preserved)
      await fs.rename(intent.projectPath, path.join(directory, 'original-snapshot'))
      await fs.symlink(preserved, intent.projectPath, process.platform === 'win32' ? 'junction' : 'dir')
    }
    await expect(intent.close()).rejects.toThrow(/snapshot.*(changed|replaced)/i)
    expect((await readManagedWechatProjectRecords())[0]).toMatchObject({ state: 'released', snapshot: { state: 'ready' } })
    await expect(fs.lstat(intent.projectPath)).resolves.toBeDefined()
  })

  it.each(['unconfirmed', 'borrowed'] as const)('cleans %s W only after explicit installation-exit evidence', async (state) => {
    const journalPath = await createManagedWechatProjectJournal(path.join(directory, 'registered'))
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, journalPath)
    const intent = await snapshot()
    await intent.markLaunchDispatched()
    if (state === 'borrowed') {
      await intent.confirm({ openedProjectWindow: false, port: 19001 })
    }
    else {
      await intent.fail(new Error('original receipt unavailable'))
    }
    const [before] = await readManagedWechatProjectRecords()
    before!.ownerPid = process.pid + 1
    await writeManagedRecord(before!)
    mocks.identity.mockImplementation(async (pid: number) => pid === process.pid ? { pid, executable: 'test-worker', started: 'test-start' } : undefined)
    mocks.portClosed.mockResolvedValue(true)
    mocks.inventory.mockResolvedValue({
      platform: 'darwin',
      installationRoot: target.appPath,
      checkedAt: new Date().toISOString(),
      inspectedProcessCount: 0,
      kernelPathProcessCount: 0,
      textImageProcessCount: 0,
      exitedProcessCount: 0,
      zombieProcessCount: 0,
      selectedProcessCount: 0,
    })
    const recoveryScope: MachineE2ELeaseRecoveryScope = { id: randomUUID(), owner: { pid: process.pid, token: randomUUID() }, ancestors: [], sealed: true, completed: false, cleanupKey: journalPath }
    expect(await recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope })).toEqual({ recoveredRecordIds: [intent.id] })
    const [after] = await readManagedWechatProjectRecords()
    expect(after).toMatchObject({
      state: 'released',
      releasedReason: 'installation-exited',
      snapshot: { state: 'removed' },
      installationExitRecovery: { previous: { state } },
    })
    expect(after!.installationExitRecovery!.previous.error).toBe(before!.error)
    await expect(fs.access(intent.projectPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('accepts a canonical ancestor alias without following a replacement snapshot symlink', async () => {
    const actual = path.join(directory, 'actual')
    const alias = path.join(directory, 'alias')
    await fs.mkdir(actual)
    await fs.symlink(actual, alias, process.platform === 'win32' ? 'junction' : 'dir')
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, path.join(alias, 'journal'))
    const intent = await snapshot()
    await intent.close()
    expect(isManagedWechatProjectFullyReleased((await readManagedWechatProjectRecords())[0]!)).toBe(true)
  })
})
