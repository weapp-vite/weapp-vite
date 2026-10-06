import type {
  AnalyzeActionCenterItem,
  AnalyzeSubpackagesResult,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  LargestFileEntry,
  TreemapModuleNodeMeta,
} from '../../types'

export interface DiagnosticArtifact {
  entry: LargestFileEntry
  bytes: number | null
  previousBytes: number | null
  deltaBytes: number | null
}

export interface DiagnosticSource {
  id: string
  meta: TreemapModuleNodeMeta
  bytes: number | null
  readable: boolean
}

export interface DiagnosticEvidence {
  classification: 'problem' | 'risk' | 'clue' | 'unknown'
  scopeLabel: string
  currentBytes: number | null
  previousBytes: number | null
  deltaBytes: number | null
  limitBytes: number | null
  measurement: 'file-bytes' | 'upper-bound' | 'unavailable'
  artifacts: DiagnosticArtifact[]
  artifactCount: number
  sources: DiagnosticSource[]
  sourceCount: number
  constraints: string[]
  steps: string[]
  checks: string[]
}

export interface DiagnosticEvidenceInput {
  action: AnalyzeActionCenterItem
  result: AnalyzeSubpackagesResult
  previous: AnalyzeSubpackagesResult | null
  duplicateModules: DuplicateModuleEntry[]
  incrementAttribution: IncrementAttributionEntry[]
}
