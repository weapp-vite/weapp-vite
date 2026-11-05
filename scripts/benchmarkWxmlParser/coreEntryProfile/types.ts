import type { Document, ParseOptions, ScanResult, TemplateDocument } from '../../../packages/wxml/src/types'
import type { ClockInformation } from '../clock'

export type EntryArm = 'baseline' | 'root' | 'core'
export interface EntryFixture {
  id: string
  source: string
  bytes: number
  profileId: string
  options: Pick<ParseOptions, 'platform' | 'syntax' | 'rawTags'>
}
export interface BoundParser {
  scan: (source: string) => ScanResult
  parse: (source: string) => TemplateDocument
}
export interface CoreEntryApi {
  compileDialect: (definition: { id: string, syntax: 'legacy' | 'xml', rawTags: readonly string[] }) => unknown
  createParser: (dialect: unknown) => BoundParser
}
export interface RootEntryApi {
  scan: (source: string, options?: ParseOptions) => ScanResult
  parse: (source: string, options?: ParseOptions) => Document
}
export interface EntryProfileSample {
  arm: EntryArm
  round: number
  operation: 'scan' | 'parse'
  moduleMs: number
  injectionMs?: number
  initializationMs: number
  initializationKind: 'compile-dialect-and-create-parser' | 'benchmark-adapter-binding'
  firstCallMs: number
  documents: number
  bytes: number
  parsers: number
  clock: ClockInformation
  memory: {
    beforeImport: Record<string, number>
    afterImport: Record<string, number>
    afterInitialization: Record<string, number>
    afterFirstCall: Record<string, number>
    peakRssBytes: number | null
  } | null
  execArgv?: string[]
}
export interface EntrySteadySample {
  arm: EntryArm
  round: number
  phase: 'warmup' | 'primary'
  operation: 'scan' | 'parse'
  durationMs: number
  iterations: number
  documents: number
  bytes: number
}
export interface EntrySteadyResult {
  samples: EntrySteadySample[]
  calibrations: Array<{ operation: 'scan' | 'parse', iterations: number, probes: Array<{ arm: 'baseline' | 'candidate', iterations: number, durationMs: number }>, candidateResolved: boolean | null }>
  parity: Array<{ fixture: string, scan: boolean, parse: boolean }>
  errors: string[]
}
