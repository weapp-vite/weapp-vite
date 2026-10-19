import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'
import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { DevtoolsHostExitEvidence, DevtoolsHostSnapshot } from '../devtoolsHostLifecycle'

export type ResourceObservation<T> = { status: 'observed', value: T } | { status: 'unavailable', reason: string }
export type TaskResourcePhase = 'before-task' | 'before-cleanup' | 'after-cleanup'
export type WrapperResourceEventType = 'snapshot-created' | 'watcher-started' | 'watcher-stopped' | 'watcher-error' | 'snapshot-deleted' | 'snapshot-delete-error' | 'watcher-stop-error'

export type TaskResourceJournalRecord = Omit<ManagedWechatProjectRecord, 'ownerToken' | 'installationExitRecovery' | 'snapshot'> & {
  snapshot?: Omit<NonNullable<ManagedWechatProjectRecord['snapshot']>, 'token'> & { tokenSha256: string }
  installationExitRecovery?: Omit<NonNullable<ManagedWechatProjectRecord['installationExitRecovery']>, 'recoveryScopeId' | 'journalScopeId'> & {
    recoveryScopeSha256: string
    journalScopeSha256: string
  }
}

export interface WrapperResourceEvent {
  type: WrapperResourceEventType
  at: string
  pid: number
  wrapperRoot: string
  watcherId?: string
  error?: string
}

export interface NewProcessObservation {
  pid: number
  parentPid: number
  started: string
  firstSeenRound: number
  classification: 'verified-foreign' | 'installation-image' | 'descendant' | 'identity-changed' | 'unclassified'
  imageSource: 'kernel-path' | 'text-images' | 'not-verified'
}

export interface InstallationProcessSample {
  samplingStartedAt: string
  samplingCompletedAt: string
  installationRoot: string
  verifiedMemberRssBytes: number
  installationRssBytes: ResourceObservation<number>
  processes: Array<{ pid: number, parentPid: number, started: string, executable: string | null, installationImages: string[], rssBytes: number, membership: 'installation-image' | 'descendant' }>
  unclassifiedProcessCount: number
  missingIdentityCount: number
  uninspectedNewProcessCount: number
  verifiedNewForeignProcessCount: number
  newSelectedProcessCount: number
  identityChangedProcessCount: number
  newProcesses: NewProcessObservation[]
  inventoryRoundCount: number
  inventoryBudgetExhausted: boolean
  inventoryInspectionError?: string
  samplingBudgetMs: 10000
  rssAnchor: 'initial-ps-inventory-only; later-rows-never-replace-or-add-rss'
  fallbackBudgetExhausted: boolean
  semantics: 'point-in-time-rss-not-peak'
  coverage: 'selected-installation-inventory-and-descendants'
  atomicity: 'non-atomic-ps-and-kernel-path-samples; seconds-resolution-start-time-is-not-ownership-proof'
}

export interface TaskResourceSnapshot {
  phase: TaskResourcePhase
  sampledAt: string
  systemMemory: ResourceObservation<{ freeBytes: number, totalBytes: number }>
  processes: ResourceObservation<InstallationProcessSample>
  journal: ResourceObservation<TaskResourceJournalRecord[]>
  host?: DevtoolsHostSnapshot
}

export interface TaskResourceReport {
  protocol: 'weapp-vite-ide-task-resources-v1'
  runId: string
  commitSha: string
  suiteName: string
  taskLabel: string
  journalPath: string
  journalScope: ResourceObservation<{ rootPath: string, scopeSha256: string }>
  machineScopeSha256: string[]
  installation?: ResolvedWechatDevtoolsTarget
  snapshots: TaskResourceSnapshot[]
  windowUsage: {
    managedBudget: ResourceObservation<1 | 2>
    traceDerivedManagedOverlapUpperBound: ResourceObservation<number>
    sampledNativeWindowMaximum: ResourceObservation<number>
    semantics: string
    gaps: string[]
  }
  wrapperResources: {
    coverage: 'instrumented-bridge-wrapper-only'
    events: WrapperResourceEvent[]
    gaps: string[]
  }
  registeredPorts: ResourceObservation<Array<{ port: number, recordId: string, state: ManagedWechatProjectRecord['state'], closureEvidence: 'domain-cleanup-return' | 'installation-exit-recovery' | 'borrowed-preserved' | 'unused-reservation' | 'not-proven' }>>
  cleanup: {
    scope: { status: 'not-attempted' | 'succeeded' | 'failed', error?: string }
    host: { status: 'not-attempted' | 'succeeded' | 'failed', evidence?: DevtoolsHostExitEvidence, error?: string }
  }
  status: 'complete' | 'incomplete'
  errors: string[]
}
