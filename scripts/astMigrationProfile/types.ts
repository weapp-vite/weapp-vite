export type Arm = 'off' | 'on'
export type Condition = 'cold' | 'warm'
export type Metric = 'wall' | 'diagnostic'

export interface ProfileCase {
  id: string
  cohort: 'wevu' | 'tailwind-tdesign' | 'component-registration'
  project: string
  config: string
  file: string
  isPage: boolean
  expectCompilerBatch: boolean
}

export interface Cell {
  caseId: string
  trial: number
  arm: Arm
  condition: Condition
  sourceMap: boolean
  metric: Metric
}

export type Outcome
  = | { status: 'success', result: unknown, warnings: string[] }
    | { status: 'error', error: unknown, warnings: string[] }

export interface Counters {
  crossings: Record<string, number>
  compilerBatchCalls: number
  compilerBatchInputs: number
  compilerBatchUniqueInputs: number
  compilerBatchRejectedInputs: number
  nativeThrownCalls: number
  rustParseCount: null
  babelParseCount: number
  babelTraverseCount: number
  babelGenerateCount: number
  sfcParseCount: number
  fallbackCount: null
}

export interface Measurement {
  cell: Cell
  outcome: Outcome
  compileMs: number
  addonLoadMs: number
  importMs: number
  preparationMs: number
  optionsSummary?: Record<string, unknown>
  rssBefore: number
  rssAfter: number
  peakRssBytes: number
  warmupCount: number
  counters: Counters | null
  cpu: { user: number, system: number } | null
  gc: { count: number, durationMs: number } | null
  sampledAllocationBytes: number | null
  identity: { compilerSha256: string, addonSha256: string | null, sourceSha256: string }
}

export interface Collection {
  status: 'incomplete' | 'passed' | 'failed'
  expectedWallSamples: number
  expectedDiagnosticSamples: number
  samples: Measurement[]
  errors: string[]
  failedCell?: Cell
}
