import type { CorpusFileIdentity, CorpusOrigin } from '../types'

export interface FrozenFileReference {
  role: 'input' | 'configuration' | 'dependencies' | 'outputs' | 'logs'
  original: CorpusFileIdentity
  object: CorpusFileIdentity
}

export interface FrozenTemplateReference {
  original: CorpusFileIdentity
  documentSha256: string
  container?: { start: number, end: number, object: CorpusFileIdentity }
  fixtureObject?: CorpusFileIdentity
}

export interface FrozenGenerationReport {
  original: CorpusFileIdentity
  object: CorpusFileIdentity
  files: FrozenFileReference[]
  templates: FrozenTemplateReference[]
}

export interface GenerationReferenceIndex {
  schemaVersion: 1
  kind: 'generation'
  generationId: string
  reports: FrozenGenerationReport[]
  inventory: CorpusFileIdentity
  documents: { original: CorpusFileIdentity, records: Array<{ sha256: string, origins: CorpusOrigin[] }> }
  matrixTemplates?: { original: CorpusFileIdentity, records: Array<{ metadata: Record<string, unknown>, object: CorpusFileIdentity }> }
}

export interface SourceReferenceIndex {
  schemaVersion: 1
  kind: 'source'
  repository: string
  commit: string
  tree: CorpusFileIdentity
  configuration: CorpusFileIdentity
  discovery: CorpusFileIdentity
  containers: Array<{ path: string, object: CorpusFileIdentity, start: number, end: number }>
  snapshots: Array<{ path: string, format: 'jest' | 'literal' | 'jest-files', files?: readonly string[], object: CorpusFileIdentity, extraction: CorpusFileIdentity }>
}
