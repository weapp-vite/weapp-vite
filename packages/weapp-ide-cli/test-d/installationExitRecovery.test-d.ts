import type { MachineE2ELeaseRecoveryScope } from '@weapp-vite/devtools-runtime'
import type { ManagedWechatInstallationExitEvidence, ManagedWechatInstallationExitRecoveryResult, ManagedWechatProjectRecord, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { expectError, expectType } from 'tsd'
import { recoverManagedWechatProjectsAfterInstallationExit } from 'weapp-ide-cli'

declare const target: ResolvedWechatDevtoolsTarget
declare const recoveryScope: MachineE2ELeaseRecoveryScope
expectType<Promise<ManagedWechatInstallationExitRecoveryResult>>(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, journalPath: 'another-task' }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, force: true }))

declare const record: ManagedWechatProjectRecord
expectType<'borrowed' | 'project-closed' | 'installation-exited' | undefined>(record.releasedReason)
expectType<ManagedWechatInstallationExitEvidence | undefined>(record.installationExitRecovery)
declare const evidence: ManagedWechatInstallationExitEvidence
expectType<'starting' | 'unconfirmed' | 'failed'>(evidence.previous.state)
expectType<string | undefined>(evidence.previous.error)
expectType<0>(evidence.processInspection.selectedProcessCount)
expectType<'darwin'>(evidence.processInspection.platform)
expectType<string[]>(({} as ManagedWechatInstallationExitRecoveryResult).recoveredRecordIds)
