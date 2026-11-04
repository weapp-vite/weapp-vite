import type { GenerationIdentity } from '../generate/types'
import type { CorpusDocument, CorpusFileIdentity } from '../types'
import type { NativeEvidenceSource } from './native'
import assert from 'node:assert/strict'
import { expectedSnapshotsToDocuments, extractStaticSnapshots } from '../generate/expected'
import { corpusHash, corpusJson } from '../integrity'
import { assertIdentity, parseEvidenceJson, readOwnedFile, readVerifiedFile } from './files'

interface ExpectedSource {
  schemaVersion: 1
  identity: GenerationIdentity
  profileId: string
  format: 'jest' | 'literal' | 'jest-files'
  original: CorpusFileIdentity
  keys?: string[]
  files?: string[]
}

export interface ImportedExpectedSource {
  repository: string
  commit: string
  snapshots: NonNullable<NativeEvidenceSource['snapshots']>
}

/** 原始文件与提取报告一起重算；仅导入静态字面量，不执行上游测试代码。 */
export async function importExpectedSnapshots(directories: readonly string[]) {
  const documents: CorpusDocument[] = []
  const sources: ImportedExpectedSource[] = []
  for (const directory of directories) {
    const parsed = parseEvidenceJson(await readOwnedFile(directory, 'expected-source.json'))
    assert.ok(parsed && typeof parsed === 'object', 'Missing expected upstream source identity')
    const source = parsed as ExpectedSource
    assert.ok(source.schemaVersion === 1 && ['jest', 'literal', 'jest-files'].includes(source.format) && typeof source.profileId === 'string' && source.identity, 'Invalid expected upstream source format')
    assertIdentity(source.original)
    const bytes = await readVerifiedFile(directory, source.original, `upstream/${source.original.file}`)
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    const extraction = extractStaticSnapshots(text, source.format, source.files)
    assert.equal(corpusJson(parseEvidenceJson(await readOwnedFile(directory, 'expected-extraction.json'))), corpusJson(extraction), 'Original static snapshot extraction changed')
    const restored = expectedSnapshotsToDocuments(extraction, source.identity, source.original.file, source.profileId, source.format, source.keys)
    const originalDocuments = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readOwnedFile(directory, 'expected-documents.jsonl'))
    assert.equal(originalDocuments, restored.map(corpusJson).join('\n') + (restored.length ? '\n' : ''), 'Original expected documents differ from static extraction')
    documents.push(...restored)
    sources.push({ repository: source.identity.repository, commit: source.identity.commit, snapshots: [{ path: source.original.file, text, sha256: corpusHash(bytes), format: source.format, files: source.files }] })
  }
  return { documents, sources }
}
