import type { CorpusEvidenceKind } from '../evidence'
import type { CorpusFileIdentity, CorpusMetadata } from '../types'
import assert from 'node:assert/strict'
import path from 'node:path'
import { corpusJson } from '../integrity'
import { CorpusEvidenceStore, parseEvidenceJson, portableFile, readOwnedFile } from './files'

const kinds = new Set<CorpusEvidenceKind>(['tree', 'selection', 'discovery', 'input', 'config', 'lock', 'log', 'report'])
const evidenceExtension = /\.(?:jsonl?|md|txt|log|ya?ml|csv|png|jpe?g|webp|pdf)$/i
const reserved = /^(?:objects|sources|generations|additional|evidence)(?:\/|$)/i

interface AdditionalEntry {
  file: string
  kind: CorpusEvidenceKind
  object: CorpusFileIdentity
}

function label(file: unknown): asserts file is string {
  assert.ok(typeof file === 'string' && portableFile(file) && !reserved.test(file) && evidenceExtension.test(file), 'Unsafe or reserved additional evidence label')
}

/** 只读取显式 manifest 中的普通证据文件，不遍历临时目录或执行任意源码。 */
export async function importAdditionalEvidence(manifests: readonly string[]) {
  const store = new CorpusEvidenceStore()
  const entries = new Map<string, AdditionalEntry>()
  for (const manifest of manifests) {
    const directory = path.dirname(path.resolve(manifest))
    const value = parseEvidenceJson(await readOwnedFile(directory, path.basename(manifest)))
    assert.ok(Array.isArray(value), 'Additional evidence manifest must be an explicit file array')
    for (const candidate of value) {
      assert.ok(candidate && typeof candidate === 'object', 'Invalid additional evidence manifest entry')
      const entry = candidate as { file: unknown, kind: CorpusEvidenceKind, path: unknown }
      label(entry.file)
      assert.ok(kinds.has(entry.kind), 'Unknown additional evidence role')
      assert.ok(typeof entry.path === 'string' && portableFile(entry.path) && evidenceExtension.test(entry.path), 'Additional evidence source must be a portable non-executable path relative to its manifest')
      const object = store.object(await readOwnedFile(directory, entry.path))
      const key = entry.file.normalize('NFC').toLocaleLowerCase('en')
      const previous = entries.get(key)
      assert.ok(!previous || corpusJson(previous) === corpusJson({ file: entry.file, kind: entry.kind, object }), 'Additional evidence label or role conflicts with an earlier entry')
      entries.set(key, { file: entry.file, kind: entry.kind, object })
    }
  }
  const evidence = entries.size ? [store.json('additional/references.json', 'report', { schemaVersion: 1, kind: 'additional', files: [...entries.values()].sort((a, b) => a.file.localeCompare(b.file, 'en')) })] : []
  return { evidence, resources: store.resources() }
}

/** 离线验收重新核对附加证据映射、角色、CAS 身份和不可混淆的来源标签。 */
export function validateAdditionalEvidence(metadata: CorpusMetadata, read: (identity: CorpusFileIdentity) => Uint8Array): ReadonlyMap<string, CorpusFileIdentity> {
  const mappings = new Map<string, CorpusFileIdentity>()
  assert.ok(metadata.additionalEvidence === undefined || Array.isArray(metadata.additionalEvidence), 'Invalid additional evidence references')
  if (!metadata.additionalEvidence?.length) {
    return mappings
  }
  assert.equal(metadata.additionalEvidence.length, 1, 'Ambiguous additional evidence index')
  const identity = metadata.additionalEvidence[0]!
  assert.equal(identity.file, 'additional/references.json', 'Unstable additional evidence index label')
  const value = parseEvidenceJson(read(identity)) as { schemaVersion: number, kind: string, files: AdditionalEntry[] }
  assert.ok(value && value.schemaVersion === 1 && value.kind === 'additional' && Array.isArray(value.files) && value.files.length, 'Invalid additional evidence index')
  const names = new Set<string>()
  for (const entry of value.files) {
    label(entry.file)
    const normalized = entry.file.normalize('NFC').toLocaleLowerCase('en')
    assert.ok(kinds.has(entry.kind) && !names.has(normalized), 'Duplicate or invalid additional evidence role/label')
    names.add(normalized)
    assert.equal(entry.object.file, `objects/${entry.object.sha256}`, 'Additional evidence CAS label mismatch')
    read(entry.object)
    mappings.set(entry.file, entry.object)
  }
  return mappings
}
