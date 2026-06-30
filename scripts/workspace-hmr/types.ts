export interface HmrProfileSample {
  timestamp?: string
  totalMs?: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
  buildCoreMs?: number
  transformMs?: number
  coreTransformMs?: number
  wevuTransformMs?: number
  vueTransformMs?: number
  bundlerMs?: number
  renderStartMs?: number
  generateBundleMs?: number
  generateSharedMs?: number
  generateRewriteMs?: number
  generateModuleGraphMs?: number
  snapshotResolveMs?: number
  snapshotBuildMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
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
  observedMs?: number
  profile?: HmrProfileSample
  impact?: ImpactFile[]
  error?: string
}

export interface ProjectResult {
  id: string
  baselineId?: string
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
  scope: 'apps,e2e-apps' | 'apps' | 'e2e-apps' | 'templates' | 'workspace'
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
