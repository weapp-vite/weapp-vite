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
}

export interface ProfileGroup {
  id: string
  comparable: boolean
  fixtureIds: string[]
}

export type ProfileOperation = 'scan' | 'parse' | 'canonical'
export interface ProfileSummary {
  operation: ProfileOperation
  group: string
  comparable: boolean
  status: 'complete' | 'incomplete'
  candidate: Statistics
  baseline?: Statistics
  ratio: number | null
}

export interface ProfileMeasurement {
  schemaVersion: 1
  purpose: 'independent-corpus-profile'
  oldPerformanceGate: 'unchanged-464-document-bench:check'
  rounds: number
  warmup: number
  clock: ClockInformation
  samples: Sample[]
  calibrations: Calibration[]
  summaries: ProfileSummary[]
  errors: Array<{ fixture?: string, operation?: ProfileOperation, group?: string, phase: string, error: string }>
  firstCalls: Array<{ operation: ProfileOperation, arm: 'baseline' | 'candidate', durationMs: number, documents: number }>
}

export interface ProfileOptions {
  rounds: number
  warmup: number
  groups?: string[]
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
  html: HtmlApi
  render: (node: DomNode, options: Record<string, unknown>) => string
}

export interface ProfileRuntime {
  run: (fixture: ProfileFixture, operation: ProfileOperation, arm: 'baseline' | 'candidate') => unknown
  prepare: () => Array<{ fixture: string, error: string }>
  candidateTrees: Map<string, Document>
}
