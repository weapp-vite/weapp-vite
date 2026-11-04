import type { CorpusDocument, CorpusFileIdentity, CorpusLicense, CorpusRepository } from '../types'
import type { SourceReferenceIndex } from './types'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { extractContainerTemplate } from '../collect/container'
import { extractStaticSnapshots } from '../generate/expected'
import { corpusHash, corpusJson } from '../integrity'
import { licenseFileBytes } from '../license'

interface BlobIdentity { path: string, type: 'blob', sha: string, mode?: string }

function blobHash(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

/** 把模板分片绑定回上游 Git blob；容器必须保留完整正文才能复核投影。 */
export function validateNativeDocuments(repository: CorpusRepository, tree: unknown[], reference: SourceReferenceIndex, documents: readonly CorpusDocument[], license: CorpusLicense | undefined, object: (identity: CorpusFileIdentity) => Uint8Array): void {
  const files = new Map<string, BlobIdentity>()
  for (const value of tree) {
    assert.ok(value && typeof value === 'object', 'Invalid frozen source tree entry')
    const file = value as BlobIdentity
    assert.ok(typeof file.path === 'string' && file.path && !file.path.startsWith('/') && !file.path.includes('\\') && file.path.split('/').every(part => part && part !== '.' && part !== '..') && file.type === 'blob' && /^[\da-f]{40}$/.test(file.sha) && !files.has(file.path), 'Invalid or duplicate frozen source blob')
    files.set(file.path, file)
  }
  assert.ok(license && license.repository === repository.repository && license.commit === repository.commit, 'Frozen repository license attribution is missing')
  for (const attribution of license.files) {
    const blob = files.get(attribution.path)
    assert.ok(blob && blob.mode !== '120000', 'License attribution has no regular frozen source blob')
    assert.equal(blobHash(licenseFileBytes(attribution)), blob.sha, 'License attribution Git blob mismatch')
  }
  for (const evidence of repository.identityEvidence ?? []) {
    const blob = files.get(evidence.path)
    assert.ok(blob && blob.mode !== '120000', 'Platform identity evidence has no regular frozen source blob')
    assert.equal(blobHash(new TextEncoder().encode(evidence.text)), blob.sha, 'Platform identity evidence Git blob mismatch')
  }
  assert.ok(Array.isArray(reference.containers), 'Missing frozen source container inventory')
  const containers = new Map<string, { source: string, start: number, end: number, sha256: string }>()
  for (const container of reference.containers) {
    assert.ok(typeof container.path === 'string' && /\.ux$/i.test(container.path) && !containers.has(container.path), 'Invalid frozen source container path')
    const file = files.get(container.path)
    assert.ok(file && file.mode !== '120000', 'Frozen container has no regular source blob')
    const bytes = object(container.object)
    assert.equal(blobHash(bytes), file.sha, 'Frozen source container Git blob mismatch')
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    const extracted = extractContainerTemplate(source)
    assert.equal(extracted.start, container.start, 'Frozen native container start mismatch')
    assert.equal(extracted.end, container.end, 'Frozen native container end mismatch')
    containers.set(container.path, { ...extracted, sha256: corpusHash(bytes) })
  }
  assert.ok(Array.isArray(reference.snapshots), 'Missing frozen static snapshot inventory')
  const snapshots = new Map<string, ReturnType<typeof extractStaticSnapshots>['snapshots']>()
  const declarations = new Set<string>()
  for (const snapshot of reference.snapshots) {
    const declarationKey = `${snapshot.path}:${snapshot.format}:${corpusJson(snapshot.files ?? null)}`
    assert.ok(typeof snapshot.path === 'string' && ['jest', 'literal', 'jest-files'].includes(snapshot.format) && !declarations.has(declarationKey), 'Invalid frozen static snapshot declaration')
    declarations.add(declarationKey)
    const file = files.get(snapshot.path)
    assert.ok(file && file.mode !== '120000', 'Frozen snapshot has no regular source blob')
    const bytes = object(snapshot.object)
    assert.equal(blobHash(bytes), file.sha, 'Frozen static snapshot Git blob mismatch')
    const original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    const extraction = extractStaticSnapshots(original, snapshot.format, snapshot.files)
    assert.equal(new TextDecoder().decode(object(snapshot.extraction)), corpusJson(extraction), 'Frozen static extraction report changed')
    const key = `${snapshot.path}:${snapshot.format}`
    snapshots.set(key, [...new Map([...(snapshots.get(key) ?? []), ...extraction.snapshots].map(snapshot => [corpusJson(snapshot), snapshot])).values()])
  }
  for (const document of documents) {
    for (const origin of document.origins.filter(origin => origin.repository === repository.repository && origin.commit === repository.commit && origin.category !== 'generated')) {
      const file = files.get(origin.path)
      assert.ok(file && file.mode !== '120000', 'Native template has no regular frozen source blob')
      if (origin.snapshot) {
        assert.equal(origin.category, 'expected', 'Static snapshot cannot masquerade as a native file')
        const declaration = origin.snapshot
        const extraction = snapshots.get(`${origin.path}:${declaration.format}`)
        assert.ok(extraction, 'Expected template has no frozen static source')
        const matching = extraction.filter(snapshot => snapshot.key === declaration.key && snapshot.start === declaration.start && snapshot.end === declaration.end && corpusJson(snapshot.section ?? null) === corpusJson(declaration.section ?? null))
        assert.equal(matching.length, 1, 'Expected template static key or UTF16 range changed')
        assert.equal(matching[0]!.source, document.source, 'Expected static template projection changed')
        assert.ok(origin.evidence?.includes(`static-snapshot-key:${declaration.key}`) && origin.evidence.includes(`snapshot-utf16:${declaration.start}:${declaration.end}`) && origin.evidence.includes(`snapshot-format:${declaration.format}`), 'Expected static extraction evidence changed')
      }
      else if (/\.ux$/i.test(origin.path)) {
        const container = containers.get(origin.path)
        assert.ok(container, 'Native container template has no complete frozen source')
        assert.equal(document.source, container.source, 'Frozen native container projection changed')
        assert.ok(origin.evidence?.includes(`container-sha256:${container.sha256}`) && origin.evidence.includes(`container-template-utf16:${container.start}:${container.end}`), 'Native container projection evidence changed')
      }
      else {
        assert.equal(blobHash(new TextEncoder().encode(document.source)), file.sha, 'Native template Git blob mismatch')
      }
    }
  }
}
