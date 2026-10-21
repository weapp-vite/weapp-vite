import type { PlannedTaskCase } from '../domAcceptanceReport/taskCases'

export const VERIFICATION_TOOL_VERSION = 1

export interface VerificationProfile {
  os: 'darwin' | 'linux' | 'win32'
  nodeMajor: number
  provider: 'none' | 'headless' | 'devtools'
  platform: string
  runnerClass: string
  arch?: string
}

export interface PlannedVerificationTask {
  label: string
  definitionHash: string
  estimatedDurationMs: number
  shardIndex: number
  outOfScopeReason?: string
  cases?: PlannedTaskCase[]
  acceptanceTemplates?: string[]
}

export interface VerificationPlan {
  schemaVersion: 1
  toolVersion: number
  planHash: string
  runId: string
  commitSha: string
  workingTreeDirty: boolean | null
  createdAt: string
  suite: string
  strict: boolean
  profile: VerificationProfile
  sourceDigest: string
  shardTotal: number
  tasks: PlannedVerificationTask[]
  historySources: string[]
}

export interface VerificationExecution {
  scope: 'full' | 'shard' | 'ad-hoc'
  status: 'passed' | 'failed' | 'cancelled' | 'incomplete'
  profile: VerificationProfile
  planHash?: string
  shardIndex?: number
  shardTotal?: number
  assignedTasks: string[]
  startedAt: string
  finishedAt: string
}

export interface VerificationTiming {
  name: string
  invocationId: string
  startedAt: string
  durationMs: number
  status: 'passed' | 'failed' | 'cancelled'
  parentId?: string
  group?: string
  attempts?: number
}

export interface DurationHistory {
  schemaVersion: 1
  toolVersion: number
  profile: VerificationProfile
  generatedAt: string
  tasks: Record<string, { durationMs: number, samples: number, sources: string[] }>
}

export interface HistoryReceipt {
  repository: string
  workflow: string
  runId: number
  runAttempt: number
  headSha: string
  headBranch: string
  defaultBranch: string
  event: 'push' | 'schedule' | 'workflow_dispatch'
  conclusion: 'success'
  verified: true
}
