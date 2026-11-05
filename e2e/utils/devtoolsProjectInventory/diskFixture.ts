import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import type { IsolatedMachineLease } from '../testSupport/machineLease'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { writeManagedRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { initializeManagedJournalScope } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/scope'

export async function createInventoryRecord(root: string) {
  await fs.mkdir(root, { recursive: true })
  const journalPath = await fs.mkdtemp(path.join(root, 'task-scope-'))
  await initializeManagedJournalScope(journalPath)
  const id = randomUUID()
  const now = new Date().toISOString()
  const record: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id,
    generation: id,
    journalPath,
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    target: {
      cliPath: path.join(root, 'test-cli'),
      installationId: 'test-installation',
      appPath: path.join(root, 'test-app'),
      profileDir: path.join(root, 'test-profile'),
    },
    projectPath: path.join(root, 'test-project'),
    state: 'released',
    releasedReason: 'not-started',
    createdAt: now,
    updatedAt: now,
  }
  await writeManagedRecord(record)
  return record
}

/** 仅清理此独立测试 state 绑定的 scanner 记录，不触碰外层正式 scope。 */
export async function clearStoppedScannerEvidence(machine: IsolatedMachineLease, inventoryRoot: string) {
  const scopeDirectory = path.join(machine.stateDirectory, 'machine-e2e', 'scopes')
  const scopes = await fs.readdir(scopeDirectory)
  for (const name of scopes) {
    const scope = JSON.parse(await fs.readFile(path.join(scopeDirectory, name), 'utf8')) as { cleanupKey?: string, completed: boolean }
    if (!scope.cleanupKey || scope.cleanupKey === machine.journalPath) {
      continue
    }
    const record = await fs.readFile(scope.cleanupKey, 'utf8').then(value => JSON.parse(value) as Record<string, unknown>).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    })
    if (!record) {
      continue
    }
    if (record.protocol !== 'weapp-vite-inventory-scanner-ownership-v1' || record.rootDirectory !== inventoryRoot
      || !scope.completed || typeof record.stoppedAt !== 'string') {
      throw new Error('Scanner fixture ownership is incomplete; preserve its evidence.')
    }
    await fs.rm(path.dirname(scope.cleanupKey), { recursive: true })
  }
}
