import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { cleanupManagedWechatProjects, isManagedWechatProjectFullyReleased, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { createManagedWechatProjectJournal } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { scanDevtoolsProjectInventory } from './devtoolsProjectInventory'

const ownedCleanups = new Set<() => Promise<void>>()
const JOURNAL_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-managed-devtools-projects')

/** 跨运行检查本仓库登记的任务；只读取本项目 journal，不扫描用户 IDE 缓存或其他 worktree。 */
export async function assertNoUnreleasedDevtoolsProjects(rootDirectory = JOURNAL_ROOT, options: { signal?: AbortSignal } = {}) {
  const { signal } = options
  signal?.throwIfAborted()
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  signal?.throwIfAborted()
  const unresolved: Array<{ journalPath: string, projectPath: string, state: string, port?: number, ownerPid: number }> = []
  for (const entry of entries) {
    signal?.throwIfAborted()
    if (!entry.name.startsWith('task-scope-')) {
      continue
    }
    const journalPath = path.join(rootDirectory, entry.name)
    const stat = await fs.lstat(journalPath)
    signal?.throwIfAborted()
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Managed DevTools journal root contains a non-directory task scope: ${journalPath}`)
    }
    for (const record of await readManagedWechatProjectRecords(journalPath, options)) {
      signal?.throwIfAborted()
      if (!isManagedWechatProjectFullyReleased(record)) {
        unresolved.push({
          journalPath,
          projectPath: record.projectPath,
          state: record.state,
          ...(record.port === undefined ? {} : { port: record.port }),
          ownerPid: record.ownerPid,
        })
      }
    }
  }
  signal?.throwIfAborted()
  if (unresolved.length) {
    throw new Error(`Managed DevTools has unresolved project ownership from an earlier task; recover it before starting another IDE: ${JSON.stringify(unresolved)}`)
  }
}

/** 每个任务单独登记窗口；嵌套任务仍归属父任务的日志树。 */
export async function createDevtoolsProjectJournal(
  parentJournalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV],
  rootDirectory = JOURNAL_ROOT,
  options: { signal?: AbortSignal } = {},
) {
  options.signal?.throwIfAborted()
  if (!parentJournalPath?.trim()) {
    await scanDevtoolsProjectInventory(rootDirectory, options)
  }
  options.signal?.throwIfAborted()
  // 创建开始后交还真实路径；调用方先保存句柄再响应取消，避免留下无法清理的登记。
  return await createManagedWechatProjectJournal(rootDirectory, parentJournalPath)
}

/** 直接运行 Vitest 时也为本轮 worker 建立独占窗口日志。 */
export async function ensureDevtoolsProjectJournal() {
  if (!process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim()) {
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
