import path from 'node:path'
import process from 'node:process'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createManagedWechatProjectJournal } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'

const ownedCleanups = new Set<() => Promise<void>>()
const JOURNAL_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-managed-devtools-projects')

/** 每个任务单独登记窗口；嵌套任务仍归属父任务的日志树。 */
export async function createDevtoolsProjectJournal(parentJournalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]) {
  return await createManagedWechatProjectJournal(JOURNAL_ROOT, parentJournalPath)
}

/** 直接运行 Vitest 时也为本轮 worker 建立独占窗口日志。 */
export async function ensureDevtoolsProjectJournal() {
  if (!process.env[MANAGED_PROJECT_JOURNAL_ENV]) {
    process.env[MANAGED_PROJECT_JOURNAL_ENV] = await createDevtoolsProjectJournal()
  }
  return process.env[MANAGED_PROJECT_JOURNAL_ENV]!
}

/** 只登记本次启动取得的资源；进程名、安装路径及共享临时目录均不能证明所有权。 */
export function ownDevtoolsCleanup(cleanup: () => Promise<void>) {
  let pending: Promise<void> | undefined
  const dispose = () => {
    pending ??= Promise.resolve().then(cleanup).then(() => {
      ownedCleanups.delete(dispose)
    }).catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
  ownedCleanups.add(dispose)
  return dispose
}

export async function cleanupOwnedDevtoolsProcesses(options: { journalPath?: string, scope?: 'process' | 'journal' } = {}) {
  const results = await Promise.allSettled([...ownedCleanups].map(dispose => dispose()))
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  // 连接与窗口分别归属：即使断开连接失败，也必须尝试回收已登记的项目窗口。
  try {
    await cleanupManagedWechatProjects({ ...options, scope: options.scope ?? 'process' })
  }
  catch (error) {
    errors.push(error)
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Failed to clean owned DevTools processes')
  }
}
