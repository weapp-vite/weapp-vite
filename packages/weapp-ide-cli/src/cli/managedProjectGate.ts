import type { ManagedWechatProjectRecord } from '../devtoolsProjectOwnership'
import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import path from 'node:path'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { assertManagedInstallation, inspectManagedProjectHost, sameManagedProcess } from '../devtoolsProjectOwnership/host'
import { readManagedRecord, readManagedWechatProjectRecords, resolveManagedJournal, withManagedJournalLock, writeManagedRecord } from '../devtoolsProjectOwnership/journal'

interface ManagedProjectGateOptions {
  signal?: AbortSignal
  trustProject?: boolean
}

function sameTarget(first: ResolvedWechatDevtoolsTarget, second: ResolvedWechatDevtoolsTarget) {
  return first.installationId === second.installationId && first.cliPath === second.cliPath
    && first.appPath === second.appPath && first.profileDir === second.profileDir
    && first.version === second.version && first.channel === second.channel
}

async function findConfirmedProject(journalPath: string, target: ResolvedWechatDevtoolsTarget, projectPath: string) {
  const records = await withManagedJournalLock(journalPath, async (scopeRoot) => {
    const scopeRecords = await readManagedWechatProjectRecords(scopeRoot)
    if (scopeRecords.some(record => ['starting', 'unconfirmed', 'closing', 'failed'].includes(record.state))) {
      throw new Error('Managed DevTools journal contains unresolved ownership or cleanup; refusing a project mutation.')
    }
    // 根作用域只负责阻断；项目复用仍限定调用者明确持有的日志子树。
    return scopeRoot === journalPath ? scopeRecords : await readManagedWechatProjectRecords(journalPath)
  })
  const matching = records.filter(record => record.state !== 'released' && record.projectPath === projectPath && sameTarget(record.target, target))
  for (const record of matching) {
    try {
      if (!record.host || !record.port || (record.state === 'owned' ? record.openedProjectWindow !== true : record.openedProjectWindow !== false)) {
        throw new Error('Managed DevTools project has no confirmed window receipt and listener identity.')
      }
      const live = await inspectManagedProjectHost(target, record.port)
      if (!sameManagedProcess(live, record.host)) {
        throw new Error('Managed DevTools project listener changed; refusing to reopen the project.')
      }
      if (matching.some(other => other.port !== record.port || !other.host || !sameManagedProcess(other.host, record.host!))) {
        throw new Error('Managed DevTools project has conflicting listener records; refusing to restart its automator.')
      }
    }
    catch (error) {
      await withManagedJournalLock(record.journalPath, async () => {
        const current = await readManagedRecord(record.journalPath, record.id)
        if (current.state === 'released') {
          return
        }
        current.state = 'failed'
        current.error = error instanceof Error ? error.message : String(error)
        await writeManagedRecord(current)
      })
      throw error
    }
  }
  return matching[0]
}

/** 开窗与构建入口先确认任务持有的项目回执，已登记项目保留原自动化端口。 */
export async function ensureManagedWechatProject(
  target: ResolvedWechatDevtoolsTarget,
  projectPath: string,
  options: ManagedProjectGateOptions = {},
): Promise<ManagedWechatProjectRecord | undefined> {
  options.signal?.throwIfAborted()
  const journalPath = resolveManagedJournal()
  if (!journalPath) {
    return
  }
  if (!projectPath.trim()) {
    throw new Error('Managed DevTools project mutation requires an explicit project path.')
  }
  return await withMachineE2ELease(async () => {
    const resolvedProjectPath = path.resolve(projectPath)
    const existing = await findConfirmedProject(journalPath, target, resolvedProjectPath)
    options.signal?.throwIfAborted()
    await assertManagedInstallation(target)
    options.signal?.throwIfAborted()
    if (existing) {
      return existing
    }
    // 公共受管 launcher 先获取 agent-start 回执，不经过 HTTP open 或 engine build。
    const { launchAutomator } = await import('./automator')
    const program = await launchAutomator({
      target,
      cliPath: target.cliPath,
      projectPath: resolvedProjectPath,
      runtimeProvider: 'devtools',
      preserveProjectRoot: true,
      persistAsDefaultSession: true,
      signal: options.signal,
      trustProject: options.trustProject,
      timeout: 120_000,
    })
    // 任务父进程继续持有项目；这里仅归还为建立所有权创建的连接。
    program.disconnect()
    options.signal?.throwIfAborted()
    const confirmed = await findConfirmedProject(journalPath, target, resolvedProjectPath)
    if (!confirmed) {
      throw new Error('Managed DevTools launcher returned without a confirmed task project; refusing a project mutation.')
    }
    return confirmed
  })
}
