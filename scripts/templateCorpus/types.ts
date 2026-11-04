import type { Platform, Syntax } from '../../packages/wxml/src/types'

export type CorpusCategory = 'native' | 'expected' | 'generated'
export type CorpusExpectation = 'valid' | 'invalid' | 'pending'

/** 来源平台与解析选项独立，未知平台不会冒充已有构建目标。 */
export interface CorpusProfile {
  id: string
  platform: string
  parserPlatform?: Platform
  syntax: Syntax
  rawTags: string[]
  resolver: 'none' | 'babel'
}

export interface CorpusOrigin {
  repository: string
  commit: string
  path: string
  platform: string
  profileId: string
  category: CorpusCategory
  licenseId: string
  licensePath?: string
  licenseSpdx?: string
  generationId?: string
  expectation: CorpusExpectation
  diagnosticCodes?: string[]
  evidence?: string[]
  snapshot?: { format: 'jest' | 'literal' | 'jest-files', key: string, start: number, end: number, section?: { path: string, start: number, end: number } }
}

export interface CorpusDocument {
  sha256: string
  source: string
  origins: CorpusOrigin[]
}

export interface CorpusFileIdentity {
  file: string
  sha256: string
  bytes: number
}

export interface CorpusTextFile {
  path: string
  sha256: string
  text: string
}

export interface CorpusEncodedLicenseFile {
  path: string
  sha256: string
  encoding: 'base64'
  base64: string
  bytes: number
  charset?: string
  decodedText?: string
}

export type CorpusLicenseFile = CorpusTextFile | CorpusEncodedLicenseFile

export interface CorpusLicense {
  id: string
  repository: string
  commit: string
  spdx: string
  files: CorpusLicenseFile[]
}

export interface CorpusRepository {
  repository: string
  commit: string
  independentRepository: string
  licenseId: string
  treeSha256: string
  treeFiles: number
  selectedFiles: number
  excludedFiles: number
  complete: boolean
  identityEvidence?: CorpusTextFile[]
  evidence?: CorpusFileIdentity[]
}

export interface CorpusGeneration {
  id: string
  framework: string
  version: string
  target: string
  mode: string
  status: 'built' | 'unsupported' | 'pending' | 'failed'
  evidence: CorpusFileIdentity[]
}

export interface CorpusDiscoveryPage {
  query: string
  page: number
  totalCount: number
  incompleteResults: boolean
  repositories: string[]
  truncated?: boolean
}

export interface CorpusPolicy {
  minimumDocuments: number
  minimumRepositories: number
  minimumNonWechatDocuments: number
  platformMinimums: Record<string, number>
}

export interface CorpusMetadata {
  id: string
  profiles: CorpusProfile[]
  licenses: CorpusLicense[]
  repositories: CorpusRepository[]
  generations: CorpusGeneration[]
  discovery: CorpusDiscoveryPage[]
  policy: CorpusPolicy
  evidence?: CorpusFileIdentity[]
  additionalEvidence?: CorpusFileIdentity[]
  matrixClassifications?: CorpusFileIdentity
}

export interface CorpusManifest extends CorpusMetadata {
  schemaVersion: 1
  documents: number
  origins: number
  contentSha256: string
  shards: CorpusFileIdentity[]
}

export interface CorpusSelection {
  platform: string
  profileId: string
  extensions: string[]
  include?: string[]
  exclude?: string[]
  evidence: string[]
  category?: CorpusCategory
  expectation?: CorpusExpectation
  diagnosticCodes?: string[]
}

export interface CorpusSource {
  repository: string
  commit: string
  independentRepository?: string
  license: { spdx: string, files: string[], encodings?: Record<string, string> }
  selections: CorpusSelection[]
}

export interface CorpusCollectionResult {
  documents: CorpusDocument[]
  licenses: CorpusLicense[]
  repositories: CorpusRepository[]
  excluded: Array<{ repository: string, commit: string, path: string, reason: string, platform?: string, profileId?: string, evidence?: string[] }>
}
