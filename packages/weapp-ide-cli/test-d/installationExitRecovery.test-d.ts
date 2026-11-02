import type { MachineE2ELeaseRecoveryScope } from '@weapp-vite/devtools-runtime'
import type { ManagedWechatInstallationExitEvidence, ManagedWechatInstallationExitRecoveryResult, ManagedWechatProjectRecord, ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import { expectError, expectType } from 'tsd'
import { recoverManagedWechatProjectsAfterInstallationExit } from 'weapp-ide-cli'

declare const target: ResolvedWechatDevtoolsTarget
declare const recoveryScope: MachineE2ELeaseRecoveryScope
expectType<Promise<ManagedWechatInstallationExitRecoveryResult>>(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope }))
expectType<Promise<ManagedWechatInstallationExitRecoveryResult>>(recoverManagedWechatProjectsAfterInstallationExit({ target, replacementTarget: target, recoveryScope }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, journalPath: 'another-task' }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, force: true }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, replacementTarget: { version: '2.02.2609240', channel: 'stable' } }))
expectError(recoverManagedWechatProjectsAfterInstallationExit({ target, recoveryScope, replacementTarget: { ...target, channel: 'preview' } }))

declare const record: ManagedWechatProjectRecord
expectType<'borrowed' | 'project-closed' | 'installation-exited' | 'not-started' | undefined>(record.releasedReason)
expectType<ManagedWechatInstallationExitEvidence | undefined>(record.installationExitRecovery)
declare const evidence: ManagedWechatInstallationExitEvidence
expectType<'starting' | 'unconfirmed' | 'failed' | 'borrowed'>(evidence.previous.state)
expectType<string | undefined>(evidence.previous.error)
expectType<0>(evidence.processInspection.selectedProcessCount)
expectType<'darwin'>(evidence.processInspection.platform)
if (evidence.replacement) {
  expectType<'wechat-devtools-installation-replacement-exit-v1'>(evidence.replacement.protocol)
  expectType<ResolvedWechatDevtoolsTarget>(evidence.replacement.originalTarget)
  expectType<ResolvedWechatDevtoolsTarget>(evidence.replacement.replacementTarget)
  expectType<number[]>(evidence.replacement.stoppedHostPids)
  expectType<[ManagedWechatInstallationExitEvidence['processInspection'], ManagedWechatInstallationExitEvidence['processInspection']]>(evidence.replacement.exitInspections)
}
expectType<string[]>(({} as ManagedWechatInstallationExitRecoveryResult).recoveredRecordIds)
