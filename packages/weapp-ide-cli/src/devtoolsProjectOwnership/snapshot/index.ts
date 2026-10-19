import type { ManagedWechatProjectRecord } from '../types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { writeManagedRecord } from '../journal'

const MARKER = '.weapp-ide-snapshot-owner'

export function managedSnapshotPath(journalPath: string, id: string) {
  return path.join(journalPath, 'snapshots', id)
}

/** 窗口已经释放不代表本任务快照也已回收。 */
export function isManagedWechatProjectFullyReleased(record: {
  state: ManagedWechatProjectRecord['state']
  snapshot?: Pick<NonNullable<ManagedWechatProjectRecord['snapshot']>, 'state'>
}) {
  return record.state === 'released' && (!record.snapshot || record.snapshot.state === 'removed')
}

function markerValue(record: ManagedWechatProjectRecord) {
  return JSON.stringify({
    protocol: record.snapshot!.protocol,
    journalPath: record.journalPath,
    id: record.id,
    generation: record.generation,
    ownerToken: record.ownerToken,
    token: record.snapshot!.token,
    sourceProjectPath: record.snapshot!.sourceProjectPath,
    projectPath: record.projectPath,
    target: record.target,
  })
}

async function directoryStat(directory: string) {
  const stat = await fs.lstat(directory, { bigint: true })
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Managed DevTools snapshot directory identity changed; refusing filesystem cleanup.')
  }
  return { dev: String(stat.dev), ino: String(stat.ino) }
}

function assertPath(record: ManagedWechatProjectRecord) {
  if (!record.snapshot || record.projectPath !== managedSnapshotPath(record.journalPath, record.id)
    || !path.isAbsolute(record.snapshot.sourceProjectPath)
    || record.snapshot.sourceProjectPath === record.projectPath) {
    throw new Error('Managed DevTools snapshot is not bound to its exact task journal.')
  }
}

async function verifySnapshot(record: ManagedWechatProjectRecord, allowIncompleteCreation = false) {
  assertPath(record)
  const snapshot = record.snapshot!
  await directoryStat(record.journalPath)
  await directoryStat(path.dirname(record.projectPath))
  const actual = await directoryStat(record.projectPath)
  if (await fs.realpath(record.projectPath) !== path.join(await fs.realpath(record.journalPath), 'snapshots', record.id)) {
    throw new Error('Managed DevTools snapshot escaped its canonical task journal.')
  }
  if (!snapshot.directoryIdentity || actual.dev !== snapshot.directoryIdentity.dev || actual.ino !== snapshot.directoryIdentity.ino) {
    throw new Error('Managed DevTools snapshot directory was replaced; refusing cleanup.')
  }
  const marker = path.join(record.projectPath, MARKER)
  try {
    const stat = await fs.lstat(marker)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || await fs.readFile(marker, 'utf8') !== markerValue(record)) {
      throw new Error('Managed DevTools snapshot creation marker changed; refusing cleanup.')
    }
  }
  catch (error) {
    // 上次递归删除可能已移除 marker；只允许同一目录身份的已登记删除继续。
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT'
      || (!snapshot.cleanupStartedAt && !(allowIncompleteCreation && snapshot.state === 'reserved' && !snapshot.dispatchedAt))) {
      throw error
    }
  }
}

/** 调用方持有 journal 根锁；先登记预算，再独占创建本次 generation 的快照。 */
export async function prepareManagedProjectSnapshot(record: ManagedWechatProjectRecord, populate: (projectPath: string) => Promise<void>) {
  assertPath(record)
  const snapshot = record.snapshot!
  if (record.state !== 'starting' || snapshot.state !== 'reserved' || snapshot.directoryIdentity || snapshot.dispatchedAt) {
    throw new Error('Managed DevTools snapshot preparation requires its unused project reservation.')
  }
  await directoryStat(record.journalPath)
  const parent = path.dirname(record.projectPath)
  await fs.mkdir(parent, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') {
      throw error
    }
  })
  await directoryStat(parent)
  await fs.mkdir(record.projectPath, { mode: 0o700 })
  snapshot.directoryIdentity = await directoryStat(record.projectPath)
  await writeManagedRecord(record)
  await fs.writeFile(path.join(record.projectPath, MARKER), markerValue(record), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await populate(record.projectPath)
  await verifySnapshot(record)
  snapshot.state = 'ready'
  await writeManagedRecord(record)
}

/** 窗口与端口证据由原有 owner 协议提供；这里仅回收匹配 provenance 的快照。 */
export async function finalizeManagedProjectSnapshot(record: ManagedWechatProjectRecord) {
  if (!record.snapshot || record.snapshot.state === 'removed') {
    return
  }
  const snapshot = record.snapshot
  try {
    assertPath(record)
    if (record.state !== 'released' || !['project-closed', 'installation-exited', 'not-started'].includes(record.releasedReason ?? '')
      || (record.releasedReason === 'not-started' && (snapshot.dispatchedAt || record.openedProjectWindow !== undefined))) {
      throw new Error('Managed DevTools snapshot is still used by an unresolved project; preserving its files.')
    }
    const exists = await fs.lstat(record.projectPath).then(() => true).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return false
      }
      throw error
    })
    if (exists) {
      await verifySnapshot(record, true)
      snapshot.cleanupStartedAt ??= new Date().toISOString()
      await writeManagedRecord(record)
      await fs.rm(record.projectPath, { recursive: true })
    }
    snapshot.state = 'removed'
    snapshot.removedAt = new Date().toISOString()
    delete snapshot.cleanupError
    await writeManagedRecord(record)
  }
  catch (error) {
    snapshot.cleanupError = error instanceof Error ? error.message : String(error)
    await writeManagedRecord(record)
    throw error
  }
}
