import { expect, it } from 'vitest'
import { corpusHash, corpusJson } from '../integrity'
import { CorpusEvidenceStore, mergeFrozenResources } from './files'
import { freezeNativeEvidence } from './native'
import { nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'
import { validateFrozenReferences } from './verify'

it('requires matching complete trees and source configuration rather than trusting repository summaries', () => {
  const { metadata } = nativeMetadata()
  const source = { ...sourceIdentity, tree: sourceTree, configuration: sourceIdentity }
  expect(() => freezeNativeEvidence({ repositories: metadata.repositories, sources: [], discovery: [] })).toThrow('Missing complete tree/configuration')
  expect(() => freezeNativeEvidence({ repositories: metadata.repositories, sources: [{ ...source, tree: [] }], discovery: [] })).toThrow('tree file count mismatch')
  expect(() => freezeNativeEvidence({ repositories: metadata.repositories, sources: [{ ...source, tree: sourceTree.map((file, index) => index === 0 ? { ...file, sha: 'c'.repeat(40) } : file) }], discovery: [] })).toThrow('tree hash mismatch')
  expect(() => freezeNativeEvidence({ repositories: metadata.repositories, sources: [{ ...source, configuration: { ...sourceIdentity, commit: 'b'.repeat(40) } }], discovery: [] })).toThrow('selection/source identity mismatch')
})

it('validates native resource presence, source identity, discovery and stable reference labels offline', () => {
  const { metadata, resources } = nativeMetadata()
  expect(() => validateFrozenReferences(metadata, [], resources)).not.toThrow()
  expect(() => validateFrozenReferences(metadata, [], resources.filter(resource => !resource.file.startsWith('objects/')))).toThrow('Missing frozen evidence resource')
  metadata.discovery.push({ query: 'extension:wxml', page: 1, totalCount: 1, incompleteResults: false, repositories: [sourceIdentity.repository] })
  expect(() => validateFrozenReferences(metadata, [], resources)).toThrow('discovery pages mismatch')
  metadata.repositories[0]!.evidence![0]!.file = 'renamed/references.json'
  expect(() => validateFrozenReferences(metadata, [], resources)).toThrow('Unstable frozen source reference prefix')
})

it('deduplicates shared objects but refuses same-name replacements and unsafe file labels', () => {
  const first = new CorpusEvidenceStore()
  const second = new CorpusEvidenceStore()
  const bytes = corpusJson(sourceTree)
  const identity = first.object(bytes)
  expect(identity.file).toBe(`objects/${corpusHash(bytes)}`)
  expect(second.object(bytes)).toEqual(identity)
  expect(mergeFrozenResources([...first.resources(), ...second.resources()])).toHaveLength(1)
  expect(() => mergeFrozenResources([...first.resources(), { file: identity.file, kind: 'input', content: 'replacement' }])).toThrow('label changed')
  for (const file of ['../tree', 'node_modules/tree', 'C:/tree', 'tree\\input']) {
    expect(() => first.named(file, 'tree', '[]')).toThrow('Unsafe frozen evidence label')
  }
})
