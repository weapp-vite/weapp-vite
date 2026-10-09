import type { MachineE2ELeaseRecoveryScope } from '@weapp-vite/devtools-runtime'
import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import type { ManagedWechatProjectRecord } from '../types'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { assertMachineE2ELeaseRecoveryScope, withMachineE2ELeaseRecoveryOperation } from '@weapp-vite/devtools-runtime'
import { assertManagedInstallation, isManagedPortClosed, readManagedProcessIdentity } from '../host'
import { managedRecordPath, readManagedWechatProjectRecords, withManagedJournalLock, writeManagedRecord } from '../journal'
import { resolveManagedJournalScope } from '../journal/scope'
import { inspectExitedWechatInstallation } from './processes'

export interface RecoverManagedWechatProjectsAfterInstallationExitOptions {
  target: ResolvedWechatDevtoolsTarget
  recoveryScope: MachineE2ELeaseRecoveryScope
}

export interface ManagedWechatInstallationExitRecoveryResult {
  recoveredRecordIds: string[]
}

async function fingerprint(record: ManagedWechatProjectRecord) {
  const file = managedRecordPath(record.journalPath, record.id)
  const stat = await fs.lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error('Installation-exit recovery requires an unchanged regular journal record.')
  }
  return createHash('sha256').update(await fs.readFile(file)).digest('hex')
}

async function recoverAfterExit(
  options: RecoverManagedWechatProjectsAfterInstallationExitOptions,
): Promise<ManagedWechatInstallationExitRecoveryResult> {
  const { target, recoveryScope } = options
  await assertMachineE2ELeaseRecoveryScope(recoveryScope)
  const journalPath = recoveryScope.cleanupKey
  if (!journalPath || !path.isAbsolute(journalPath) || path.resolve(journalPath) !== journalPath) {
    throw new Error('Installation-exit recovery requires its exact registered journal cleanup key.')
  }
  const binding = await resolveManagedJournalScope(journalPath)
  if (!binding.scopeId) {
    throw new Error('Installation-exit recovery requires an explicitly registered task journal scope.')
  }
  return withManagedJournalLock(journalPath, async (rootPath) => {
    if (rootPath !== binding.rootPath || !isDeepStrictEqual(await resolveManagedJournalScope(journalPath), binding)) {
      throw new Error('Installation-exit recovery journal ownership changed.')
    }
    const records = await readManagedWechatProjectRecords(rootPath)
    if (new Set(records.map(record => record.id)).size !== records.length) {
      throw new Error('Installation-exit recovery found duplicate record identities.')
    }
    if (records.some(record => !isDeepStrictEqual(record.target, target))) {
      throw new Error('Installation-exit recovery cannot include another installation or profile.')
    }
    if (records.some(record => !['released', 'starting', 'unconfirmed'].includes(record.state))) {
      throw new Error('Installation-exit recovery refuses confirmed or unresolved project-close ownership.')
    }
    const scopeRecords = await readManagedWechatProjectRecords(journalPath)
    const candidates = scopeRecords.filter(record => record.state === 'starting' || record.state === 'unconfirmed')
    if (!candidates.length) {
      await assertMachineE2ELeaseRecoveryScope(recoveryScope)
      return { recoveredRecordIds: [] }
    }
    const before = new Map(await Promise.all(records.map(async record => [record.id, await fingerprint(record)] as const)))
    const ownerPids = [...new Set(records.map(record => record.ownerPid))].sort((a, b) => a - b)
    const ports = [...new Set(records.map(record => record.port))]
    if (ports.includes(undefined)) {
      throw new Error('Installation-exit recovery requires every registered automator port.')
    }
    const closedPorts = (ports as number[]).sort((a, b) => a - b)
    const verifyExit = async () => {
      await assertMachineE2ELeaseRecoveryScope(recoveryScope)
      await assertManagedInstallation(target)
      for (const pid of ownerPids) {
        if (await readManagedProcessIdentity(pid)) {
          throw new Error('Installation-exit recovery requires every journal owner process to have stopped.')
        }
      }
      for (const port of closedPorts) {
        if (!await isManagedPortClosed(port)) {
          throw new Error('Installation-exit recovery found a live registered automator port.')
        }
      }
      return inspectExitedWechatInstallation(target)
    }
    const assertUnchanged = async () => {
      if (!isDeepStrictEqual(await resolveManagedJournalScope(journalPath), binding)) {
        throw new Error('Installation-exit recovery journal ownership changed.')
      }
      const current = await readManagedWechatProjectRecords(rootPath)
      if (!isDeepStrictEqual(current, records)) {
        throw new Error('Installation-exit recovery journal records changed during verification.')
      }
      for (const record of current) {
        if (await fingerprint(record) !== before.get(record.id)) {
          throw new Error('Installation-exit recovery journal bytes changed during verification.')
        }
      }
    }
    await verifyExit()
    await assertUnchanged()
    const inspection = await verifyExit()
    await assertUnchanged()
    const recoveredRecordIds: string[] = []
    for (const record of candidates) {
      await assertMachineE2ELeaseRecoveryScope(recoveryScope)
      if (await fingerprint(record) !== before.get(record.id)) {
        throw new Error('Installation-exit recovery journal bytes changed before recording recovery.')
      }
      const previousState = record.state
      if (previousState !== 'starting' && previousState !== 'unconfirmed') {
        throw new Error('Installation-exit recovery cannot replace a confirmed ownership state.')
      }
      record.installationExitRecovery = {
        protocol: 'wechat-devtools-installation-exit-v1',
        recoveredAt: new Date().toISOString(),
        recoveryScopeId: recoveryScope.id,
        journalScopeId: binding.scopeId!,
        journalRootPath: rootPath,
        installationId: target.installationId,
        profileDir: target.profileDir,
        previous: { state: previousState, error: record.error, updatedAt: record.updatedAt, recordSha256: before.get(record.id)! },
        stoppedOwnerPids: ownerPids,
        closedPorts,
        processInspection: inspection,
      }
      record.state = 'released'
      record.releasedReason = 'installation-exited'
      await writeManagedRecord(record)
      recoveredRecordIds.push(record.id)
    }
    return { recoveredRecordIds }
  })
}

/** 在精确恢复租约中终结已完全退出安装的未知启动；不补造回执，也不取得关窗权限。 */
export function recoverManagedWechatProjectsAfterInstallationExit(
  options: RecoverManagedWechatProjectsAfterInstallationExitOptions,
): Promise<ManagedWechatInstallationExitRecoveryResult> {
  return withMachineE2ELeaseRecoveryOperation(options.recoveryScope, () => recoverAfterExit(options))
}
