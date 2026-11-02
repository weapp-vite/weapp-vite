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
import { installationExitRecoverySchema } from './schema'

const mocks = vi.hoisted(() => ({ operation: vi.fn(), guard: vi.fn(), identity: vi.fn(), disk: vi.fn(), port: vi.fn(), inventory: vi.fn() }))
vi.mock('@weapp-vite/devtools-runtime', async original => ({ ...await original<object>(), assertMachineE2ELeaseRecoveryScope: mocks.guard, withMachineE2ELeaseRecoveryOperation: mocks.operation }))
vi.mock('../host', async original => ({ ...await original<object>(), readManagedProcessIdentity: mocks.identity, isManagedPortClosed: mocks.port }))
vi.mock('../../devtoolsTarget/installation', () => ({ inspectWechatDevtoolsInstallation: mocks.disk }))
vi.mock('./processes', () => ({ inspectExitedWechatInstallation: mocks.inventory }))
vi.mock('../journal/windowsSelfIdentity', () => ({ readWindowsJournalWriterIdentity: () => mocks.identity(process.pid) }))

let directory: string
let journalPath: string
let target: ResolvedWechatDevtoolsTarget
let replacementTarget: ResolvedWechatDevtoolsTarget
let recoveryScope: MachineE2ELeaseRecoveryScope
let entry: ManagedWechatProjectRecord
let before: string
const ownerPid = process.pid + 1
const hostPid = process.pid + 2

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'installation-replacement-test-'))
  journalPath = await createManagedWechatProjectJournal(directory)
  target = { cliPath: path.join(directory, 'selected.app/Contents/MacOS/cli'), appPath: path.join(directory, 'selected.app/Contents/Resources/app.asar'), profileDir: path.join(directory, 'profile'), installationId: 'selected', version: '2.02.2609231', channel: 'rc' }
  replacementTarget = { ...target, version: '2.02.2609240', channel: 'stable' }
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
  mocks.disk.mockImplementation(async () => ({ ...replacementTarget }))
  mocks.port.mockResolvedValue(true)
  mocks.inventory.mockImplementation(async () => ({ platform: 'darwin', installationRoot: path.join(directory, 'selected.app'), checkedAt: new Date().toISOString(), inspectedProcessCount: 7 + mocks.inventory.mock.calls.length, kernelPathProcessCount: 7, textImageProcessCount: 0, exitedProcessCount: 0, zombieProcessCount: 0, selectedProcessCount: 0 }))
  entry = {
    schemaVersion: 1,
    id: randomUUID(),
    generation: randomUUID(),
    journalPath,
    ownerToken: randomUUID(),
    ownerPid,
    target,
    projectPath: path.join(directory, 'project'),
    state: 'unconfirmed',
    port: 19001,
    host: { pid: hostPid, executable: 'original-backend', started: 'original-host' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: 'Original ambiguous start receipt',
  }
  await writeManagedRecord(entry)
  before = await fs.readFile(managedRecordPath(journalPath, entry.id), 'utf8')
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

const recover = () => recoverManagedWechatProjectsAfterInstallationExit({ target, replacementTarget, recoveryScope })
const bytes = () => fs.readFile(managedRecordPath(journalPath, entry.id), 'utf8')

describe('explicit same-installation replacement recovery', () => {
  it('keeps ordinary recovery strict when the disk version and channel changed', async () => {
    await expect(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope })).rejects.toThrow('installation changed')
    expect(await bytes()).toBe(before)
    expect(mocks.inventory).not.toHaveBeenCalled()
  })

  it('preserves the original target and failure with both verified replacement exit inventories', async () => {
    expect(await recover()).toEqual({ recoveredRecordIds: [entry.id] })
    const after = await readManagedRecord(journalPath, entry.id)
    expect(after).toMatchObject({
      state: 'released',
      releasedReason: 'installation-exited',
      target,
      host: entry.host,
      error: entry.error,
      installationExitRecovery: {
        previous: { state: entry.state, error: entry.error, updatedAt: entry.updatedAt, recordSha256: createHash('sha256').update(before).digest('hex') },
        stoppedOwnerPids: [ownerPid],
        closedPorts: [entry.port],
        replacement: { protocol: 'wechat-devtools-installation-replacement-exit-v1', originalTarget: target, replacementTarget, stoppedHostPids: [hostPid] },
      },
    })
    const evidence = after.installationExitRecovery!
    expect(evidence.replacement!.exitInspections).toHaveLength(2)
    expect(evidence.replacement!.exitInspections[0].inspectedProcessCount).toBe(8)
    expect(evidence.replacement!.exitInspections[1]).toEqual(evidence.processInspection)
    expect(mocks.inventory).toHaveBeenCalledTimes(2)
    expect(mocks.inventory).toHaveBeenNthCalledWith(1, replacementTarget)
    expect(mocks.inventory).toHaveBeenNthCalledWith(2, replacementTarget)
    expect(mocks.disk).toHaveBeenCalledTimes(4)
    expect(after.openedProjectWindow).toBeUndefined()
    expect(after.windowClose).toBeUndefined()
    expect(after.closeAcknowledgedAt).toBeUndefined()
    const recoveredBytes = await bytes()
    mocks.disk.mockRejectedValue(new Error('A later manual host must not be inspected.'))
    expect(await recover()).toEqual({ recoveredRecordIds: [] })
    expect(await bytes()).toBe(recoveredBytes)
  })

  it.each(['cliPath', 'appPath', 'profileDir', 'installationId'] as const)('refuses a replacement with a different %s', async (key) => {
    replacementTarget = { ...replacementTarget, [key]: `${replacementTarget[key]}-other` }
    await expect(recover()).rejects.toThrow('same-installation replacement')
    expect(await bytes()).toBe(before)
    expect(mocks.disk).not.toHaveBeenCalled()
  })

  it.each([
    { version: undefined },
    { version: 'invalid' },
    { channel: undefined },
    { channel: 'unknown' as const },
  ])('refuses missing or unknown metadata %j on either target', async (metadata) => {
    replacementTarget = { ...replacementTarget, ...metadata }
    await expect(recover()).rejects.toThrow('valid changed version or channel')
    expect(await bytes()).toBe(before)
    replacementTarget = { ...target, version: '2.02.2609240', channel: 'stable' }
    target = { ...target, ...metadata }
    if (target.version === undefined) {
      delete target.version
    }
    if (target.channel === undefined) {
      delete target.channel
    }
    entry.target = target
    await writeManagedRecord(entry)
    before = await bytes()
    await expect(recover()).rejects.toThrow('valid changed version or channel')
    expect(await bytes()).toBe(before)
  })

  it('refuses an unchanged replacement and refuses rewriting the original target', async () => {
    replacementTarget = { ...target }
    await expect(recover()).rejects.toThrow('valid changed version or channel')
    target = { ...target, version: '2.02.2609240' }
    await expect(recover()).rejects.toThrow('another installation or profile')
    expect(await bytes()).toBe(before)
  })

  it.each(['owner', 'host', 'port', 'installation', 'unknown-process'] as const)('refuses a live or unverifiable %s', async (kind) => {
    if (kind === 'owner' || kind === 'host') {
      const livePid = kind === 'owner' ? ownerPid : hostPid
      mocks.identity.mockImplementation(async (pid: number) => [livePid, process.pid].includes(pid) ? { pid, executable: 'live-process', started: 'live-start' } : undefined)
    }
    else if (kind === 'port') {
      mocks.port.mockResolvedValue(false)
    }
    else {
      mocks.inventory.mockRejectedValue(new Error(kind))
    }
    await expect(recover()).rejects.toThrow()
    expect(await bytes()).toBe(before)
  })

  it.each([2, 3, 4])('rejects disk metadata drift at read %s', async (read) => {
    mocks.disk.mockImplementation(async () => ({ ...replacementTarget, ...(mocks.disk.mock.calls.length >= read ? { version: '2.02.2609250' } : {}) }))
    await expect(recover()).rejects.toThrow('installation changed')
    expect(await bytes()).toBe(before)
  })

  it.each(['record', 'bytes', 'scope'] as const)('rejects %s mutation during replacement verification', async (kind) => {
    const inspection = await mocks.inventory()
    mocks.inventory.mockImplementationOnce(async () => {
      if (kind === 'record') {
        await writeManagedRecord({ ...entry, error: 'Changed original failure' })
      }
      else if (kind === 'bytes') {
        await fs.writeFile(managedRecordPath(journalPath, entry.id), `${before}\n`)
      }
      else {
        await fs.writeFile(path.join(journalPath, '.ownership-scope'), JSON.stringify({ schemaVersion: 1, rootPath: journalPath, scopeId: randomUUID() }))
      }
      return inspection
    })
    await expect(recover()).rejects.toThrow(kind === 'record' ? 'journal records changed' : kind === 'bytes' ? 'journal bytes changed' : 'journal ownership changed')
    expect(await readManagedRecord(journalPath, entry.id)).toMatchObject({ state: 'unconfirmed' })
  })

  it('validates both replacement targets and complete evidence when reading the journal', async () => {
    await recover()
    const after = await readManagedRecord(journalPath, entry.id)
    const evidence = after.installationExitRecovery!
    expect(installationExitRecoverySchema.safeParse(evidence).success).toBe(true)
    const replacement = evidence.replacement!
    for (const invalid of [
      { ...replacement, replacementTarget: target },
      { ...replacement, replacementTarget: { ...replacementTarget, channel: 'unknown' } },
      { ...replacement, replacementTarget: { ...replacementTarget, profileDir: 'another-profile' } },
      { ...replacement, originalTarget: { ...target, installationId: 'another-installation' } },
      { ...replacement, exitInspections: [evidence.processInspection] },
      { ...replacement, exitInspections: [evidence.processInspection, { ...evidence.processInspection, selectedProcessCount: 1 }] },
      { ...replacement, exitInspections: [evidence.processInspection, { ...evidence.processInspection, inspectedProcessCount: 42 }] },
    ]) {
      const invalidEvidence = { ...evidence, replacement: invalid }
      expect(installationExitRecoverySchema.safeParse(invalidEvidence).success).toBe(false)
      await fs.writeFile(managedRecordPath(journalPath, entry.id), JSON.stringify({ ...after, installationExitRecovery: invalidEvidence }))
      await expect(readManagedRecord(journalPath, entry.id)).rejects.toThrow()
    }
  })
})
