import type { GenerationEvidence } from '../generate/types'
import type { FrozenGenerationSource } from './generationInput'
import type { FrozenFileReference } from './types'
import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { corpusHash, corpusJson } from '../integrity'
import { CorpusEvidenceStore } from './files'
import { validateGeneratedInput } from './generationInput'
import { generationInputText, nativeMetadata, sourceIdentity, sourceTree } from './testFixtures'

function inputCase() {
  const store = new CorpusEvidenceStore()
  const original = { file: 'Page.vue', sha256: corpusHash(generationInputText), bytes: Buffer.byteLength(generationInputText) }
  const file: FrozenFileReference = { role: 'input', original, object: store.object(generationInputText) }
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: 'mpx-input-test',
    framework: 'mpx',
    version: '2.11.2',
    target: 'ali',
    mode: 'production',
    status: 'built',
    source: sourceIdentity,
    runtime: { node: 'v22.18.0', packageManager: 'pnpm@10' },
    inputDependencies: {},
    input: [original],
    outputs: [],
    logs: [],
    configuration: [],
    dependencies: [],
    commands: [['compile']],
  }
  const { metadata } = nativeMetadata()
  const projection = { sourcePath: 'original/Page.vue', destination: original.file, gitSha: sourceTree[1]!.sha, sha256: original.sha256, bytes: original.bytes }
  const source: FrozenGenerationSource = { repository: metadata.repositories[0]!, tree: sourceTree, license: metadata.licenses[0]!, configuration: { ...sourceIdentity, inputProjections: [{ files: [projection] }] } }
  const read = (identity: { file: string }) => store.resources().find(resource => resource.file === identity.file)!.content as Uint8Array
  return { file, report, source, projection, store, read }
}

it('binds all real generated inputs to an explicit source projection and actual upstream blob bytes', () => {
  const value = inputCase()
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).not.toThrow()
  expect(() => validateGeneratedInput(value.report, [value.file], undefined, value.read)).toThrow('no frozen source repository')
  value.source.configuration = sourceIdentity
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('no frozen upstream projection')
})

it('keeps legacy provenance fields separate from explicit source projection and metadata declarations', () => {
  const value = inputCase()
  const legacy = { ...sourceIdentity, projection: [{ source: 'legacy upstream projection note' }] }
  value.source.configuration = { ...legacy, inputProjections: [{ files: [value.projection] }] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).not.toThrow()
  value.source.configuration = legacy
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('Incomplete frozen input-metadata projection')
  value.source.configuration = { ...legacy, inputProjections: [] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('no frozen upstream projection')
})

it('validates every explicit declaration and never falls back around malformed input inventories', () => {
  const value = inputCase()
  const explicit = { inputProjections: [{ files: [value.projection] }] }
  value.source.configuration = { ...explicit, inputMetadata: null }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('Invalid explicit generation input metadata inventory')
  value.source.configuration = { inputProjections: null }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('Invalid explicit generation input projection inventory')
  value.source.configuration = { inputProjections: [{ files: [value.projection] }, { files: [] }] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('needs an explicit file inventory')
  value.source.configuration = { ...explicit, inputMetadata: [{}] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('Incomplete frozen input-metadata projection')
})

it('rejects replaced input even if its declared SHA256, size and projection are all changed together', () => {
  const value = inputCase()
  const replacement = '<template><view>replacement</view></template>'
  value.file.object = value.store.object(replacement)
  value.file.original.sha256 = corpusHash(replacement)
  value.file.original.bytes = Buffer.byteLength(replacement)
  value.projection.sha256 = value.file.original.sha256
  value.projection.bytes = value.file.original.bytes
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('do not belong to their claimed upstream Git blob')
})

it('accepts complete freezeFrameworkInput metadata and refuses omitted source-tree projection entries', () => {
  const value = inputCase()
  const metadata = {
    schemaVersion: 1,
    complete: true,
    identity: sourceIdentity,
    treeSha256: value.source.repository.treeSha256,
    treeFiles: sourceTree.length,
    selectedFiles: 1,
    configuration: { source: sourceIdentity, prefix: 'original', exclude: [] },
    projection: sourceTree.map(file => ({ path: file.path, gitSha: file.sha, selected: file.path === value.projection.sourcePath, ...(file.path === value.projection.sourcePath ? { destination: value.projection.destination, sha256: value.projection.sha256, bytes: value.projection.bytes } : { reason: 'outside-selected-source-prefix' }) })),
  }
  value.source.configuration = metadata
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).not.toThrow()
  value.source.configuration = { ...sourceIdentity, projection: [{ legacy: true }], inputMetadata: [metadata] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).not.toThrow()
  value.source.configuration = { ...sourceIdentity, inputProjections: [{ files: [value.projection] }], inputMetadata: [metadata] }
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).not.toThrow()
  metadata.projection.shift()
  expect(() => validateGeneratedInput(value.report, [value.file], value.source, value.read)).toThrow('omitted frozen tree entries')
})

it('keeps authored fixtures outside real source attribution and binds fixtureId to the complete frozen source map', () => {
  const value = inputCase()
  value.report.provenance = { kind: 'controlled-fixture', quotaEligible: false, fixtureId: `${value.report.framework}-${value.report.version}-${corpusHash(corpusJson({ 'Page.vue': generationInputText })).slice(0, 16)}` }
  expect(() => validateGeneratedInput(value.report, [value.file], undefined, value.read)).not.toThrow()
  value.file.object = value.store.object('replaced authored input')
  expect(() => validateGeneratedInput(value.report, [value.file], undefined, value.read)).toThrow('Authored fixture input identity mismatch')
})
