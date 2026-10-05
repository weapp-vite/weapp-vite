import type { ManagedWechatProjectIntent, ManagedWechatProjectRecord, ManagedWechatWindowCloseEvidence, ManagedWechatWindowLogCursor, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { expectError, expectType } from 'tsd'
import { beginManagedWechatProject, cleanupManagedWechatProjects, closeManagedWechatProject, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from 'weapp-ide-cli'

const target: ResolvedWechatDevtoolsTarget = { cliPath: 'cli', installationId: 'stable', appPath: 'app', profileDir: 'profile' }
expectType<'WEAPP_IDE_MANAGED_PROJECT_JOURNAL'>(MANAGED_PROJECT_JOURNAL_ENV)
expectType<Promise<ManagedWechatProjectIntent | undefined>>(beginManagedWechatProject({ target, projectPath: 'project', generation: 'run', port: 19001 }))
expectType<Promise<void>>(cleanupManagedWechatProjects({ scope: 'process' }))
expectType<Promise<void>>(cleanupManagedWechatProjects({ journalPath: 'task-journal', scope: 'journal' }))
expectType<Promise<void>>(closeManagedWechatProject({ journalPath: 'task-journal', id: 'record' }))
expectType<Promise<ManagedWechatProjectRecord[]>>(readManagedWechatProjectRecords('task-journal'))
declare const intent: ManagedWechatProjectIntent
expectType<Promise<void>>(intent.confirm({ openedProjectWindow: true, port: 19001 }))
expectType<Promise<void>>(intent.close())
expectType<Promise<void>>(intent.fail(new Error('launch failed')))
expectError(intent.confirm({ projectPath: 'project', port: 19001 }))
expectError(intent.confirm({ openedProjectWindow: 'true', port: 19001 }))
expectError(beginManagedWechatProject({ projectPath: 'project' }))
expectError(cleanupManagedWechatProjects({ scope: 'all-hosts' }))

declare const record: ManagedWechatProjectRecord
expectType<ManagedWechatWindowCloseEvidence | undefined>(record.windowClose)
declare const evidence: ManagedWechatWindowCloseEvidence
expectType<'wechat-devtools-window-close-trace-v1'>(evidence.protocol)
expectType<ManagedWechatWindowLogCursor[]>(evidence.cursors)
expectType<string | undefined>(evidence.dispatchedAt)
expectType<number | undefined>(evidence.window?.browserWindowId)
expectType<string | undefined>(evidence.window?.nativeClosedAt)
expectType<string | undefined>(evidence.window?.webContentsDestroyedAt)
expectType<string | undefined>(evidence.failure)
