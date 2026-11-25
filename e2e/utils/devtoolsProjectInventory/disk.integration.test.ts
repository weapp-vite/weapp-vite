import type { IsolatedMachineLease } from '../testSupport/machineLease'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeManagedRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createIsolatedMachineLease } from '../testSupport/machineLease'
import { clearStoppedScannerEvidence, createInventoryRecord } from './diskFixture'
import { scanDevtoolsProjectInventory } from './index'

let machine: IsolatedMachineLease
let root: string

beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  root = path.join(path.dirname(machine.stateDirectory), 'inventory')
})
afterEach(async () => {
  await clearStoppedScannerEvidence(machine, root)
  await machine.dispose()
})

async function scan(signal: AbortSignal) {
  await scanDevtoolsProjectInventory(root, {
    signal,
    timeoutMs: 60_000,
    machineLeaseOptions: { stateDirectory: machine.stateDirectory, env: { ...machine.environment } },
  })
}

describe('isolated inventory child with real journal files', () => {
  it('accepts a missing inventory without creating a journal or directory', async (context) => {
    await expect(scan(context.signal)).resolves.toBeUndefined()
    await expect(fs.stat(root)).rejects.toMatchObject({ code: 'ENOENT' })
  }, 75_000)

  it('reads a released task without changing its directory or record bytes', async (context) => {
    const record = await createInventoryRecord(root)
    const recordPath = path.join(record.journalPath, `${record.id}.json`)
    const before = await fs.readFile(recordPath, 'utf8')
    const entries = await fs.readdir(root)
    await expect(scan(context.signal)).resolves.toBeUndefined()
    expect(await fs.readdir(root)).toEqual(entries)
    expect(await fs.readFile(recordPath, 'utf8')).toBe(before)
  }, 30_000)

  it('preserves unresolved ownership as a failed child result', async (context) => {
    const record = await createInventoryRecord(root)
    await writeManagedRecord({ ...record, state: 'unconfirmed', releasedReason: undefined })
    await expect(scan(context.signal)).rejects.toThrow(/unresolved project ownership.*unconfirmed/)
    expect(await fs.readdir(root)).toEqual([path.basename(record.journalPath)])
  }, 30_000)

  it('rejects a released record whose snapshot is still reserved', async (context) => {
    const record = await createInventoryRecord(root)
    await writeManagedRecord({
      ...record,
      projectPath: path.join(record.journalPath, 'snapshots', record.id),
      snapshot: { protocol: 'wechat-devtools-project-snapshot-v1', token: record.id, sourceProjectPath: path.join(root, 'source'), state: 'reserved' },
    })
    await expect(scan(context.signal)).rejects.toThrow(/unresolved project ownership/)
  }, 30_000)

  it('rejects a released record whose snapshot is still ready', async (context) => {
    const record = await createInventoryRecord(root)
    await writeManagedRecord({
      ...record,
      projectPath: path.join(record.journalPath, 'snapshots', record.id),
      snapshot: { protocol: 'wechat-devtools-project-snapshot-v1', token: record.id, sourceProjectPath: path.join(root, 'source'), state: 'ready' },
    })
    await expect(scan(context.signal)).rejects.toThrow(/unresolved project ownership/)
  }, 30_000)

  it('rejects invalid scope metadata instead of accepting an empty task', async (context) => {
    const record = await createInventoryRecord(root)
    await fs.writeFile(path.join(record.journalPath, '.ownership-scope'), '{')
    await expect(scan(context.signal)).rejects.toThrow(/exited unsuccessfully/)
  }, 30_000)
})
