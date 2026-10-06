import assert from 'node:assert/strict'
import path from 'node:path'
import { readManagedRecord } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'

/** 冷启动验收必须持有本轮新建窗口的回执，既有连接不能作为新启动证据。 */
export async function assertFreshDevtoolsWindow(
  metadata: { projectPath: string, port: number, managedProject?: { id: string, journalPath: string } },
  expected: { projectPath: string, startedAt: number },
) {
  assert(metadata.managedProject?.id && metadata.managedProject.journalPath, 'Fresh DevTools window requires a managed ownership receipt')
  assert(Number.isFinite(expected.startedAt), 'Fresh DevTools window requires a finite launch start time')
  const record = await readManagedRecord(metadata.managedProject.journalPath, metadata.managedProject.id)
  assert(record.state === 'owned' && record.openedProjectWindow === true, 'Fresh DevTools window must be newly opened and owned by this launch')
  assert(record.host, 'Fresh DevTools window requires its confirmed host identity')
  assert(!record.windowClose?.dispatchedAt && !record.closeAcknowledgedAt, 'Fresh DevTools window must not have started closing')
  const projectPath = path.resolve(expected.projectPath)
  assert(path.resolve(metadata.projectPath) === projectPath && path.resolve(record.projectPath) === projectPath, 'Fresh DevTools window project must match this launch and its receipt')
  assert(record.port === metadata.port, 'Fresh DevTools window port must match its ownership receipt')
  const createdAt = Date.parse(record.createdAt)
  assert(Number.isFinite(createdAt) && createdAt >= expected.startedAt, 'Fresh DevTools window ownership receipt must be created during this launch')
  return { openedProjectWindow: true as const, createdAt: record.createdAt, state: record.state }
}
