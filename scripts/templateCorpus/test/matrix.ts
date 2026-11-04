import type { MatrixTemplateCase } from '../assertions/matrix'
import type { CorpusEvidenceResource } from '../evidence'
import type { GenerationReferenceIndex } from '../imports/types'
import type { CorpusDocument, CorpusFileIdentity, CorpusManifest } from '../types'
import assert from 'node:assert/strict'
import { readCorpusEvidence } from '../evidence'
import { assertIdentity, assertOutputIdentity, parseEvidenceJson } from '../imports/files'
import { readGenerationReport } from '../imports/report'
import { validateFrozenReferences } from '../imports/verify'
import { corpusHash } from '../integrity'
import { parseMatrixClassifications } from '../matrixClassifications'

/** 只使用清单签名的 evidence/CAS，不读取仍可变的生成工程输出。 */
export function extractMatrixCases(manifest: CorpusManifest, resources: readonly CorpusEvidenceResource[]): MatrixTemplateCase[] {
  const files = new Map(resources.map(resource => [resource.file, typeof resource.content === 'string' ? new TextEncoder().encode(resource.content) : resource.content]))
  const object = (identity: CorpusFileIdentity, cas = false) => {
    assertIdentity(identity)
    if (cas) {
      assert.equal(identity.file, `objects/${identity.sha256}`, 'Matrix CAS object label changed')
    }
    const bytes = files.get(identity.file)
    assert.ok(bytes, `Missing frozen matrix resource: ${identity.file}`)
    assert.equal(bytes.length, identity.bytes, 'Frozen matrix resource size changed')
    assert.equal(corpusHash(bytes), identity.sha256, 'Frozen matrix resource hash changed')
    return bytes
  }
  const profiles = new Map(manifest.profiles.map(profile => [profile.id, profile]))
  const classifications = manifest.matrixClassifications ? parseMatrixClassifications(parseEvidenceJson(object(manifest.matrixClassifications, true))) : []
  const byClassification = new Map(classifications.map(classification => [`${classification.generationId}:${classification.path}`, classification]))
  const usedClassifications = new Set<string>()
  const cases: MatrixTemplateCase[] = []
  const seen = new Set<string>()
  for (const generation of manifest.generations) {
    if (generation.status !== 'built') {
      continue
    }
    assert.equal(generation.evidence.length, 1, 'Missing frozen matrix generation reference')
    const identity = generation.evidence[0]!
    assert.equal(identity.file, `generations/${generation.id}/references.json`, 'Matrix generation reference label changed')
    const reference = parseEvidenceJson(object(identity)) as GenerationReferenceIndex
    assert.ok(reference?.schemaVersion === 1 && reference.kind === 'generation' && reference.generationId === generation.id && Array.isArray(reference.reports) && reference.reports.length, 'Invalid frozen matrix generation reference')
    const primary = reference.reports[0]!
    const report = readGenerationReport(parseEvidenceJson(object(primary.object, true)))
    for (const field of ['id', 'framework', 'version', 'target', 'mode', 'status'] as const) {
      assert.equal(report[field], generation[field], 'Matrix generation coordinate changed')
    }
    const outputs = primary.templates.filter(template => template.fixtureObject)
    if (!outputs.length) {
      assert.ok(!report.provenance, 'Controlled built generation has no frozen fixture outputs')
      continue
    }
    assert.ok(report.provenance?.kind === 'controlled-fixture' && report.provenance.quotaEligible === false, 'Matrix generation is missing nonquota provenance')
    assert.ok(reference.matrixTemplates && Array.isArray(reference.matrixTemplates.records), 'Missing frozen matrix template index')
    const records = reference.matrixTemplates.records.filter(record => record.metadata.generationId === generation.id)
    assert.equal(records.length, outputs.length, 'Frozen matrix output/record count mismatch')
    for (const record of records) {
      const metadata = record.metadata
      for (const field of ['fixtureId', 'generationId', 'path', 'platform', 'profileId', 'sha256'] as const) {
        assert.ok(typeof metadata[field] === 'string' && metadata[field], `Missing frozen matrix ${field}`)
      }
      assertOutputIdentity({ file: metadata.path, sha256: metadata.sha256, bytes: record.object.bytes }, generation.mode)
      assert.equal(metadata.quotaEligible, false, 'Matrix fixture cannot enter real-source quotas')
      assert.equal(metadata.fixtureId, report.provenance.fixtureId, 'Frozen matrix fixture identity changed')
      assert.equal(metadata.sha256, record.object.sha256, 'Frozen matrix template/CAS hash mismatch')
      const profile = profiles.get(metadata.profileId as string)
      assert.ok(profile && profile.platform === metadata.platform, 'Missing or mismatched frozen matrix profile')
      const output = outputs.find(output => output.original.file === metadata.path && output.documentSha256 === metadata.sha256)
      assert.ok(output?.fixtureObject && output.fixtureObject.file === record.object.file && output.fixtureObject.sha256 === record.object.sha256 && output.fixtureObject.bytes === record.object.bytes, 'Matrix record is absent from the primary frozen output inventory')
      const key = `${generation.id}:${metadata.path}`
      assert.ok(!seen.has(key), 'Duplicate frozen matrix output path')
      seen.add(key)
      const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(object(record.object, true))
      assert.equal(corpusHash(source), metadata.sha256, 'Frozen matrix source hash changed')
      const classification = byClassification.get(key)
      if (classification) {
        assert.equal(classification.sha256, metadata.sha256, 'Frozen matrix classification source hash mismatch')
        assert.equal(classification.profileId, metadata.profileId, 'Frozen matrix classification profile mismatch')
        usedClassifications.add(key)
      }
      cases.push({ fixtureId: metadata.fixtureId as string, generationId: generation.id, framework: generation.framework, version: generation.version, target: generation.target, mode: generation.mode, path: metadata.path as string, platform: metadata.platform as string, profileId: metadata.profileId as string, quotaEligible: false, sha256: metadata.sha256 as string, source, ...(classification ? { expectation: classification.expectation, diagnosticCodes: classification.diagnosticCodes, evidence: classification.evidence } : {}) })
    }
  }
  assert.equal(usedClassifications.size, classifications.length, 'Orphan matrix classification has no matching built nonquota output')
  return cases
}

/** 原生语料和生成证据先通过完整引用校验，再交给运行时共享断言。 */
export async function readMatrixCases(directory: string, manifest: CorpusManifest, documents: readonly CorpusDocument[]): Promise<MatrixTemplateCase[]> {
  const resources = await readCorpusEvidence(directory, manifest.evidence ?? [])
  validateFrozenReferences(manifest, documents, resources)
  return extractMatrixCases(manifest, resources)
}
