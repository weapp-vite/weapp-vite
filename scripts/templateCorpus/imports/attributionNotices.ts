import type { CorpusDocument, CorpusFileIdentity, CorpusMetadata } from '../types'
import type { AttributionNotice } from './attributionNoticesSchema'
import type { FrozenGenerationSource } from './generationInput'
import type { NativeEvidenceSource } from './native'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { corpusHash, corpusJson } from '../integrity'
import { attributionNoticesLabel, parseAttributionNotices } from './attributionNoticesSchema'
import { CorpusEvidenceStore, parseEvidenceJson } from './files'

type Metadata = Pick<CorpusMetadata, 'repositories' | 'licenses'>
type NoticeInput = Omit<AttributionNotice, 'object'> & { content: Uint8Array }

function inputPaths(value: unknown, paths = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      inputPaths(item, paths)
    }
  }
  else if (value && typeof value === 'object') {
    if ('sourcePath' in value && typeof value.sourcePath === 'string') {
      paths.add(value.sourcePath)
    }
    if ('selected' in value && value.selected === true && 'path' in value && typeof value.path === 'string') {
      paths.add(value.path)
    }
    for (const nested of Object.values(value)) {
      inputPaths(nested, paths)
    }
  }
  return paths
}

function verifyEntries(entries: readonly AttributionNotice[], metadata: Metadata, documents: readonly CorpusDocument[], sources: ReadonlyMap<string, FrozenGenerationSource>, read: (identity: CorpusFileIdentity) => Uint8Array): void {
  for (const entry of entries) {
    const source = sources.get(`${entry.repository}@${entry.commit}`)
    const repository = metadata.repositories.find(repository => repository.repository === entry.repository && repository.commit === entry.commit)
    const license = metadata.licenses.find(license => license.id === entry.licenseId)
    assert.ok(source && repository && license && repository.licenseId === entry.licenseId && license.repository === entry.repository && license.commit === entry.commit, 'Attribution notice must retain its existing source/license association')
    assert.equal(source.license.id, entry.licenseId, 'Attribution notice source grant changed')
    assert.ok(Array.isArray(source.tree), 'Attribution notice needs a frozen source tree')
    const file = source.tree.find(file => file && typeof file === 'object' && 'path' in file && file.path === entry.path) as { type?: string, sha?: string, mode?: string } | undefined
    assert.ok(file?.type === 'blob' && file.mode !== '120000' && file.sha === entry.gitSha, 'Attribution notice Git blob is absent from the frozen source tree')
    const bytes = read(entry.object)
    assert.equal(bytes.length, entry.object.bytes, 'Attribution notice body size mismatch')
    assert.equal(corpusHash(bytes), entry.object.sha256, 'Attribution notice body SHA-256 mismatch')
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), entry.gitSha, 'Attribution notice original Git blob mismatch')
    const paths = {
      'template': new Set(documents.flatMap(document => document.origins.filter(origin => origin.repository === entry.repository && origin.commit === entry.commit && origin.category !== 'generated').map(origin => origin.path))),
      'input': inputPaths(source.configuration),
      'identity-evidence': new Set(repository.identityEvidence?.map(file => file.path) ?? []),
    }
    for (const relation of entry.appliesTo) {
      assert.ok(paths[relation.kind].has(relation.path), 'Attribution notice relationship has no matching frozen material')
      assert.ok(source.tree.some(file => file && typeof file === 'object' && 'path' in file && file.path === relation.path), 'Attribution notice relationship is absent from the frozen source tree')
    }
  }
}

/** 原文保持逐字节 CAS，补充清单不改既有许可 ID、来源或编译报告。 */
export function freezeAttributionNotices(options: { entries: readonly NoticeInput[], metadata: Metadata, documents: readonly CorpusDocument[], sources: readonly NativeEvidenceSource[] }) {
  const store = new CorpusEvidenceStore()
  const entries = options.entries.map(({ content, ...entry }) => ({ ...entry, object: store.object(content) }))
  parseAttributionNotices({ schemaVersion: 1, entries })
  const sources = new Map(options.sources.map((source): [string, FrozenGenerationSource] => {
    const repository = options.metadata.repositories.find(repository => repository.repository === source.repository && repository.commit === source.commit)
    const license = options.metadata.licenses.find(license => license.id === repository?.licenseId)
    assert.ok(repository && license, 'Attribution freeze requires an existing source and license')
    return [`${source.repository}@${source.commit}`, { repository, tree: [...source.tree], configuration: source.configuration, license }]
  }))
  const bodies = new Map(store.resources().map(resource => [resource.file, resource.content]))
  verifyEntries(entries, options.metadata, options.documents, sources, (identity) => {
    const content = bodies.get(identity.file)
    assert.ok(content && typeof content !== 'string', 'Missing attribution notice body')
    return content
  })
  const identity = store.object(`${corpusJson({ schemaVersion: 1, entries })}\n`)
  return { identity, entry: { file: attributionNoticesLabel, kind: 'report' as const, object: identity }, resources: store.resources() }
}

/** 离线重验所有归属正文、原树身份、grant 与实际分发关系。 */
export function validateAttributionNotices(metadata: Metadata, documents: readonly CorpusDocument[], additional: ReadonlyMap<string, CorpusFileIdentity>, sources: ReadonlyMap<string, FrozenGenerationSource>, read: (identity: CorpusFileIdentity) => Uint8Array): void {
  const identity = additional.get(attributionNoticesLabel)
  if (identity) {
    const entries = parseAttributionNotices(parseEvidenceJson(read(identity)))
    verifyEntries(entries, metadata, documents, sources, read)
  }
}
