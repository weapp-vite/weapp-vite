import type { ManagedWechatProjectRecord } from 'weapp-ide-cli'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isManagedWechatProjectFullyReleased, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from 'weapp-ide-cli'

type ProjectRecord = Pick<ManagedWechatProjectRecord, 'id' | 'journalPath' | 'projectPath' | 'state' | 'releasedReason'> & {
  snapshot?: Pick<NonNullable<ManagedWechatProjectRecord['snapshot']>, 'sourceProjectPath' | 'state'>
}
interface ManagedProject {
  id: string
  journalPath: string
  taskJournalPath: string
}
interface CleanupOptions {
  project: string | undefined
  host: { close: () => Promise<void> } | undefined
  dev: { stop: () => Promise<void> } | undefined
  launchAttempted: boolean
  managed: ManagedProject | undefined
}
interface CleanupDependencies {
  readRecords: (journalPath: string) => Promise<ProjectRecord[]>
  remove: (project: string) => Promise<void>
}
const dependencies: CleanupDependencies = {
  readRecords: readManagedWechatProjectRecords,
  remove: project => rm(project, { recursive: true, force: true }),
}

function isOwner(record: ProjectRecord, project: string, managed: Pick<ManagedProject, 'id' | 'journalPath'>) {
  return record.id === managed.id && path.resolve(record.projectPath) === project
    && path.resolve(record.journalPath) === path.resolve(managed.journalPath)
}

/** 从显式任务树核对 CLI 返回的子 journal，不把未知路径收养为本任务资源。 */
export async function bindScriptSetupExternalManagedProject(
  project: string,
  metadata: { projectPath: string, managedProject?: { id: string, journalPath: string } },
  readRecords = dependencies.readRecords,
): Promise<ManagedProject> {
  const taskJournalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]?.trim()
  const managed = metadata.managedProject
  if (!taskJournalPath || !managed?.id.trim() || !managed.journalPath.trim()
    || path.resolve(metadata.projectPath) !== path.resolve(project)) {
    throw new Error('External script session metadata has no matching project and explicit task journal')
  }
  const records = await readRecords(taskJournalPath)
  if (records.filter(record => isOwner(record, path.resolve(project), managed)).length !== 1) {
    throw new Error('External script session owner is not registered in this task journal tree')
  }
  return { ...managed, taskJournalPath }
}

async function cleanupProject(options: CleanupOptions, cleanupDependencies: CleanupDependencies, completed: { hostClosed: boolean, devStopped: boolean }) {
  const failures: unknown[] = []
  try {
    if (options.host && !completed.hostClosed) {
      await options.host.close()
      completed.hostClosed = true
    }
  }
  catch (error) {
    failures.push(error)
  }
  try {
    if (!completed.devStopped) {
      await options.dev?.stop()
      completed.devStopped = true
    }
  }
  catch (error) {
    failures.push(error)
  }
  if (options.launchAttempted && completed.hostClosed) {
    try {
      if (!options.managed || !options.project) {
        throw new Error('External script project identity unavailable; preserving project')
      }
      const project = path.resolve(options.project)
      const managed = options.managed
      const records = await cleanupDependencies.readRecords(managed.taskJournalPath)
      const matching = records.filter(record => path.resolve(record.projectPath) === project
        || (record.snapshot && path.resolve(record.snapshot.sourceProjectPath) === project))
      if (matching.filter(record => isOwner(record, project, managed)).length !== 1
        || matching.some(record => !isManagedWechatProjectFullyReleased(record)
          || !['project-closed', 'installation-exited'].includes(record.releasedReason ?? ''))) {
        throw new Error('External script project journal is not fully terminated; preserving project')
      }
    }
    catch (error) {
      failures.push(error)
    }
  }
  else if (options.launchAttempted && !completed.hostClosed && !failures.length) {
    failures.push(new Error('External script launch outcome is unknown; preserving project for managed resource recovery'))
  }
  if (options.project && !failures.length) {
    try {
      await cleanupDependencies.remove(options.project)
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, 'External script resource cleanup incomplete', { cause: failures[0] })
  }
}

/** 关闭和停止 watcher 独立尝试；并发共享结果，失败只重试未完成的资源步骤。 */
export function createScriptSetupExternalCleanup(readOptions: () => CleanupOptions, cleanupDependencies = dependencies) {
  const completed = { hostClosed: false, devStopped: false }
  let options: CleanupOptions | undefined
  let result: Promise<void> | undefined
  return () => result ??= cleanupProject(options ??= readOptions(), cleanupDependencies, completed).catch((error: unknown) => {
    result = undefined
    throw error
  })
}
