export interface HmrProfileSample {
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
}

export interface ImpactFile {
  path: string
  status: 'added' | 'modified' | 'removed'
  sizeBefore?: number
  sizeAfter?: number
}

export interface ScenarioResult {
  id: string
  label: string
  source: string
  output: string
  marker?: string
  totalMs?: number
  profile?: HmrProfileSample
  impact?: ImpactFile[]
  error?: string
}

export interface ProjectResult {
  id: string
  kind: 'apps' | 'templates' | 'e2e-apps'
  platform: 'weapp' | 'alipay'
  source: string
  startupMs?: number
  scenarios: ScenarioResult[]
  error?: string
}

export interface WorkspaceHmrThresholds {
  maxStartupMs?: number
  maxScenarioMs?: number
  maxScenarioP95Ms?: number
  maxImpactFiles?: number
  maxDirtyCount?: number
  maxPendingCount?: number
  maxEmittedCount?: number
  maxRegressionMs?: number
  maxRegressionRatio?: number
  maxImpactFileDelta?: number
  maxDirtyDelta?: number
  maxPendingDelta?: number
  maxEmittedDelta?: number
}

export interface WorkspaceHmrBaselineScenario {
  totalMs?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  impactFiles?: number
  thresholds?: WorkspaceHmrThresholds
}

export interface WorkspaceHmrBaselineProject {
  startupMs?: number
  thresholds?: WorkspaceHmrThresholds
  scenarios: Record<string, WorkspaceHmrBaselineScenario>
}

export interface WorkspaceHmrBaseline {
  version: 1
  scope: 'templates' | 'workspace'
  generatedAt: string
  mode: string
  thresholds: WorkspaceHmrThresholds
  projects: Record<string, WorkspaceHmrBaselineProject>
}

export interface ThresholdOverrideEnv {
  [key: string]: string | undefined
}

export interface ThresholdIssue {
  project: string
  scenario?: string
  metric: string
  actual: number
  limit: number
  baseline?: number
  message: string
}

export interface ThresholdEvaluation {
  scenarioCount: number
  measuredScenarioCount: number
  scenarioP95Ms?: number
  issues: ThresholdIssue[]
}
