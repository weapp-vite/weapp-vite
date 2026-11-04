import type { CorpusFileIdentity } from './types'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { corpusHash, corpusJson } from './integrity'

export type CorpusEvidenceKind = 'tree' | 'selection' | 'discovery' | 'input' | 'config' | 'lock' | 'log' | 'report'

export interface CorpusEvidenceResource {
  file: string
  kind: CorpusEvidenceKind
  content: string | Uint8Array
}

interface EvidenceEntry {
  file: string
  kind: CorpusEvidenceKind
  sha256: string
  bytes: number
}

const evidenceKinds = new Set<CorpusEvidenceKind>(['tree', 'selection', 'discovery', 'input', 'config', 'lock', 'log', 'report'])

function portablePath(file: string): boolean {
  return Boolean(file) && !file.startsWith('/') && !/^[a-z]:/i.test(file) && !file.includes('\\')
    && [...file].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    && file.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

function resourcePath(file: string): boolean {
  return portablePath(file) && file.toLowerCase() !== 'index.json' && !file.toLowerCase().split('/').includes('node_modules')
    && !/(?:^|\/)(?:uni\.)?compiler\.[cm]?js$/i.test(file)
}

function evidencePath(file: string): boolean {
  return file.startsWith('evidence/') && file.endsWith('.gz') && portablePath(file)
}

function evidenceEntry(value: unknown): EvidenceEntry {
  assert.ok(value && typeof value === 'object', 'Invalid corpus evidence index entry')
  const entry = value as EvidenceEntry
  assert.ok(typeof entry.file === 'string' && resourcePath(entry.file), 'Invalid corpus evidence resource path')
  assert.ok(evidenceKinds.has(entry.kind), 'Unknown corpus evidence kind')
  assert.ok(/^[\da-f]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0, 'Invalid corpus evidence source identity')
  return entry
}

/** 只冻结调用方显式挑选的原始记录，绝不遍历依赖目录或执行上游工程。 */
export async function writeCorpusEvidence(directory: string, resources: readonly CorpusEvidenceResource[]): Promise<CorpusFileIdentity[]> {
  const entries: EvidenceEntry[] = []
  const identities: CorpusFileIdentity[] = []
  const paths = new Set<string>()
  for (const resource of [...resources].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)) {
    assert.ok(resourcePath(resource.file), 'Unsafe or disallowed corpus evidence resource path')
    assert.ok(evidenceKinds.has(resource.kind), 'Unknown corpus evidence kind')
    assert.ok(!paths.has(resource.file.toLowerCase()), 'Duplicate corpus evidence resource')
    paths.add(resource.file.toLowerCase())
    const content = typeof resource.content === 'string' ? new TextEncoder().encode(resource.content) : resource.content
    entries.push({ file: resource.file, kind: resource.kind, sha256: corpusHash(content), bytes: content.length })
    const file = `evidence/${resource.file}.gz`
    const compressed = gzipSync(content, { level: 9 })
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
    await writeFile(path.join(directory, file), compressed)
    identities.push({ file, sha256: corpusHash(compressed), bytes: compressed.length })
  }
  const compressedIndex = gzipSync(`${corpusJson({ schemaVersion: 1, entries })}\n`, { level: 9 })
  const indexFile = 'evidence/index.json.gz'
  await mkdir(path.join(directory, 'evidence'), { recursive: true })
  await writeFile(path.join(directory, indexFile), compressedIndex)
  identities.push({ file: indexFile, sha256: corpusHash(compressedIndex), bytes: compressedIndex.length })
  return identities.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
}

/** 同时验证压缩文件和原始内容身份，缺少、替换或增删索引项均阻止验收。 */
export async function readCorpusEvidence(directory: string, identities: readonly CorpusFileIdentity[]): Promise<CorpusEvidenceResource[]> {
  if (!identities.length) {
    return []
  }
  const uncompressed = new Map<string, Uint8Array>()
  const normalizedFiles = new Set<string>()
  for (const identity of identities) {
    assert.ok(evidencePath(identity.file) && !normalizedFiles.has(identity.file.toLowerCase()), 'Invalid or duplicate corpus evidence file')
    normalizedFiles.add(identity.file.toLowerCase())
    assert.ok(/^[\da-f]{64}$/.test(identity.sha256) && Number.isSafeInteger(identity.bytes) && identity.bytes >= 0, 'Invalid corpus evidence file identity')
    const compressed = await readFile(path.join(directory, identity.file))
    assert.equal(compressed.length, identity.bytes, 'Corpus evidence compressed size mismatch')
    assert.equal(corpusHash(compressed), identity.sha256, 'Corpus evidence compressed integrity mismatch')
    uncompressed.set(identity.file, new Uint8Array(gunzipSync(compressed)))
  }
  const index = uncompressed.get('evidence/index.json.gz')
  assert.ok(index, 'Missing corpus evidence index')
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(index))
  assert.ok(value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1 && 'entries' in value && Array.isArray(value.entries), 'Invalid corpus evidence index')
  assert.equal(value.entries.length + 1, identities.length, 'Corpus evidence index/file count mismatch')
  const result: CorpusEvidenceResource[] = []
  const seen = new Set<string>()
  for (const candidate of value.entries) {
    const entry = evidenceEntry(candidate)
    assert.ok(!seen.has(entry.file), 'Duplicate corpus evidence index entry')
    seen.add(entry.file)
    const content = uncompressed.get(`evidence/${entry.file}.gz`)
    assert.ok(content, 'Corpus evidence index refers to missing file')
    assert.equal(content.length, entry.bytes, 'Corpus evidence source size mismatch')
    assert.equal(corpusHash(content), entry.sha256, 'Corpus evidence source integrity mismatch')
    result.push({ file: entry.file, kind: entry.kind, content })
  }
  assert.equal(corpusJson(result.map(item => item.file)), corpusJson([...seen].sort()), 'Corpus evidence index order mismatch')
  return result
}
