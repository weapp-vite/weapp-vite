import type { Document, EditVisitor, ParseOptions, ScanResult, SerializeOptions } from '../../packages/wxml/src/types'
import type { Calibration, CALIBRATION_POLICY } from './calibration'
import type { ClockInformation } from './clock'
import type { Feature, WorkloadManifest } from './contracts'
import type { CorpusEntry } from './freeze'

export interface WxmlApi {
  scan: (source: string, options?: ParseOptions) => ScanResult
  parse: (source: string, options?: ParseOptions) => Document
  edit: (document: Document, visitor: EditVisitor) => Document
  serialize: (document: Document, options?: SerializeOptions) => string
  decodeAttribute: (value: string, syntax?: 'legacy' | 'xml', decodeEntities?: boolean, quote?: string) => string
}

export interface Fixture extends CorpusEntry {
  source: string
  features?: readonly Feature[]
  synthetic?: boolean
  pressureId?: string
}
export type Arm = 'baseline' | 'candidate'
export interface Operation {
  id: string
  comparable: boolean
  run: (fixture: Fixture, arm: Arm) => unknown
  verify?: (fixture: Fixture) => { equal: boolean, baseline: string, candidate: string }
}

export interface Sample {
  operation: string
  cohort: string
  round: number
  arm: Arm
  phase: 'primary' | 'confirmation'
  durationMs: number
  iterations: number
  documents: number
  bytes: number
}

export interface Summary {
  operation: string
  cohort: string
  ratio: number
  status: 'passed' | 'regression' | 'unstable' | 'incomplete' | 'informational'
  baseline: Statistics
  candidate: Statistics
  confirmation?: { baseline: Statistics, candidate: Statistics, ratio: number }
  pairedDeltaMedianMs?: number | null
}

export interface Statistics {
  count: number
  p50Ms: number
  p95Ms: number
  documentsPerSecond: number
  mibPerSecond: number
}

export interface MeasurementError {
  operation: string
  fixture: string
  arm: Arm
  error: string
  cohort?: string
  phase?: 'preflight' | 'parity' | 'warmup' | 'calibration' | Sample['phase']
  round?: number
  iteration?: number
}

export interface MeasurementResult {
  manifest?: WorkloadManifest
  clock?: ClockInformation
  calibrationPolicy?: typeof CALIBRATION_POLICY
  calibrations?: Calibration[]
  samples: Sample[]
  summaries: Summary[]
  parity: Array<{ operation: string, fixture: string, cohort: string, equal: boolean, baseline: string, candidate: string }>
  errors: MeasurementError[]
}
