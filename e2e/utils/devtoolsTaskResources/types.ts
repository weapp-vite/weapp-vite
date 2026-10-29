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

export interface NewProcessObservation extends ProcessIdentityGapObservation {
  firstSeenRound: number
  classification: 'verified-foreign' | 'installation-image' | 'descendant' | 'identity-changed' | 'unclassified' | 'pre-anchor-exited'
  imageSource: 'kernel-path' | 'text-images' | 'not-verified'
}

export interface ProcessIdentityMetadata {
  pid: number
  parentPid: number
  started: string
  zombie: boolean
  startedSeconds?: string | null
  startedMicroseconds?: string | null
  status?: number | null
}

export interface ProcessInventoryLocation {
  round: number
  phase: 'prepare' | 'anchor' | 'closure1' | 'closure2'
}

export interface ProcessIdentityGapCause {
  reason: 'process-absent' | 'identity-changed' | 'zombie' | 'kernel-path-unverifiable' | 'text-images-query-failed' | 'text-images-empty' | 'text-images-invalid' | 'fallback-budget-exhausted' | 'pre-anchor-exited' | 'kernel-identity-unverifiable' | 'image-changed' | 'rss-unavailable'
  firstObserved: ProcessInventoryLocation
}

export interface ProcessIdentityGapObservation extends ProcessIdentityMetadata {
  final: ProcessIdentityMetadata | null
  causes: ProcessIdentityGapCause[]
}

export interface ProcessIdentityChangeObservation extends ProcessIdentityMetadata {
  changedTo: ProcessIdentityMetadata
  reasons: Array<'returned-after-absence' | 'started-changed' | 'parent-changed' | 'zombie-changed'>
  firstObserved: ProcessInventoryLocation
}

export interface NativeImageEvidence {
  sha256: string
  scope: 'installation' | 'outside-installation'
  installationRelativePath?: string
}

export interface VerifiedForeignImageTransition {
  process: ProcessIdentityGapObservation
  from: { phase: ProcessInventoryLocation['phase'], image: NativeImageEvidence }
  to: { phase: ProcessInventoryLocation['phase'], image: NativeImageEvidence }
  ancestry: ProcessIdentityMetadata[]
  proof: 'four-complete-native-foreign-frames' | 'complete-native-foreign-frames-since-first-observation'
  phases: ProcessInventoryLocation['phase'][]
}

export interface VerifiedForeignNativeExec {
  process: ProcessIdentityGapObservation
  from: { phase: 'closure1', position: 'path-before', image: NativeImageEvidence }
  to: { phase: 'closure1', position: 'path-after', image: NativeImageEvidence }
  confirmationPhase: 'closure2'
  ancestry: ProcessIdentityMetadata[]
  proof: 'complete-native-foreign-exec-brackets-since-first-observation'
  phases: ['closure1', 'closure2']
}

export interface NativeProcessFrameEvidence {
  phase: 'prepare' | 'anchor' | 'closure1' | 'closure2'
  requestId: number
  startedAtNanoseconds: string
  endedAtNanoseconds: string
  enumeratedPidCount: number
  ownedHelper: { identity: ProcessIdentityMetadata, image: NativeImageEvidence }
  rows: Array<{
    pid: number
    before: ProcessIdentityMetadata | null
    after: ProcessIdentityMetadata | null
    beforeQuery: { result: number, length: number, errno: number }
    afterQuery: { result: number, length: number, errno: number }
    interval: { startedAtNanoseconds: string, endedAtNanoseconds: string }
    pathBefore: { count: number, errno: number, image: NativeImageEvidence | null }
    pathAfter: { count: number, errno: number, image: NativeImageEvidence | null }
    rss: { count: number, errno: number, identity: ProcessIdentityMetadata | null, bytes: string | null }
    gaps: string[]
  }>
}

export interface NativeTextImageProofEvidence {
  pid: number
  kind: 'rss-anchor-bracket' | 'closure-identity-bracket'
  identity: ProcessIdentityMetadata
  before: { images: NativeImageEvidence[] | null, startedAtNanoseconds: string, endedAtNanoseconds: string, failure?: string }
  after: { images: NativeImageEvidence[] | null, startedAtNanoseconds: string, endedAtNanoseconds: string, failure?: string }
  accepted: boolean
  imageChanged: boolean
}

export type NativeTextImageObservationEvidence = NativeTextImageProofEvidence['before'] & {
  pid: number
  identity: ProcessIdentityMetadata
  phase: 'prepare' | 'anchor' | 'closure1'
  position: 'before-anchor' | 'after-anchor' | 'closure-before' | 'closure-after'
}

export interface InstallationProcessSample {
  samplingStartedAt: string
  samplingCompletedAt: string
  installationRoot: string
  verifiedMemberRssBytes: number
  installationRssBytes: ResourceObservation<number>
  processes: Array<{ pid: number, parentPid: number, started: string, startedSeconds?: string | null, startedMicroseconds?: string | null, executable: string | null, installationImages: string[], rssBytes: number, membership: 'installation-image' | 'descendant' }>
  unclassifiedProcessCount: number
  missingIdentityCount: number
  uninspectedNewProcessCount: number
  verifiedNewForeignProcessCount: number
  newSelectedProcessCount: number
  identityChangedProcessCount: number
  verifiedForeignImageTransitionCount: number
  verifiedForeignImageTransitions: VerifiedForeignImageTransition[]
  verifiedForeignNativeExecCount: number
  verifiedForeignNativeExecs: VerifiedForeignNativeExec[]
  newProcesses: NewProcessObservation[]
  unclassifiedProcesses: ProcessIdentityGapObservation[]
  missingIdentities: ProcessIdentityGapObservation[]
  identityChangedProcesses: ProcessIdentityChangeObservation[]
  preAnchorExitedProcesses: ProcessIdentityGapObservation[]
  inventoryRoundCount: number
  inventoryBudgetExhausted: boolean
  inventoryInspectionError?: string
  samplingBudgetMs: 10000
  rssAnchor: 'single-native-anchor-frame; preparation-and-closure-rss-never-contribute'
  fallbackBudgetExhausted: boolean
  semantics: 'point-in-time-rss-not-peak'
  coverage: 'selected-installation-inventory-and-descendants'
  atomicity: 'non-atomic-sysctl-identity-and-image-brackets; observed-continuity-does-not-prove-no-unobserved-exec'
  nativeFrames?: NativeProcessFrameEvidence[]
  textImageProofs?: NativeTextImageProofEvidence[]
  textImageObservations?: NativeTextImageObservationEvidence[]
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
