import type { Evidence, Run, Sample } from '../../../../scripts/benchmarkNativeAnalysis/contract.ts'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export interface Entry { variant: string, runtime: 'baseline' | 'candidate', native: 'off' | 'on', run: Run }
export interface CollectionReport {
  contract: string
  comparison: string
  kind: string
  mode?: 'smoke' | 'full'
  batch?: Run['batch']
  pairs: number
  output: string
  identity: string
  variants: Array<{ id: string, runtime: 'baseline' | 'candidate', native: 'off' | 'on' }>
  started: string
  completed?: string
  error?: string | null
  selection?: string[]
  runs: Entry[]
  [key: string]: unknown
}
export interface ArtifactReference {
  id: string
  kind: string
  originalSha256: string
  originalBytes: number
  publicFile: string
  publicSha256: string
  publicBytes: number
  transformation: string
  replacementCount: number
  normalizedMapSha256?: string
  sampleOutputSha256?: string
}
export interface PortablePayload {
  contract: 'architecture-portable-evidence-v1'
  mode: 'smoke' | 'full'
  created: string
  reports: { primary: CollectionReport, confirmation: CollectionReport | null }
  registration: Record<string, unknown> | null
  evaluation: Record<string, unknown>
  provenance: {
    baseline: { role: 'earlier-published-artifacts-of-this-pr', commit: string, isMain: false, [key: string]: unknown }
    [key: string]: unknown
  }
  artifacts: ArtifactReference[]
  limitations: string[]
}
export type OrderToken = number | [number, number]
export interface ManifestBase { group: string, files: Record<string, string> }
export interface OutputDelta { baseRef: number, fields: Omit<Evidence, 'files'>, changed: Record<string, string>, removed: string[], order?: OrderToken[] }
export type CompactSample = Omit<Sample, 'output'> & { outputRef: number }
export type CompactEntry = Omit<Entry, 'run'> & { run: Omit<Run, 'samples'> & { samples: CompactSample[] } }
export type CompactReport = Omit<CollectionReport, 'runs'> & { runs: CompactEntry[] }
export interface CompactPayload extends Omit<PortablePayload, 'reports'> {
  reports: { primary: CompactReport, confirmation: CompactReport | null }
}
export interface CompactEvidence {
  schema: 'architecture-portable-compact-v1'
  codec: 'output-base-delta-v1'
  decodedCanonicalSha256: string
  counts: { runs: number, samples: number, outputs: number, bases: number }
  bases: ManifestBase[]
  outputs: OutputDelta[]
  payload: CompactPayload
}
export interface PublicManifest {
  contract: 'architecture-portable-files-v1'
  payloadFile: string
  files: Record<string, { sha256: string, bytes: number }>
  originals: Record<string, { sha256: string, bytes: number, publicReference: string }>
  limitations: string[]
}
