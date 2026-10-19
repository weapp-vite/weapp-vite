import type { ManagedWechatProjectRecord, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import path from 'node:path'
import process from 'node:process'
import { isManagedWechatProjectFullyReleased, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from 'weapp-ide-cli'

export type PluginProjectLayout = 'source' | 'snapshot'

export interface PluginOpenExpectation {
  sourceProjectPath: string
  layout: PluginProjectLayout
  target: ResolvedWechatDevtoolsTarget
  port: number
}

function identity(record: ManagedWechatProjectRecord) {
  return JSON.stringify([record.journalPath, record.id, record.generation])
}

function targetIdentity(target: ResolvedWechatDevtoolsTarget) {
  return [target.installationId, target.cliPath, target.appPath, target.profileDir, target.channel, target.version]
}

/** 只读本任务正式登记的 journal 及子 scope，不猜测用户缓存或会话文件。 */
export async function readPluginOpenRecords() {
  const journalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim()
  if (!journalPath) {
    throw new Error('Plugin dev:open acceptance requires its explicit managed project journal.')
  }
  return await readManagedWechatProjectRecords(journalPath)
}

/** 前一条路径必须完整释放，历史已释放记录仅作为本次新 owner 的排除基线。 */
export function capturePluginOpenBaseline(records: ManagedWechatProjectRecord[]) {
  if (records.some(record => !isManagedWechatProjectFullyReleased(record))) {
    throw new Error('Plugin dev:open has unresolved ownership before its fresh launch.')
  }
  return records.map(identity)
}

/** 运行目录只由本次官方回执和快照 provenance 证明，source alias 不代表实际目录。 */
export function assertPluginOpenEvidence(
  records: ManagedWechatProjectRecord[],
  baseline: string[],
  expected: PluginOpenExpectation,
  wsEndpoint?: string,
) {
  const fresh = records.filter(record => !baseline.includes(identity(record)))
  if (fresh.length !== 1) {
    throw new Error(`Plugin dev:open requires exactly one fresh owner; found ${fresh.length}.`)
  }
  const record = fresh[0]!
  if (record.state !== 'owned' || record.openedProjectWindow !== true || !record.host
    || record.port !== expected.port
    || JSON.stringify(targetIdentity(record.target)) !== JSON.stringify(targetIdentity(expected.target))) {
    throw new Error('Plugin dev:open owner has no matching confirmed window, installation, or port.')
  }
  const source = path.resolve(expected.sourceProjectPath)
  if (expected.layout === 'source') {
    if (path.resolve(record.projectPath) !== source || record.snapshot) {
      throw new Error('Default CLI did not open the source plugin project P.')
    }
  }
  else if (!record.snapshot || record.snapshot.protocol !== 'wechat-devtools-project-snapshot-v1'
    || record.snapshot.state !== 'ready' || !record.snapshot.dispatchedAt
    || !record.snapshot.token || !record.snapshot.directoryIdentity
    || path.resolve(record.snapshot.sourceProjectPath) !== source
    || path.resolve(record.projectPath) !== path.join(record.journalPath, 'snapshots', record.id)) {
    throw new Error('Explicit automator did not open this owner\'s plugin snapshot W.')
  }
  if (wsEndpoint) {
    const endpoint = new URL(wsEndpoint)
    if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1'
      || Number(endpoint.port) !== record.port || endpoint.pathname !== '/') {
      throw new Error('Plugin dev:open connection endpoint does not match its journal owner.')
    }
  }
  return record
}

function stableOwner(record: ManagedWechatProjectRecord) {
  return {
    id: record.id,
    generation: record.generation,
    journalPath: record.journalPath,
    ownerToken: record.ownerToken,
    projectPath: record.projectPath,
    target: targetIdentity(record.target),
    port: record.port,
    host: record.host,
    openedProjectWindow: record.openedProjectWindow,
    snapshot: record.snapshot,
  }
}

/** 日志订阅只能借用原连接，不能创建另一窗口或替换快照 owner。 */
export function assertPluginOpenOwnerUnchanged(before: ManagedWechatProjectRecord, after: ManagedWechatProjectRecord) {
  if (JSON.stringify(stableOwner(before)) !== JSON.stringify(stableOwner(after))) {
    throw new Error('Plugin dev:open owner changed while attaching its runtime log consumer.')
  }
}

/** 正式 close 必须同时留下原生窗口双销毁证据和快照清理证据。 */
export function assertPluginOpenReleased(records: ManagedWechatProjectRecord[], opened: ManagedWechatProjectRecord) {
  const record = records.find(value => identity(value) === identity(opened))
  if (!record || record.ownerToken !== opened.ownerToken || !isManagedWechatProjectFullyReleased(record)
    || record.projectPath !== opened.projectPath || record.port !== opened.port
    || JSON.stringify(targetIdentity(record.target)) !== JSON.stringify(targetIdentity(opened.target))
    || record.snapshot?.token !== opened.snapshot?.token
    || record.snapshot?.sourceProjectPath !== opened.snapshot?.sourceProjectPath
    || record.releasedReason !== 'project-closed'
    || record.windowClose?.profileDir !== opened.target.profileDir
    || !record.windowClose?.window?.nativeClosedAt || !record.windowClose.window.webContentsDestroyedAt) {
    throw new Error('Plugin dev:open window, port, or snapshot release remains unconfirmed.')
  }
  return record
}
