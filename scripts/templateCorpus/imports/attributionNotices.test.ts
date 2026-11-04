import type { CorpusDocument } from '../types'
import type { AttributionNotice } from './attributionNoticesSchema'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { corpusHash, corpusJson } from '../integrity'
import { freezeAttributionNotices } from './attributionNotices'
import { attributionNoticesLabel, parseAttributionNotices } from './attributionNoticesSchema'
import { CorpusEvidenceStore, mergeFrozenResources } from './files'
import { freezeNativeEvidence } from './native'
import { generationInputText, nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'
import { validateFrozenReferences } from './verify'

function fixture(repository = 'example/templates', nested = true) {
  const previous = nativeMetadata().metadata
  const identity = { ...sourceIdentity, repository }
  const content = new Uint8Array([0x4E, 0x4F, 0x54, 0x49, 0x43, 0x45, 0x0D, 0x0A, 0xFF])
  const noticePath = nested ? 'original/ThirdPartyNotices.txt' : 'THIRD_PARTY_NOTICES.md'
  const gitSha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
  const tree = [...sourceTree, { path: noticePath, type: 'blob' as const, sha: gitSha }]
  const configuration = { ...identity, inputProjections: [{ files: [{ sourcePath: 'original/Page.vue' }] }] }
  const sources = [{ ...identity, tree, configuration }]
  const repositories = [{ ...previous.repositories[0]!, ...identity, independentRepository: repository, treeSha256: corpusHash(corpusJson(tree)), treeFiles: tree.length, identityEvidence: [{ path: 'original/Page.vue', text: generationInputText, sha256: corpusHash(generationInputText) }] }]
  const native = freezeNativeEvidence({ repositories, sources, discovery: [] })
  const metadata = { ...previous, repositories: native.repositories, licenses: previous.licenses.map(license => ({ ...license, repository })) }
  const documents: CorpusDocument[] = []
  const appliesTo: AttributionNotice['appliesTo'] = [{ kind: 'input', path: 'original/Page.vue' }, { kind: 'identity-evidence', path: 'original/Page.vue' }]
  const entries = [{ ...identity, path: noticePath, gitSha, content, purpose: 'attribution-only' as const, grantReview: 'does-not-change-license-grant' as const, rationale: 'The notice preserves third-party attribution without modifying the existing grant.', scope: nested ? { kind: 'directory' as const, path: 'original' } : { kind: 'repository' as const }, appliesTo }]
  return { metadata, documents, sources, entries, resources: native.resources }
}

function archive(value: ReturnType<typeof fixture>) {
  const frozen = freezeAttributionNotices(value)
  const store = new CorpusEvidenceStore()
  const additional = store.json('additional/references.json', 'report', { schemaVersion: 1, kind: 'additional', files: [frozen.entry] })
  return { ...frozen, metadata: { ...value.metadata, additionalEvidence: [additional] }, resources: mergeFrozenResources([...value.resources, ...frozen.resources, ...store.resources()]) }
}

it.each([['example/templates', true], ['other/sources', false]] as const)('freezes byte-exact supplementary notices for %s without changing its grant', (repository, nested) => {
  const value = fixture(repository, nested)
  const grant = corpusJson(value.metadata.licenses)
  const result = archive(value)
  expect(result.entry.file).toBe(attributionNoticesLabel)
  expect(() => validateFrozenReferences(result.metadata, [], result.resources)).not.toThrow()
  expect(corpusJson(result.metadata.licenses)).toBe(grant)
  const body = result.resources.find(resource => resource.file === `objects/${corpusHash(value.entries[0]!.content)}`)
  expect(body?.content).toEqual(value.entries[0]!.content)
})

it('refuses changed source identity, original Git blob, scope and nonexistent distribution relationships', () => {
  const value = fixture()
  const change = (fields: Partial<(typeof value.entries)[number]>) => ({ ...value, entries: [{ ...value.entries[0]!, ...fields }] })
  expect(() => freezeAttributionNotices(change({ gitSha: 'c'.repeat(40) }))).toThrow('Git blob is absent')
  expect(() => freezeAttributionNotices(change({ content: new TextEncoder().encode('substituted notice') }))).toThrow('original Git blob mismatch')
  expect(() => freezeAttributionNotices(change({ licenseId: 'another-grant' }))).toThrow('existing source/license association')
  expect(() => freezeAttributionNotices(change({ appliesTo: [{ kind: 'input', path: 'original/missing.vue' }] }))).toThrow('no matching frozen material')
  expect(() => freezeAttributionNotices(change({ appliesTo: [{ kind: 'input', path: 'outside/Page.vue' }] }))).toThrow('outside its source scope')
  expect(() => freezeAttributionNotices(change({ scope: { kind: 'repository' } }))).toThrow('scope must match')
})

it('rejects changed CAS bytes and orphaned source relationships during offline verification', () => {
  const value = fixture()
  const result = archive(value)
  const body = `objects/${corpusHash(value.entries[0]!.content)}`
  const changed = result.resources.map(resource => resource.file === body ? { ...resource, content: new TextEncoder().encode('changed notice') } : resource)
  expect(() => validateFrozenReferences(result.metadata, [], changed)).toThrow('Frozen evidence reference size mismatch')
  const metadata = { ...result.metadata, repositories: result.metadata.repositories.map(repository => ({ ...repository, identityEvidence: [] })) }
  expect(() => validateFrozenReferences(metadata, [], result.resources)).toThrow('no matching frozen material')
})

it('requires explicit attribution-only review and rejects malformed or duplicate supplement entries', () => {
  const value = archive(fixture())
  const object = value.resources.find(resource => resource.file === value.identity.file)!
  const parsed = JSON.parse(new TextDecoder().decode(object.content as Uint8Array)) as { schemaVersion: number, entries: AttributionNotice[] }
  expect(() => parseAttributionNotices({ ...parsed, entries: [...parsed.entries, ...parsed.entries] })).toThrow('Duplicate attribution notice source')
  expect(() => parseAttributionNotices({ ...parsed, entries: [{ ...parsed.entries[0], purpose: 'license-override' }] })).toThrow('cannot replace a license grant')
  expect(() => parseAttributionNotices({ ...parsed, entries: [{ ...parsed.entries[0], appliesTo: [] }] })).toThrow('actual distributed relationship')
  expect(() => parseAttributionNotices({ ...parsed, entries: [{ ...parsed.entries[0], path: '../NOTICE' }] })).toThrow('source/license')
})
