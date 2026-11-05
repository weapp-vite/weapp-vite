import type { Document, ParseOptions } from '../../../packages/wxml/src/types'
import type { Calibration } from '../../benchmarkWxmlParser/calibration'
import type { ClockInformation } from '../../benchmarkWxmlParser/clock'
import type { Sample, Statistics } from '../../benchmarkWxmlParser/types'
import type { TemplateApi } from '../assertions'
import type { CorpusProfile } from '../types'

export interface ProfileFixture {
  id: string
  sha256: string
  source: string
  bytes: number
  profile: CorpusProfile
  options: ParseOptions
  frameworks: string[]
  categories: string[]
  quotaEligible: boolean
  matrix?: Array<{ fixtureId: string, generationId: string, target: string, mode: string, path: string }>
  features: string[]
  size: 'small' | 'medium' | 'large'
  comparison: { eligible: true } | { eligible: false, reason: string }
  suite?: 'old464' | 'all-platform'
}

export interface ProfileGroup {
  id: string
  comparable: boolean
  fixtureIds: string[]
  operations?: readonly ProfileOperation[]
}

export type ProfileOperation = 'scan' | 'parse' | 'canonical' | 'parse-edit-serialize' | 'preserve-noop' | 'consumer-scanner' | 'consumer-web' | 'consumer-simulator'
export interface ProfileSummary {
  operation: ProfileOperation
  group: string
  comparable: boolean
  status: 'complete' | 'incomplete' | 'passed' | 'regression' | 'unstable'
  candidate: Statistics
  baseline?: Statistics
  ratio: number | null
  confirmation?: { candidate: Statistics, baseline: Statistics, ratio: number }
  measurement?: { jobId: string, evidenceSha256: string, representativeGroup: string }
}

export interface WorkloadScope { protocol: 'exact-workload-v2', runtime: string, identitySha256: string }
export interface WorkloadJob { id: string, keySha256: string, operation: ProfileOperation, comparable: boolean, threshold: number | null, fixtureIds: string[], groups: string[] }
export interface WorkloadPlan { scope: WorkloadScope, sha256: string, logicalCells: number, physicalJobs: number, jobs: WorkloadJob[], cells: Array<{ operation: ProfileOperation, group: string, jobId: string }> }
export interface PhysicalMeasurement { jobId: string, keySha256: string, evidenceSha256: string, operation: ProfileOperation, representativeGroup: string }

export interface ProfileMeasurement {
  schemaVersion: 1 | 2
  purpose: 'independent-corpus-profile'
  oldPerformanceGate: 'unchanged-464-document-bench:check'
  rounds: number
  warmup: number
  clock: ClockInformation
  samples: Sample[]
  warmupSamples?: Sample[]
  parity?: Array<{ fixture: string, operation: ProfileOperation, equal: boolean }>
  calibrations: Calibration[]
  summaries: ProfileSummary[]
  errors: Array<{ fixture?: string, operation?: ProfileOperation, group?: string, phase: string, error: string }>
  firstCalls: Array<{ operation: ProfileOperation, arm: 'baseline' | 'candidate', durationMs: number, documents: number }>
  workload?: WorkloadPlan
  physicalMeasurements?: PhysicalMeasurement[]
}

export type ProfileCheckpoint = {
  kind: 'start'
  schemaVersion: 1 | 2
  rounds: number
  warmup: number
  clock: ClockInformation
  firstCalls: ProfileMeasurement['firstCalls']
  errors: ProfileMeasurement['errors']
  workload?: WorkloadPlan
} | ProfileCellCheckpoint | (Omit<ProfileCellCheckpoint, 'kind'> & PhysicalMeasurement & { kind: 'job' }) | {
  kind: 'reference'
  operation: ProfileOperation
  group: string
  jobId: string
  evidenceSha256: string
  completed: number
  total: number
  summary: ProfileSummary
} | {
  kind: 'complete'
  cells: number
  samples: number
  warmupSamples: number
  parity: number
  errors: number
  physicalJobs?: number
}

export interface ProfileCellCheckpoint {
  kind: 'cell'
  operation: ProfileOperation
  group: string
  completed: number
  total: number
  samples: Sample[]
  warmupSamples: Sample[]
  calibrations: Calibration[]
  parity: NonNullable<ProfileMeasurement['parity']>
  errors: ProfileMeasurement['errors']
  summary: ProfileSummary
}

export interface ProfileOptions {
  rounds: number
  warmup: number
  groups?: string[]
  gate?: {
    aggregateGroupSuffix: string
    aggregateMaximumRatio: number
    categoryMaximumRatio: number
    aggregateGroups?: readonly string[]
  }
  operations?: readonly ProfileOperation[]
  progress?: boolean
  workload?: WorkloadScope
}

export interface DomNode {
  type: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: DomNode[]
}

export interface HtmlApi {
  Parser: new (handlers: { onopentag: (name: string, attributes: Record<string, string>) => void }, options: Record<string, unknown>) => { end: (source: string) => void }
  parseDocument: (source: string, options: Record<string, unknown>) => DomNode
}

export interface ProfileDependencies {
  api: TemplateApi
  /** 可选的已构建主线入口；存在时以同一 parser API 做回归比较。 */
  baselineApi?: TemplateApi
  consumers?: Partial<Record<ProfileOperation, { baseline: (fixture: ProfileFixture) => unknown, candidate: (fixture: ProfileFixture) => unknown }>>
  html: HtmlApi
  render: (node: DomNode, options: Record<string, unknown>) => string
}

export interface ProfileRuntime {
  select: (operation: ProfileOperation, arm: 'baseline' | 'candidate') => (fixture: ProfileFixture) => unknown
  run: (fixture: ProfileFixture, operation: ProfileOperation, arm: 'baseline' | 'candidate') => unknown
  prepare: () => Array<{ fixture: string, error: string }>
  candidateTrees: Map<string, Document>
  verifyOperation?: (fixture: ProfileFixture, operation: ProfileOperation) => void
}
