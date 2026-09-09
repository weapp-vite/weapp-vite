import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { RuntimeDiagnostic } from './runtimeDiagnostics'

export interface AcceptanceIdentity {
  runId: string
  commitSha: string
  workingTreeDirty?: boolean | null
}

export type AcceptanceStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'not-executed'

export interface AcceptanceCaseInput {
  id: string
  file: string
  name: string
  state: 'passed' | 'failed' | 'skipped' | 'pending'
  acceptance?: DomAcceptance
  errors?: string[]
  startedAt?: number
  finishedAt?: number
}

export interface AcceptanceCaseReport extends AcceptanceCaseInput {
  status: AcceptanceStatus
  violations: string[]
}

export interface AcceptanceReport extends AcceptanceIdentity {
  schemaVersion: 1
  invocationId: string
  taskLabel: string
  template: string | null
  provider: 'devtools' | 'headless'
  environment: {
    nodeVersion: string
    ideVersion: string | null
    baseLibraryVersion: string | null
  }
  strict: boolean
  startedAt: string
  finishedAt: string | null
  status: AcceptanceStatus
  errors: string[]
  runtimeDiagnostics?: RuntimeDiagnostic[]
  cases: AcceptanceCaseReport[]
  summary: {
    plannedCount: number
    executedCount: number
    passedCount: number
    failedCount: number
    blockedCount: number
    skippedCount: number
    notExecutedCount: number
    plannedCheckpointCount: number
    capturedCheckpointCount: number
  }
}
