import type { BeginManagedWechatProjectOptions, CleanupManagedWechatProjectsOptions, ManagedWechatProjectIntent, ManagedWechatProjectRecord } from './types'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- 使用明确选定的官方 CLI 定向关闭项目。
import { execa } from 'execa'
import { assertManagedInstallation, inspectManagedProjectHost, isManagedPortClosed, readManagedProcessIdentity, sameManagedProcess, waitForManagedPortClosed } from './host'
import { managedProcessToken, readManagedRecord, readManagedWechatProjectRecords, resolveManagedJournal, withManagedJournalLock, writeManagedRecord } from './journal'
import { checkManagedWindowBudget } from './windowBudget'
import { captureManagedWindowClose, waitForManagedWindowClosed } from './windowClose'

export * from './installationExit'
export { MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from './journal'
export { MANAGED_PROJECT_MAX_WINDOWS_ENV } from './journal/constants'
export type * from './types'

const pendingClosures = new Map<string, Promise<void>>()

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function release(record: ManagedWechatProjectRecord, reason: ManagedWechatProjectRecord['releasedReason']) {
  record.state = 'released'
  record.releasedReason = reason
  delete record.error
  await writeManagedRecord(record)
}

async function closeRecord(record: ManagedWechatProjectRecord) {
  if (record.state === 'released') {
    return
  }
  if (record.state === 'borrowed' && record.openedProjectWindow === false) {
    await release(record, 'borrowed')
    return
  }
  if (record.state === 'starting' || record.state === 'unconfirmed' || record.openedProjectWindow !== true || !record.host || !record.port) {
    throw new Error('Managed DevTools project ownership is unconfirmed; refusing to close a project or start another task.')
  }
  try {
    if (record.closeAcknowledgedAt || record.windowClose?.dispatchedAt) {
      // 命令已发出或结果未知时只续读销毁证据，不能再次关闭同一路径。
      await waitForManagedWindowClosed(record, () => writeManagedRecord(record))
      await waitForManagedPortClosed(record.port)
      await release(record, 'project-closed')
      return
    }
    const live = await readManagedProcessIdentity(record.host.pid)
    if (!live) {
      throw new Error('Managed DevTools automator listener exited without a confirmed project close; window ownership remains unresolved.')
    }
    if (!sameManagedProcess(live, record.host)) {
      throw new Error('Managed DevTools host identity changed; no project was closed.')
    }
    // 后端断开不证明窗口消失，也不能再按旧路径关闭可能由用户重新打开的项目。
    if (await isManagedPortClosed(record.port)) {
      throw new Error('Managed DevTools automator port disappeared without a confirmed project close; window ownership remains unresolved.')
    }
    await assertManagedInstallation(record.target)
    if (!sameManagedProcess(await inspectManagedProjectHost(record.target, record.port), record.host)) {
      throw new Error('Managed DevTools port belongs to a different host; no project was closed.')
    }
    record.state = 'closing'
    record.windowClose = await captureManagedWindowClose(record)
    record.windowClose.dispatchedAt = new Date().toISOString()
    await writeManagedRecord(record)
    await execa(record.target.cliPath, ['close', '--project', record.projectPath], { timeout: 30_000, windowsHide: true })
    record.closeAcknowledgedAt = new Date().toISOString()
    await writeManagedRecord(record)
    await waitForManagedWindowClosed(record, () => writeManagedRecord(record))
    await waitForManagedPortClosed(record.port)
    await release(record, 'project-closed')
  }
  catch (error) {
    record.state = 'failed'
    record.error = describe(error)
    await writeManagedRecord(record)
    throw error
  }
}

/** 窗口销毁与连接断开分别验证；失败保留登记供后续继续观察。 */
export function closeManagedWechatProject(options: { journalPath?: string, id: string }): Promise<void> {
  const journalPath = resolveManagedJournal(options.journalPath)
  if (!journalPath) {
    return Promise.reject(new Error('Managed DevTools project cleanup requires its explicit task journal.'))
  }
  const key = `${journalPath}\0${options.id}`
  let closing = pendingClosures.get(key)
  if (!closing) {
    closing = withMachineE2ELease(async () => withManagedJournalLock(journalPath, async () => closeRecord(await readManagedRecord(journalPath, options.id))))
      .finally(() => pendingClosures.delete(key))
    pendingClosures.set(key, closing)
  }
  return closing
}

/** 未启用受管日志时不改变公共共享会话；意图登记本身没有项目关闭权。 */
export async function beginManagedWechatProject(options: BeginManagedWechatProjectOptions): Promise<ManagedWechatProjectIntent | undefined> {
  const journalPath = resolveManagedJournal(options.journalPath)
  if (!journalPath) {
    return undefined
  }
  const id = randomUUID()
  await withManagedJournalLock(journalPath, async (scopeRoot) => {
    const previous = await readManagedWechatProjectRecords(scopeRoot)
    if (previous.some(record => ['starting', 'unconfirmed', 'closing', 'failed'].includes(record.state))) {
      throw new Error('Managed DevTools journal contains unresolved ownership or cleanup; refusing another project start.')
    }
    checkManagedWindowBudget(previous, options)
    const now = new Date().toISOString()
    await writeManagedRecord({
      schemaVersion: 1,
      id,
      generation: options.generation ?? id,
      journalPath,
      ownerToken: managedProcessToken,
      ownerPid: process.pid,
      target: { ...options.target },
      projectPath: path.resolve(options.projectPath),
      state: 'starting',
      port: options.port,
      createdAt: now,
      updatedAt: now,
    })
  })
  return {
    id,
    journalPath,
    confirm: async (result) => {
      await withManagedJournalLock(journalPath, async () => {
        const record = await readManagedRecord(journalPath, id)
        if (record.state !== 'starting' && record.state !== 'unconfirmed') {
          throw new Error('Managed DevTools start receipt was already recorded.')
        }
        if (typeof result.openedProjectWindow !== 'boolean' || !Number.isInteger(result.port) || result.port <= 0 || result.port > 65535
          || (record.port !== undefined && record.port !== result.port)) {
          throw new Error('Managed DevTools start receipt does not match its requested port.')
        }
        record.openedProjectWindow = result.openedProjectWindow
        record.port = result.port
        record.state = result.openedProjectWindow ? 'unconfirmed' : 'borrowed'
        // 先持久化官方回执，再检查宿主；取消或检查失败不能丢失已创建窗口的事实。
        await writeManagedRecord(record)
        record.host = await inspectManagedProjectHost(record.target, result.port)
        if (result.openedProjectWindow) {
          record.state = 'owned'
        }
        await writeManagedRecord(record)
      })
    },
    fail: async (error) => {
      await withManagedJournalLock(journalPath, async () => {
        const record = await readManagedRecord(journalPath, id)
        if (record.state === 'released') {
          return
        }
        if (record.state === 'starting') {
          record.state = 'unconfirmed'
        }
        record.error = describe(error)
        await writeManagedRecord(record)
      })
    },
    close: () => closeManagedWechatProject({ journalPath, id }),
  }
}

/** 父进程可回收已退出工作进程的确认所有权；未知启动结果严格阻止后续任务。 */
export async function cleanupManagedWechatProjects(options: CleanupManagedWechatProjectsOptions = {}): Promise<void> {
  const records = await readManagedWechatProjectRecords(options.journalPath)
  const errors: unknown[] = []
  for (const record of records) {
    if (options.scope === 'process' && record.ownerToken !== managedProcessToken) {
      continue
    }
    try {
      await closeManagedWechatProject({ journalPath: record.journalPath, id: record.id })
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Managed DevTools project cleanup remains incomplete; stop the acceptance lane.')
  }
}
