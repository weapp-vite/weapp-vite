export type VerificationMode = 'quick' | 'review' | 'full'
export type SelectionMode = 'shadow' | 'affected'
export type ExecutionState = 'actual' | 'cached' | 'mixed' | 'not-executed' | 'unknown'

export interface WorkspacePackage {
  name: string
  directory: string
  scripts: Record<string, string>
  dependencies: string[]
  extraInputs: string[]
}

export interface ChangeSet {
  base: string | null
  head: string
  files: string[]
  fingerprint: string
  fallback: boolean
  warnings: string[]
}

export interface ResourceBudget {
  cpus: number
  cpuBudget: number
  totalMemoryBytes: number
  freeMemoryBytes: number
  jobs: number
  workersPerTask: number
  buildConcurrency: number
}

export interface VerificationTask {
  id: string
  kind: 'lint' | 'stylelint' | 'build' | 'test' | 'types' | 'typecheck' | 'runtime'
  command: string
  args: string[]
  directory: string
  dependencies: string[]
  reason: string
  exclusive?: boolean
  env?: Record<string, string>
  blockedReason?: string
  evidence?: 'turbo-summary'
  resource?: 'cpu' | 'workspace-write' | 'machine-exclusive'
}

export interface VerificationPlan {
  version: 1
  fingerprint: string
  mode: VerificationMode
  selection: SelectionMode
  changes: ChangeSet
  resources: ResourceBudget
  affected: string[]
  selected: string[]
  suggested: string[]
  tasks: VerificationTask[]
  remaining: string[]
  warnings: string[]
}

export interface TaskResult {
  id: string
  status: 'passed' | 'failed' | 'blocked' | 'cancelled'
  durationMs: number
  exitCode?: number
  error?: string
  execution: ExecutionState
  subtasks?: Array<{ id: string, execution: Exclude<ExecutionState, 'mixed' | 'unknown'>, exitCode?: number }>
}

export interface VerificationReport {
  version: 1
  mode: VerificationMode
  fingerprint: string
  startedAt: string
  durationMs: number
  status: 'passed' | 'failed' | 'partial' | 'blocked'
  results: TaskResult[]
  remaining: string[]
}
