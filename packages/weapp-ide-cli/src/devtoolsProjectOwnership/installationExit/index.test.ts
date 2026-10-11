import type { MachineE2ELeaseRecoveryScope } from '@weapp-vite/devtools-runtime'
import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import type { ManagedWechatProjectRecord } from '../types'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagedWechatProjectJournal, managedRecordPath, readManagedRecord, writeManagedRecord } from '../journal'
import { recoverManagedWechatProjectsAfterInstallationExit } from './index'

const mocks = vi.hoisted(() => ({ operation: vi.fn(), guard: vi.fn(), identity: vi.fn(), installation: vi.fn(), port: vi.fn(), inventory: vi.fn(), command: vi.fn() }))
vi.mock('@weapp-vite/devtools-runtime', async original => ({ ...await original<object>(), assertMachineE2ELeaseRecoveryScope: mocks.guard, withMachineE2ELeaseRecoveryOperation: mocks.operation }))
vi.mock('../host', async original => ({ ...await original<object>(), readManagedProcessIdentity: mocks.identity, assertManagedInstallation: mocks.installation, isManagedPortClosed: mocks.port }))
vi.mock('./processes', () => ({ inspectExitedWechatInstallation: mocks.inventory }))
vi.mock('execa', () => ({ execa: mocks.command }))
vi.mock('../journal/windowsSelfIdentity', () => ({ readWindowsJournalWriterIdentity: () => mocks.identity(process.pid) }))

let directory: string
let journalPath: string
let target: ResolvedWechatDevtoolsTarget
let recoveryScope: MachineE2ELeaseRecoveryScope
const deadOwnerPid = process.pid + 1

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'installation-exit-test-'))
  journalPath = await createManagedWechatProjectJournal(directory)
  target = { cliPath: path.join(directory, 'selected.app/Contents/MacOS/cli'), appPath: path.join(directory, 'selected.app/Contents/Resources/app.asar'), profileDir: path.join(directory, 'profile'), installationId: 'selected', version: '1.0.0', channel: 'stable' }
  recoveryScope = { id: randomUUID(), owner: { pid: process.pid, token: randomUUID() }, ancestors: [], sealed: true, completed: false, cleanupKey: journalPath }
  mocks.guard.mockImplementation(async (scope) => {
    if (scope !== recoveryScope) {
      throw new Error('Not an active machine recovery callback.')
    }
  })
  mocks.operation.mockImplementation(async (scope, run) => {
    await mocks.guard(scope)
    return run()
  })
  mocks.identity.mockImplementation(async (pid: number) => pid === process.pid ? { pid, executable: 'test-worker', started: 'test-start' } : undefined)
  mocks.installation.mockResolvedValue(undefined)
  mocks.port.mockResolvedValue(true)
  mocks.inventory.mockResolvedValue({ platform: 'darwin', installationRoot: path.join(directory, 'selected.app'), checkedAt: new Date().toISOString(), inspectedProcessCount: 7, kernelPathProcessCount: 7, textImageProcessCount: 0, exitedProcessCount: 0, zombieProcessCount: 0, selectedProcessCount: 0 })
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

async function record(overrides: Partial<ManagedWechatProjectRecord> = {}) {
  const entry: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id: randomUUID(),
    generation: randomUUID(),
    journalPath,
    ownerToken: randomUUID(),
    ownerPid: deadOwnerPid,
    target,
    projectPath: path.join(directory, 'project'),
    state: 'unconfirmed',
    port: 19001,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: 'Original invalid start receipt',
    ...overrides,
  }
  await writeManagedRecord(entry)
  return entry
}

const recover = () => recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope })
const bytes = (entry: ManagedWechatProjectRecord) => fs.readFile(managedRecordPath(entry.journalPath, entry.id), 'utf8')

describe('explicit installation-exit recovery', () => {
  it.each([false, true])('terminates failed confirmed ownership with close evidence=%s without inventing destruction', async (dispatched) => {
    const windowClose = dispatched
      ? {
          protocol: 'wechat-devtools-window-close-trace-v1' as const,
          profileDir: target.profileDir,
          productVersion: target.version!,
          capturedAt: new Date().toISOString(),
          dispatchedAt: new Date().toISOString(),
          cursors: [{ name: 'original-main.log', identity: 'original-stream', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
          calls: [],
          failure: 'Original window destruction evidence unavailable',
        }
      : undefined
    const entry = await record({
      state: 'failed',
      openedProjectWindow: true,
      host: { pid: deadOwnerPid, executable: 'selected-backend', started: 'original-host' },
      error: 'Listener exited before confirmed project close',
      windowClose,
    })
    const before = await bytes(entry)
    expect(await recover()).toEqual({ recoveredRecordIds: [entry.id] })
    const after = await readManagedRecord(journalPath, entry.id)
    expect(after).toMatchObject({
      state: 'released',
      releasedReason: 'installation-exited',
      host: entry.host,
      error: entry.error,
      installationExitRecovery: {
        previous: { state: 'failed', error: entry.error, recordSha256: createHash('sha256').update(before).digest('hex') },
      },
    })
    expect(after.windowClose).toEqual(windowClose)
    expect(after.closeAcknowledgedAt).toBeUndefined()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it.each(['starting', 'unconfirmed'] as const)('terminates %s only with original failure and byte fingerprint preserved', async (state) => {
    const entry = await record({ state })
    const before = await bytes(entry)
    expect(await recover()).toEqual({ recoveredRecordIds: [entry.id] })
    const after = await readManagedRecord(journalPath, entry.id)
    expect(after).toMatchObject({
      state: 'released',
      releasedReason: 'installation-exited',
      error: entry.error,
      installationExitRecovery: {
        protocol: 'wechat-devtools-installation-exit-v1',
        recoveryScopeId: recoveryScope.id,
        installationId: target.installationId,
        profileDir: target.profileDir,
        previous: { state, error: entry.error, updatedAt: entry.updatedAt, recordSha256: createHash('sha256').update(before).digest('hex') },
        stoppedOwnerPids: [deadOwnerPid],
        closedPorts: [19001],
        processInspection: { selectedProcessCount: 0 },
      },
    })
    for (const key of ['openedProjectWindow', 'host', 'windowClose', 'closeAcknowledgedAt']) {
      expect(after).not.toHaveProperty(key)
    }
    expect(mocks.inventory).toHaveBeenCalledTimes(2)
    expect(mocks.operation).toHaveBeenCalledExactlyOnceWith(recoveryScope, expect.any(Function))
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('preserves already released records byte-for-byte and is idempotent', async () => {
    const released = await record({ state: 'released', releasedReason: 'project-closed' })
    const pending = await record()
    const releasedBefore = await bytes(released)
    await recover()
    const recoveredBefore = await bytes(pending)
    mocks.inventory.mockRejectedValue(new Error('A later manual instance must not be inspected by a no-op.'))
    expect(await recover()).toEqual({ recoveredRecordIds: [] })
    expect(await bytes(released)).toBe(releasedBefore)
    expect(await bytes(pending)).toBe(recoveredBefore)
  })

  it('rejects a forged recovery scope before touching its journal', async () => {
    const entry = await record()
    const before = await bytes(entry)
    await expect(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope: { ...recoveryScope } })).rejects.toThrow('active machine recovery')
    expect(await bytes(entry)).toBe(before)
    expect(mocks.inventory).not.toHaveBeenCalled()
  })

  it.each(['installationId', 'profileDir'] as const)('rejects another %s without changing records', async (key) => {
    const entry = await record({ target: { ...target, [key]: `${target[key]}-other` } })
    const before = await bytes(entry)
    await expect(recover()).rejects.toThrow('another installation or profile')
    expect(await bytes(entry)).toBe(before)
  })

  it('rejects an installation that changed since the task recorded it', async () => {
    const entry = await record()
    const before = await bytes(entry)
    mocks.installation.mockRejectedValue(new Error('Installation changed'))
    await expect(recover()).rejects.toThrow('Installation changed')
    expect(await bytes(entry)).toBe(before)
  })

  it('checks every journal owner, including an already released sibling', async () => {
    await record({ state: 'released', releasedReason: 'borrowed', ownerPid: process.pid })
    const pending = await record()
    const before = await bytes(pending)
    await expect(recover()).rejects.toThrow('every journal owner process')
    expect(await bytes(pending)).toBe(before)
  })

  it.each(['owned', 'borrowed', 'closing', 'failed'] as const)('does not replace %s ownership with installation-exit recovery', async (state) => {
    const entry = await record({ state })
    const before = await bytes(entry)
    await expect(recover()).rejects.toThrow('confirmed or unresolved project-close')
    expect(await bytes(entry)).toBe(before)
  })

  it.each([
    ['live-port', 'unconfirmed'],
    ['live-installation', 'unconfirmed'],
    ['unknown-process', 'unconfirmed'],
    ['live-port', 'failed'],
    ['live-installation', 'failed'],
    ['unknown-process', 'failed'],
  ] as const)('keeps %s evidence from releasing %s ownership', async (kind, state) => {
    const entry = await record({ state, ...(state === 'failed' ? { openedProjectWindow: true, host: { pid: deadOwnerPid, executable: 'selected-backend', started: 'original-host' } } : {}) })
    const before = await bytes(entry)
    if (kind === 'live-port') {
      mocks.port.mockResolvedValue(false)
    }
    else {
      mocks.inventory.mockRejectedValue(new Error(kind))
    }
    await expect(recover()).rejects.toThrow()
    expect(await bytes(entry)).toBe(before)
  })

  it('rejects a missing registered port instead of guessing', async () => {
    const entry = await record({ port: undefined })
    const before = await bytes(entry)
    await expect(recover()).rejects.toThrow('every registered automator port')
    expect(await bytes(entry)).toBe(before)
  })

  it('detects journal changes during the first exit inspection', async () => {
    const entry = await record()
    const changed = { ...entry, error: 'Different recorded failure' }
    const inspection = await mocks.inventory()
    mocks.inventory.mockImplementationOnce(async () => {
      await writeManagedRecord(changed)
      return inspection
    })
    await expect(recover()).rejects.toThrow('journal records changed')
    expect(await readManagedRecord(journalPath, entry.id)).toMatchObject({ state: 'unconfirmed', error: changed.error })
  })

  it('rechecks absence immediately before recording recovery', async () => {
    const entry = await record()
    const before = await bytes(entry)
    mocks.inventory.mockResolvedValueOnce(await mocks.inventory()).mockRejectedValueOnce(new Error('Host appeared again'))
    await expect(recover()).rejects.toThrow('Host appeared again')
    expect(await bytes(entry)).toBe(before)
  })

  it('checks all task owners but recovers only the exact cleanup subtree', async () => {
    const child = await createManagedWechatProjectJournal(directory, journalPath)
    const sibling = await record()
    const pending = await record({ journalPath: child })
    const siblingBefore = await bytes(sibling)
    recoveryScope = { ...recoveryScope, cleanupKey: child }
    expect(await recover()).toEqual({ recoveredRecordIds: [pending.id] })
    expect(await bytes(sibling)).toBe(siblingBefore)
    expect(await readManagedRecord(child, pending.id)).toMatchObject({ state: 'released', releasedReason: 'installation-exited' })
  })

  it.each(['record', 'scope'] as const)('detects %s changes during the final inventory before writing', async (kind) => {
    const entry = await record()
    const before = await bytes(entry)
    const inspection = await mocks.inventory()
    mocks.inventory.mockResolvedValueOnce(inspection).mockImplementationOnce(async () => {
      if (kind === 'record') {
        await fs.writeFile(managedRecordPath(journalPath, entry.id), `${before}\n`)
      }
      else {
        await fs.writeFile(path.join(journalPath, '.ownership-scope'), JSON.stringify({ schemaVersion: 1, rootPath: journalPath, scopeId: randomUUID() }))
      }
      return inspection
    })
    await expect(recover()).rejects.toThrow(kind === 'record' ? 'journal bytes changed' : 'journal ownership changed')
    expect(await readManagedRecord(journalPath, entry.id)).toMatchObject({ state: 'unconfirmed', error: entry.error })
  })

  it('refuses writing after the recovery callback is no longer active', async () => {
    const entry = await record()
    const before = await bytes(entry)
    const inspection = await mocks.inventory()
    mocks.inventory.mockResolvedValueOnce(inspection).mockImplementationOnce(async () => {
      mocks.guard.mockRejectedValue(new Error('Recovery callback has ended'))
      return inspection
    })
    await expect(recover()).rejects.toThrow('Recovery callback has ended')
    expect(await bytes(entry)).toBe(before)
  })

  it('refuses an unregistered journal even inside a branded recovery callback', async () => {
    const unregistered = path.join(directory, 'unregistered')
    await fs.mkdir(unregistered)
    recoveryScope = { ...recoveryScope, cleanupKey: unregistered }
    await expect(recover()).rejects.toThrow('explicitly registered task journal')
  })
})
