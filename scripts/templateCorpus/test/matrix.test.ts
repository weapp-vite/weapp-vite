import type { MatrixTemplateCase } from '../assertions/matrix'
import type { GenerationEvidence } from '../generate/types'
import type { FrozenGenerationReport, GenerationReferenceIndex } from '../imports/types'
import type { CorpusManifest } from '../types'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { runMatrixCases } from '../assertions/matrix'
import { writeCorpusEvidence } from '../evidence'
import { CorpusEvidenceStore } from '../imports/files'
import { corpusHash, corpusJson } from '../integrity'
import { matrixClassificationLabel } from '../matrixClassifications'
import { corpusProfiles } from '../profiles'
import { loadXmlBaseline } from './baseline'
import { extractMatrixCases, readMatrixCases } from './matrix'

function frozenMatrix(quickapp = false, source = '<view title="one &amp; two"><slot/></view>') {
  const store = new CorpusEvidenceStore()
  const sourceObject = store.object(source)
  const generationId = 'fixture-development'
  const inputSource = quickapp ? 'export default () => <view />' : '<template><view/></template>'
  const inputPath = quickapp ? 'src/page.jsx' : 'src/page.vue'
  const framework = quickapp ? 'taro' : 'mpx'
  const version = quickapp ? '2.2.22' : '2.11.2'
  const outputPath = quickapp ? 'out/development/src/npm/.pnpm/components@1/node_modules/@tarojs/components/button.ux' : 'out/development/pages/index/index.wxml'
  const outputSource = quickapp ? `<template>${source}</template><script>export default {}</script>` : source
  const fixtureId = `${framework}-${version}-${corpusHash(corpusJson({ [inputPath]: inputSource })).slice(0, 16)}`
  const metadata = { fixtureId, generationId, path: outputPath, platform: quickapp ? 'quickapp' : 'weapp', profileId: quickapp ? 'quickapp-template' : 'weapp-legacy', quotaEligible: false, sha256: corpusHash(source) }
  const originalFile = (file: string, text: string) => ({ ...store.object(text), file })
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: generationId,
    framework,
    version,
    target: quickapp ? 'quickapp' : 'wx',
    mode: 'development',
    status: 'built',
    source: { repository: 'controlled/fixtures', commit: 'a'.repeat(40), licenseId: 'fixture-license' },
    inputDependencies: {},
    provenance: { kind: 'controlled-fixture', fixtureId, quotaEligible: false },
    runtime: { node: 'v22.0.0', packageManager: 'pnpm/10.0.0' },
    commands: [['pnpm', 'build']],
    input: [originalFile(inputPath, inputSource)],
    configuration: [originalFile('package.json', '{}')],
    dependencies: [originalFile('pnpm-lock.yaml', 'lockfileVersion: 9')],
    outputs: [originalFile(metadata.path, outputSource)],
    logs: [originalFile('logs/build.log', 'compiled')],
  }
  const reportText = `${corpusJson(report)}\n`
  const primary: FrozenGenerationReport = {
    original: originalFile('reports/development.json', reportText),
    object: store.object(reportText),
    files: ['input', 'configuration', 'dependencies', 'logs'].flatMap(role => report[role as 'input'].map(original => ({ role: role as 'input', original, object: { ...original, file: `objects/${original.sha256}` } }))),
    templates: [{ original: report.outputs[0]!, documentSha256: sourceObject.sha256, fixtureObject: sourceObject, ...(quickapp ? { container: { start: '<template>'.length, end: '<template>'.length + source.length, object: store.object(outputSource) } } : {}) }],
  }
  const generation = { id: generationId, framework: report.framework, version: report.version, target: report.target, mode: report.mode, status: report.status, evidence: [primary.original] }
  const matrixText = `${corpusJson({ ...metadata, source })}\n`
  const reference: GenerationReferenceIndex = {
    schemaVersion: 1,
    kind: 'generation',
    generationId,
    reports: [primary],
    inventory: store.object(corpusJson([generation])),
    documents: { original: originalFile('documents.jsonl', ''), records: [] },
    matrixTemplates: { original: originalFile('matrix-templates.jsonl', matrixText), records: [{ metadata, object: sourceObject }] },
  }
  generation.evidence = [store.json(`generations/${generationId}/references.json`, 'report', reference)]
  const manifest: CorpusManifest = {
    schemaVersion: 1,
    id: 'test-matrix',
    documents: 0,
    origins: 0,
    contentSha256: corpusHash(''),
    shards: [],
    profiles: [corpusProfiles.find(profile => profile.id === metadata.profileId)!],
    licenses: [],
    repositories: [],
    generations: [generation],
    discovery: [],
    policy: { minimumDocuments: 0, minimumRepositories: 0, minimumNonWechatDocuments: 0, platformMinimums: {} },
  }
  return { store, manifest, reference, metadata, sourceObject, source }
}

function classify(frozen: ReturnType<typeof frozenMatrix>, overrides: Record<string, unknown> = {}) {
  const entry = {
    generationId: frozen.metadata.generationId,
    path: frozen.metadata.path,
    sha256: frozen.metadata.sha256,
    profileId: frozen.metadata.profileId,
    expectation: 'invalid',
    diagnosticCodes: ['template/invalid-syntax'],
    evidence: ['independent-attribute-grammar:quote-at-name-position'],
    ...overrides,
  }
  const identity = frozen.store.object(corpusJson({ schemaVersion: 1, entries: [entry] }))
  frozen.manifest.matrixClassifications = identity
  frozen.manifest.additionalEvidence = [frozen.store.json('additional/references.json', 'report', { schemaVersion: 1, kind: 'additional', files: [{ file: matrixClassificationLabel, kind: 'report', object: identity }] })]
  return entry
}

describe('nonquota frozen framework output acceptance', () => {
  it('reads only manifest evidence and binds every case to the primary output inventory', async () => {
    const frozen = frozenMatrix()
    const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-corpus-'))
    try {
      frozen.manifest.evidence = await writeCorpusEvidence(directory, frozen.store.resources())
      const cases = await readMatrixCases(directory, frozen.manifest, [])
      expect(cases).toHaveLength(1)
      expect(cases[0]).toMatchObject({ generationId: 'fixture-development', source: frozen.source, quotaEligible: false })
      expect(cases[0]).not.toHaveProperty('origins')
      expect(frozen.manifest.documents).toBe(0)
      expect(frozen.manifest.repositories).toEqual([])
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('accepts emitted QuickApp dependency templates within the frozen output mode', async () => {
    const frozen = frozenMatrix(true)
    const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-quickapp-'))
    try {
      frozen.manifest.evidence = await writeCorpusEvidence(directory, frozen.store.resources())
      const cases = await readMatrixCases(directory, frozen.manifest, [])
      expect(cases).toHaveLength(1)
      expect(cases[0]).toMatchObject({ path: frozen.metadata.path, platform: 'quickapp', source: frozen.source, quotaEligible: false })
      expect(frozen.manifest.documents).toBe(0)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('excludes other modes and rejects changed source, profile, quota or primary output identity', () => {
    const frozen = frozenMatrix()
    frozen.reference.matrixTemplates!.records.push({ metadata: { ...frozen.metadata, generationId: 'fixture-production' }, object: frozen.sourceObject })
    const referenceFile = frozen.manifest.generations[0]!.evidence[0]!.file
    const resources = () => frozen.store.resources().filter(resource => resource.file !== referenceFile).concat({ file: referenceFile, kind: 'report', content: `${corpusJson(frozen.reference)}\n` })
    const updateReferenceIdentity = () => {
      const text = `${corpusJson(frozen.reference)}\n`
      frozen.manifest.generations[0]!.evidence[0] = { file: referenceFile, sha256: corpusHash(text), bytes: new TextEncoder().encode(text).length }
    }
    updateReferenceIdentity()
    expect(extractMatrixCases(frozen.manifest, resources())).toHaveLength(1)
    const tampered = resources().map(resource => resource.file === frozen.sourceObject.file ? { ...resource, content: '<view/>' } : resource)
    expect(() => extractMatrixCases(frozen.manifest, tampered)).toThrow('resource size')
    frozen.metadata.profileId = 'unknown-profile'
    updateReferenceIdentity()
    expect(() => extractMatrixCases(frozen.manifest, resources())).toThrow('matrix profile')
    frozen.metadata.profileId = 'weapp-legacy'
    frozen.metadata.quotaEligible = true
    updateReferenceIdentity()
    expect(() => extractMatrixCases(frozen.manifest, resources())).toThrow('quotas')
    frozen.metadata.quotaEligible = false
    frozen.metadata.path = 'node_modules/components/index.wxml'
    updateReferenceIdentity()
    expect(() => extractMatrixCases(frozen.manifest, resources())).toThrow('Unsafe imported output path')
    frozen.metadata.path = 'out/production/pages/index/index.wxml'
    updateReferenceIdentity()
    expect(() => extractMatrixCases(frozen.manifest, resources())).toThrow('Unsafe imported output path')
    frozen.metadata.path = 'out/development/pages/replaced/index.wxml'
    updateReferenceIdentity()
    expect(() => extractMatrixCases(frozen.manifest, resources())).toThrow('primary frozen output')
  })

  it('runs full contracts and public XML differential without deduplicating cells or adding origins', async () => {
    const frozen = frozenMatrix()
    const template = extractMatrixCases(frozen.manifest, frozen.store.resources())[0]!
    const baseline = await loadXmlBaseline()
    const templates: MatrixTemplateCase[] = [template, { ...template, generationId: 'fixture-production', mode: 'production' }]
    const report = runMatrixCases(api, templates, frozen.manifest.profiles, undefined, baseline.Parser)
    expect(report).toMatchObject({ quotaEligible: false, templates: 2, uniqueContents: 1, accepted: true, differential: { executed: 2, passed: 2 } })
    expect(report.entries.default.passed).toBe(2)
    expect(report.platforms.weapp).toMatchObject({ templates: 2, passed: 2, observedFeatures: { 'slot': 2, 'page-output': 2 } })
    expect(Object.keys(report.cells)).toHaveLength(2)
    const failed = runMatrixCases({ ...api, serialize: () => '' }, templates, frozen.manifest.profiles, undefined, baseline.Parser)
    expect(failed.accepted).toBe(false)
    expect(failed.failures[0]).toMatchObject({ entry: 'default', source: template.source, generationId: template.generationId })
    expect(failed.failures[0]).not.toHaveProperty('origins')
    expect(runMatrixCases(api, templates, []).failures[0]?.stage).toBe('profile')
  })

  it('binds explicit invalid expectations to frozen CAS and exercises rejection contracts', async () => {
    const frozen = frozenMatrix(false, '<view"bad"/>')
    const originalSource = frozen.source
    classify(frozen)
    const directory = await mkdtemp(path.join(os.tmpdir(), 'matrix-classification-'))
    try {
      frozen.manifest.evidence = await writeCorpusEvidence(directory, frozen.store.resources())
      const templates = await readMatrixCases(directory, frozen.manifest, [])
      expect(templates[0]).toMatchObject({ source: originalSource, expectation: 'invalid', diagnosticCodes: ['template/invalid-syntax'], evidence: ['independent-attribute-grammar:quote-at-name-position'] })
      const baseline = await loadXmlBaseline()
      const report = runMatrixCases(api, templates, frozen.manifest.profiles, undefined, baseline.Parser)
      expect(report).toMatchObject({ accepted: true, valid: 0, invalid: 1, pending: 0, differential: { executed: 0, skipped: 1, reasons: { 'known-invalid': 1 } } })
      expect(report.platforms.weapp).toMatchObject({ invalid: 1, passed: 1 })
      expect(report.cells['fixture-development']).toMatchObject({ invalid: 1, passed: 1 })
      expect(report.entries.default.edits).toBe(0)
      const badCode = runMatrixCases(api, [{ ...templates[0]!, diagnosticCodes: ['wrong/diagnostic'] }], frozen.manifest.profiles)
      expect(badCode.accepted).toBe(false)
      expect(badCode.failures[0]?.stage).toBe('diagnostics')
      const pending = runMatrixCases(api, [{ ...templates[0]!, expectation: 'pending' }], frozen.manifest.profiles)
      expect(pending).toMatchObject({ accepted: false, pending: 1, differential: { executed: 0, reasons: { 'pending-classification': 1 } } })
      expect(pending.failures[0]?.stage).toBe('expectation')
      expect(runMatrixCases(api, [{ ...templates[0]!, evidence: [] }], frozen.manifest.profiles).failures[0]?.stage).toBe('classification')
      expect(frozen.source).toBe(originalSource)
      expect(frozen.manifest.documents).toBe(0)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects stale source/profile and orphan classifications instead of matching by content alone', () => {
    for (const overrides of [
      { sha256: 'c'.repeat(64) },
      { profileId: 'alipay-xml' },
      { generationId: 'other-development' },
      { path: 'out/development/other.wxml' },
    ]) {
      const frozen = frozenMatrix()
      classify(frozen, overrides)
      expect(() => extractMatrixCases(frozen.manifest, frozen.store.resources())).toThrow(/classification (?:source hash mismatch|profile mismatch|has no matching)/)
    }
    const frozen = frozenMatrix()
    classify(frozen)
    frozen.manifest.generations[0]!.status = 'failed'
    expect(() => extractMatrixCases(frozen.manifest, frozen.store.resources())).toThrow('Orphan matrix classification')
  })
})
