import type { GenerationEvidence } from '../generate/types'
import type { CorpusFileIdentity, CorpusLicense, CorpusRepository } from '../types'
import type { FrozenFileReference } from './types'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { corpusHash, corpusJson } from '../integrity'
import { resolveTemplateLicense } from '../license'
import { portableFile } from './files'

export interface FrozenGenerationSource {
  repository: CorpusRepository
  tree: unknown[]
  configuration: unknown
  license: CorpusLicense
}

interface InputFileProjection {
  sourcePath: string
  destination: string
  gitSha: string
  sha256: string
  bytes: number
}

function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Invalid frozen generation input projection')
  return value as Record<string, unknown>
}

function explicitProjection(value: unknown): InputFileProjection[] {
  const projection = object(value)
  assert.ok(Array.isArray(projection.files) && projection.files.length, 'Generation input projection needs an explicit file inventory')
  return projection.files.map((value: unknown) => {
    const file = object(value)
    assert.ok(typeof file.sourcePath === 'string' && portableFile(file.sourcePath) && typeof file.destination === 'string' && portableFile(file.destination) && typeof file.gitSha === 'string' && /^[\da-f]{40}$/.test(file.gitSha) && typeof file.sha256 === 'string' && /^[\da-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && (file.bytes as number) >= 0, 'Invalid generated input projection file')
    return file as unknown as InputFileProjection
  })
}

function metadataProjection(value: unknown, source: FrozenGenerationSource): InputFileProjection[] {
  const metadata = object(value)
  assert.ok(metadata.schemaVersion === 1 && metadata.complete === true && metadata.treeSha256 === source.repository.treeSha256 && metadata.treeFiles === source.tree.length && Array.isArray(metadata.projection), 'Incomplete frozen input-metadata projection')
  assert.equal(corpusJson(metadata.identity), corpusJson({ repository: source.repository.repository, commit: source.repository.commit, licenseId: source.repository.licenseId }), 'Frozen input-metadata identity mismatch')
  const tree = new Map(source.tree.map((value) => {
    const file = object(value)
    return [file.path, file.sha]
  }))
  const declared = new Map<unknown, unknown>()
  const selected: InputFileProjection[] = []
  for (const value of metadata.projection) {
    const entry = object(value)
    assert.ok(typeof entry.selected === 'boolean' && tree.get(entry.path) === entry.gitSha && !declared.has(entry.path), 'Input-metadata does not match the complete frozen tree')
    declared.set(entry.path, entry.gitSha)
    if (entry.selected) {
      selected.push({ sourcePath: entry.path as string, destination: entry.destination as string, gitSha: entry.gitSha as string, sha256: entry.sha256 as string, bytes: entry.bytes as number })
    }
  }
  assert.equal(declared.size, tree.size, 'Input-metadata omitted frozen tree entries')
  assert.equal(selected.length, metadata.selectedFiles, 'Input-metadata selected file count mismatch')
  return selected
}

function projections(source: FrozenGenerationSource): InputFileProjection[][] {
  const configuration = object(source.configuration)
  const result: InputFileProjection[][] = []
  const explicitProjections = 'inputProjections' in configuration
  const explicitMetadata = 'inputMetadata' in configuration
  if (explicitProjections) {
    assert.ok(Array.isArray(configuration.inputProjections), 'Invalid explicit generation input projection inventory')
    result.push(...configuration.inputProjections.map(explicitProjection))
  }
  if (explicitMetadata) {
    assert.ok(Array.isArray(configuration.inputMetadata), 'Invalid explicit generation input metadata inventory')
    result.push(...configuration.inputMetadata.map(value => metadataProjection(value, source)))
  }
  if (!explicitProjections && !explicitMetadata && 'projection' in configuration) {
    result.push(metadataProjection(configuration, source))
  }
  assert.ok(result.length, 'Real generated input has no frozen upstream projection')
  return result
}

function fileInventory(files: readonly CorpusFileIdentity[]): string {
  return corpusJson([...files].sort((a, b) => a.file.localeCompare(b.file, 'en')))
}

/** 真实产物必须逐文件追溯至源提交；自产夹具按完整输入内容绑定 fixtureId。 */
export function validateGeneratedInput(report: GenerationEvidence, files: readonly FrozenFileReference[], source: FrozenGenerationSource | undefined, read: (identity: CorpusFileIdentity) => Uint8Array): void {
  const inputs = files.filter(file => file.role === 'input')
  if (report.provenance) {
    assert.ok(report.provenance.kind === 'controlled-fixture' && report.provenance.quotaEligible === false, 'Unknown authored generation provenance')
    const authored = Object.fromEntries(inputs.map(file => [file.original.file, new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(read(file.object))]))
    assert.equal(report.provenance.fixtureId, `${report.framework}-${report.version}-${corpusHash(corpusJson(authored)).slice(0, 16)}`, 'Authored fixture input identity mismatch')
    return
  }
  assert.ok(source && source.repository.licenseId === report.source.licenseId, 'Real generated input has no frozen source repository')
  const candidates = projections(source).filter(projection => fileInventory(projection.map(file => ({ file: file.destination, sha256: file.sha256, bytes: file.bytes }))) === fileInventory(report.input))
  assert.ok(candidates.length, 'Generated input inventory does not match any frozen upstream projection')
  const tree = new Map(source.tree.map((value) => {
    const file = object(value)
    return [file.path, file]
  }))
  const selected = candidates[0]!
  assert.equal(new Set(selected.map(file => file.destination.toLowerCase())).size, selected.length, 'Generation input projection has colliding destinations')
  for (const file of selected) {
    assert.ok(portableFile(file.sourcePath) && portableFile(file.destination), 'Unsafe generated input projection path')
    const blob = tree.get(file.sourcePath)
    assert.ok(blob && blob.mode !== '120000' && blob.type === 'blob' && blob.sha === file.gitSha, 'Generated input projection has no matching upstream blob')
    const permission = resolveTemplateLicense(file.sourcePath, source.license)
    assert.ok(permission.confirmed, 'Generated input projection license scope is unconfirmed')
    const frozen = inputs.find(input => input.original.file === file.destination)
    assert.ok(frozen, 'Generated input projection omitted frozen bytes')
    const bytes = read(frozen.object)
    assert.equal(bytes.length, file.bytes, 'Generated input projection byte count mismatch')
    assert.equal(corpusHash(bytes), file.sha256, 'Generated input projection SHA256 mismatch')
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), file.gitSha, 'Generated input bytes do not belong to their claimed upstream Git blob')
  }
}
