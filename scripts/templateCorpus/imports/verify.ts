import type { CorpusEvidenceResource } from '../evidence'
import type { MatrixClassification } from '../matrixClassifications'
import type { CorpusDocument, CorpusFileIdentity, CorpusMetadata } from '../types'
import type { FrozenGenerationSource } from './generationInput'
import type { GenerationReferenceIndex, SourceReferenceIndex } from './types'
import assert from 'node:assert/strict'
import { extractContainerTemplate } from '../collect/container'
import { corpusHash, corpusJson } from '../integrity'
import { matrixClassificationLabel, parseMatrixClassifications } from '../matrixClassifications'
import { validateAdditionalEvidence } from './additional'
import { validateAttributionNotices } from './attributionNotices'
import { assertIdentity, parseEvidenceJson } from './files'
import { validateGeneratedInput } from './generationInput'
import { sourceConfigurationIdentity } from './native'
import { validateNativeDocuments } from './nativeDocuments'
import { validateNonTemplateOutputs } from './nonTemplateOutputs'
import { readGenerationReport } from './report'
import { validateGenerationTemplateInventory } from './templateInventory'

function text(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
}

function canonicalLines(values: unknown[]): string {
  return values.map(corpusJson).join('\n') + (values.length ? '\n' : '')
}

/** 从冻结 CAS 校验关系；不再依赖临时工程或声明式 hash 的自我背书。 */
export function validateFrozenReferences(metadata: CorpusMetadata, documents: readonly CorpusDocument[], resources: readonly CorpusEvidenceResource[]): void {
  const files = new Map(resources.map(resource => [resource.file, typeof resource.content === 'string' ? new TextEncoder().encode(resource.content) : resource.content]))
  const byHash = new Map(documents.map(document => [document.sha256, document]))
  const generationSources = new Map<string, FrozenGenerationSource>()
  const object = (identity: CorpusFileIdentity): Uint8Array => {
    assertIdentity(identity)
    const bytes = files.get(identity.file)
    assert.ok(bytes, `Missing frozen evidence resource: ${identity.file}`)
    assert.equal(bytes.length, identity.bytes, 'Frozen evidence reference size mismatch')
    assert.equal(corpusHash(bytes), identity.sha256, 'Frozen evidence reference hash mismatch')
    return bytes
  }
  const cas = (identity: CorpusFileIdentity): Uint8Array => {
    assertIdentity(identity)
    assert.equal(identity.file, `objects/${identity.sha256}`, 'Frozen CAS object label does not match its content')
    return object(identity)
  }
  const additional = validateAdditionalEvidence(metadata, object)
  const classification = additional.get(matrixClassificationLabel)
  let classifications: MatrixClassification[] = []
  const usedClassifications = new Set<string>()
  if (metadata.matrixClassifications || classification) {
    assert.ok(metadata.matrixClassifications && classification, 'Matrix classifications need both a manifest binding and the fixed additional evidence label')
    assert.equal(corpusJson(metadata.matrixClassifications), corpusJson(classification), 'Frozen matrix classification binding differs from its additional evidence object')
    classifications = parseMatrixClassifications(parseEvidenceJson(cas(metadata.matrixClassifications)))
  }
  for (const repository of metadata.repositories) {
    assert.ok(repository.evidence?.length === 1, 'Missing frozen source tree/configuration references')
    const identity = repository.evidence[0]!
    assert.equal(identity.file, `sources/${repository.repository}/${repository.commit}/references.json`, 'Unstable frozen source reference prefix')
    const reference = parseEvidenceJson(object(identity)) as SourceReferenceIndex
    assert.ok(reference?.schemaVersion === 1 && reference.kind === 'source' && reference.repository === repository.repository && reference.commit === repository.commit, 'Frozen source reference identity mismatch')
    const tree: unknown = parseEvidenceJson(cas(reference.tree))
    assert.ok(Array.isArray(tree) && tree.length === repository.treeFiles, 'Frozen source tree count mismatch')
    assert.equal(corpusHash(corpusJson(tree)), repository.treeSha256, 'Frozen source tree digest mismatch')
    const license = metadata.licenses.find(license => license.id === repository.licenseId)
    validateNativeDocuments(repository, tree, reference, documents, license, cas)
    assert.ok(license, 'Missing frozen generation source license')
    const configuration = parseEvidenceJson(cas(reference.configuration))
    assert.equal(corpusJson(sourceConfigurationIdentity(configuration)), corpusJson({ repository: repository.repository, commit: repository.commit }), 'Frozen source selection identity mismatch')
    generationSources.set(`${repository.repository}@${repository.commit}`, { repository, tree, configuration, license })
    const discovery: unknown = parseEvidenceJson(cas(reference.discovery))
    const pages = discovery && typeof discovery === 'object' && 'discovery' in discovery ? discovery.discovery : discovery
    assert.equal(corpusJson(pages), corpusJson(metadata.discovery), 'Frozen discovery pages mismatch')
  }
  validateAttributionNotices(metadata, documents, additional, generationSources, cas)
  for (const generation of metadata.generations) {
    assert.ok(generation.evidence.length === 1, 'Missing frozen generation references')
    const identity = generation.evidence[0]!
    assert.equal(identity.file, `generations/${generation.id}/references.json`, 'Unstable frozen generation reference prefix')
    const reference = parseEvidenceJson(object(identity)) as GenerationReferenceIndex
    assert.ok(reference?.schemaVersion === 1 && reference.kind === 'generation' && reference.generationId === generation.id && Array.isArray(reference.reports) && reference.reports.length, 'Invalid frozen generation references')
    const inventory: unknown = parseEvidenceJson(cas(reference.inventory))
    assert.ok(Array.isArray(inventory), 'Invalid frozen generation inventory')
    const declared = inventory.find(value => value && typeof value === 'object' && 'id' in value && value.id === generation.id)
    assert.ok(declared && typeof declared === 'object' && 'evidence' in declared && Array.isArray(declared.evidence) && declared.evidence.length === 1, 'Frozen original generation inventory omitted the cell')
    assert.equal(corpusJson(declared.evidence[0]), corpusJson(reference.reports[0]!.original), 'Frozen primary generation report was replaced')
    const records = reference.documents.records.map((record) => {
      const document = byHash.get(record.sha256)
      assert.ok(document && record.origins.every(origin => document.origins.some(actual => corpusJson(actual) === corpusJson(origin))), 'Frozen generated document origin is missing or changed')
      return { sha256: record.sha256, source: document.source, origins: record.origins }
    })
    assert.equal(corpusHash(canonicalLines(records)), reference.documents.original.sha256, 'Frozen original generated JSONL digest mismatch')
    assert.equal(new TextEncoder().encode(canonicalLines(records)).length, reference.documents.original.bytes, 'Frozen original generated JSONL size mismatch')
    const fixtureSources = new Map<string, string>()
    if (reference.matrixTemplates) {
      const matrix = reference.matrixTemplates.records.map((record) => {
        const source = text(cas(record.object))
        assert.ok(record.metadata.quotaEligible === false && record.metadata.sha256 === corpusHash(source), 'Frozen matrix fixture provenance changed')
        fixtureSources.set(corpusHash(source), source)
        return { ...record.metadata, source }
      })
      assert.equal(corpusHash(canonicalLines(matrix)), reference.matrixTemplates.original.sha256, 'Frozen matrix JSONL digest mismatch')
      assert.equal(new TextEncoder().encode(canonicalLines(matrix)).length, reference.matrixTemplates.original.bytes, 'Frozen matrix JSONL size mismatch')
    }
    const seenReports = new Set<string>()
    for (const [index, frozen] of reference.reports.entries()) {
      assert.ok(!seenReports.has(frozen.original.file), 'Duplicate frozen generation report')
      seenReports.add(frozen.original.file)
      const bytes = cas(frozen.object)
      assertIdentity(frozen.original)
      assert.equal(corpusHash(bytes), frozen.original.sha256, 'Original generation report checksum changed')
      assert.equal(bytes.length, frozen.original.bytes, 'Original generation report size changed')
      const report = readGenerationReport(parseEvidenceJson(bytes))
      assert.equal(report.id, generation.id, 'Frozen history belongs to another generation')
      if (index === 0) {
        for (const field of ['id', 'framework', 'version', 'target', 'mode', 'status'] as const) {
          assert.equal(report[field], generation[field], 'Frozen generation coordinate changed')
        }
        for (const record of reference.documents.records) {
          for (const origin of record.origins.filter(origin => origin.generationId === generation.id)) {
            assert.equal(corpusJson({ repository: origin.repository, commit: origin.commit, licenseId: origin.licenseId }), corpusJson(report.source), 'Frozen generation source attribution changed')
          }
        }
        for (const classification of classifications.filter(classification => classification.generationId === generation.id)) {
          assert.ok(report.status === 'built' && report.provenance?.quotaEligible === false, 'Matrix classification must reference a built nonquota generation')
          const record = reference.matrixTemplates?.records.find(record => record.metadata.generationId === generation.id && record.metadata.path === classification.path)
          assert.ok(record && record.metadata.quotaEligible === false, 'Matrix classification has no frozen nonquota template record')
          assert.equal(classification.sha256, record.metadata.sha256, 'Frozen matrix classification source hash mismatch')
          assert.equal(classification.profileId, record.metadata.profileId, 'Frozen matrix classification profile mismatch')
          assert.ok(frozen.templates.some(template => template.original.file === classification.path && template.documentSha256 === classification.sha256 && template.fixtureObject), 'Matrix classification has no matching primary fixture output')
          usedClassifications.add(`${classification.generationId}:${classification.path}`)
        }
      }
      const expected = ['input', 'configuration', 'dependencies', 'logs'].flatMap(role => report[role as 'input'].map(file => `${role}:${corpusJson(file)}`)).sort()
      assert.equal(corpusJson(frozen.files.filter(file => file.role !== 'outputs').map(file => `${file.role}:${corpusJson(file.original)}`).sort()), corpusJson(expected), 'Frozen generation file inventory is incomplete')
      const outputProofs = [...frozen.files.filter(file => file.role === 'outputs').map(file => corpusJson(file.original)), ...frozen.templates.map(template => corpusJson(template.original))].sort()
      assert.equal(corpusJson(outputProofs), corpusJson(report.outputs.map(file => corpusJson(file)).sort()), 'Frozen generation output inventory is incomplete')
      validateGenerationTemplateInventory(report, frozen.templates)
      const outputBytes = new Map<string, Uint8Array>()
      for (const file of frozen.files) {
        const bytes = cas(file.object)
        assert.equal(corpusHash(bytes), file.original.sha256, 'Frozen generation original file checksum changed')
        assert.equal(bytes.length, file.original.bytes, 'Frozen generation original file size changed')
        if (file.role === 'outputs') {
          outputBytes.set(file.original.file, bytes)
        }
      }
      validateNonTemplateOutputs(report, outputBytes, frozen.templates.map(template => template.original.file))
      validateGeneratedInput(report, frozen.files, generationSources.get(`${report.source.repository}@${report.source.commit}`), cas)
      for (const template of frozen.templates) {
        assert.ok(report.outputs.some(file => corpusJson(file) === corpusJson(template.original)), 'Frozen template is absent from original output inventory')
        const source = template.fixtureObject ? text(cas(template.fixtureObject)) : byHash.get(template.documentSha256)?.source
        assert.ok(source !== undefined && corpusHash(source) === template.documentSha256, 'Frozen output template body is missing')
        if (template.fixtureObject) {
          assert.equal(fixtureSources.get(template.documentSha256), source, 'Frozen matrix output is missing its fixture record')
          assert.equal(report.provenance?.quotaEligible, false, 'Matrix output became a real source')
        }
        if (template.container) {
          const original = cas(template.container.object)
          assert.equal(corpusHash(original), template.original.sha256, 'Frozen container output hash mismatch')
          assert.equal(original.length, template.original.bytes, 'Frozen container output size mismatch')
          const extracted = extractContainerTemplate(text(original))
          assert.equal(extracted.start, template.container.start, 'Frozen container start changed')
          assert.equal(extracted.end, template.container.end, 'Frozen container end changed')
          assert.equal(extracted.source, source, 'Frozen container template changed')
        }
        else {
          assert.equal(corpusHash(source), template.original.sha256, 'Frozen plain template output hash mismatch')
          assert.equal(new TextEncoder().encode(source).length, template.original.bytes, 'Frozen plain template output size mismatch')
        }
      }
      if (report.status === 'built') {
        assert.ok(frozen.templates.length, 'Frozen built generation omitted its template outputs')
      }
    }
    for (const document of documents) {
      for (const origin of document.origins.filter(origin => origin.generationId === generation.id)) {
        assert.ok(reference.reports[0]!.templates.some(template => template.original.file === origin.path && template.documentSha256 === document.sha256 && !template.fixtureObject), 'Generated corpus origin has no frozen output proof')
      }
    }
  }
  assert.equal(usedClassifications.size, classifications.length, 'Orphan matrix classification has no matching built nonquota output')
}
