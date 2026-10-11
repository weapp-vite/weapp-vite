import type { ArtifactReference, PortablePayload } from './schema.mts'
import assert from 'node:assert/strict'
import { sha256 } from './codec.mts'
import { publicGeneratedPaths, publicRepositoryPaths } from './redact.mts'

type JsonObject = Record<string, unknown>
type Files = Record<string, string>
interface Variant { digest: string, files: Files }
interface Identity {
  contract: string
  baselineCommit: string
  baselineIdentity: string
  changed: string[]
  variants: Record<'baseline' | 'candidate', Variant>
  sharedStore: { contentDigest: string, linkDigest: string }
  provenance?: { referenceSha256: string, planSha256: string, candidateDelta: Delta[], instrumentationDelta: Delta[] }
}
interface Delta { file: string, before: string | null, after: string | null }
interface Plan { referenceSha256: string, candidateRoots: string[], instrumentationRoots: string[], candidate: Delta[], instrumentation: Delta[] }
const baselineCommit = '419f49d914142a591d5e109fcb3010feed66ab19'
const sorted = (files: Files) => Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
function object(value: unknown, description: string): JsonObject {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Missing ${description}`)
  return value as JsonObject
}
function digest(value: unknown): string {
  assert(typeof value === 'string' && /^[a-f\d]{64}$/u.test(value), 'Invalid provenance digest')
  return value
}
const productionFiles = (identity: Identity) => sorted(Object.fromEntries(Object.entries(identity.variants.baseline.files).filter(([file]) => !file.startsWith('scripts/') && !file.startsWith('e2e/utils/'))))

function validateIdentity(value: unknown): Identity {
  const identity = object(value, 'runtime identity') as unknown as Identity
  assert.equal(identity.baselineCommit, baselineCommit)
  digest(identity.baselineIdentity)
  for (const name of ['baseline', 'candidate'] as const) {
    const variant = identity.variants[name]
    assert(Object.keys(variant.files).length > 0, 'Empty runtime manifest')
    for (const [file, hash] of Object.entries(variant.files)) {
      assert(file && !file.startsWith('/') && !file.includes('\\') && !/^[a-z]:/iu.test(file) && !file.split('/').some(part => part === '..' || part === '.' || !part), 'Invalid runtime file path')
      digest(hash)
    }
    assert.equal(sha256(JSON.stringify(variant.files)), digest(variant.digest), `Runtime tree digest differs: ${name}`)
  }
  digest(identity.sharedStore.contentDigest)
  digest(identity.sharedStore.linkDigest)
  return identity
}

function applyDelta(previous: Files, updates: Delta[], roots: string[]): Files {
  const files = { ...previous }
  const seen = new Set<string>()
  for (const item of updates) {
    assert(!seen.has(item.file), 'Duplicate provenance overlay')
    seen.add(item.file)
    assert(roots.some(root => item.file.startsWith(`${root}/`)), 'Overlay escapes declared package/instrumentation roots')
    assert.equal(files[item.file] ?? null, item.before, 'Overlay before digest differs')
    if (item.after === null) {
      delete files[item.file]
    }
    else {
      files[item.file] = digest(item.after)
    }
  }
  return sorted(files)
}

/** 用公开原件内容与两层独立摘要复核完整来源链，不重验私有运行时目录。 */
export async function replayProvenance(payload: PortablePayload, artifacts: Map<string, ArtifactReference>, readArtifactJson: (id: string) => Promise<unknown>) {
  const artifact = (id: string) => {
    const value = artifacts.get(id)
    assert(value, `Missing provenance artifact: ${id}`)
    return value
  }
  const provenance = payload.provenance
  const baseline = provenance.baseline
  const currentRecord = object(provenance.currentIdentity, 'current identity provenance')
  const evidence = object(provenance.originalEvidence, 'original evidence provenance')
  const external = object(provenance.externalDependencies, 'external dependency provenance')
  const evaluation = object(payload.evaluation, 'evaluation')
  const evaluationIdentity = object(evaluation.identity, 'evaluation identity')
  const sourceReport = object(evaluation.sourceReport, 'source report identity')
  const current = validateIdentity(await readArtifactJson('runtime-identity'))
  const redaction = object(provenance.redaction, 'redaction policy')
  assert.deepEqual(redaction.publicRepositoryPaths, publicRepositoryPaths, 'Public repository path exceptions differ')
  assert.deepEqual(redaction.publicGeneratedPaths, publicGeneratedPaths, 'Public generated path exceptions differ')
  for (const file of publicRepositoryPaths) {
    assert(Object.hasOwn(current.variants.baseline.files, file), 'Public path exception is absent from frozen runtime manifest')
  }
  for (const variant of Object.values(current.variants)) {
    for (const file of publicGeneratedPaths) {
      const source = file.replace('website/dist/', 'website/public/')
      assert(Object.hasOwn(variant.files, file) && Object.hasOwn(variant.files, source), 'Generated public path lacks its tracked source')
      assert.equal(variant.files[file], variant.files[source], 'Generated public path differs from tracked public source')
    }
  }
  assert.equal(currentRecord.originalRawSha256, artifact('runtime-identity').originalSha256)
  assert.equal(currentRecord.originalRawSha256, evaluationIdentity.sha256)
  assert.equal(currentRecord.originalRawSha256, payload.reports.primary.identitySha256)
  assert.equal(currentRecord.contract, current.contract)
  assert.deepEqual(currentRecord.treeSha256, { baseline: current.variants.baseline.digest, candidate: current.variants.candidate.digest })
  assert.equal(baseline.treeSha256, current.variants.baseline.digest)
  assert.equal(baseline.productionManifestSha256, sha256(JSON.stringify(productionFiles(current))))
  const original = object(await readArtifactJson('original-baseline-identity'), 'original baseline identity')
  assert.equal(original.commit, baselineCommit)
  assert.equal(baseline.originalIdentityRawSha256, artifact('original-baseline-identity').originalSha256)
  assert.equal(baseline.originalIdentityParsedJsonSha256, current.baselineIdentity)
  assert.equal(sha256(JSON.stringify(original)), current.baselineIdentity, 'Original baseline parsed JSON digest differs')
  const originalFiles = object(original.files, 'original baseline files')
  assert.deepEqual(baseline.sourceFileManifest, originalFiles)
  assert.equal(baseline.originalFileCount, Object.keys(originalFiles).length)
  for (const [file, hash] of Object.entries(originalFiles)) {
    assert.equal(current.variants.baseline.files[file], digest(hash), 'Original baseline production file differs')
  }
  assert.equal(external.contentDigest, current.sharedStore.contentDigest)
  assert.equal(external.linkDigest, current.sharedStore.linkDigest)
  if (current.provenance) {
    const referenceRecord = object(provenance.referenceIdentity, 'reference identity provenance')
    const planRecord = object(provenance.plan, 'plan provenance')
    const reference = validateIdentity(await readArtifactJson('reference-identity'))
    const plan = object(await readArtifactJson('runtime-plan'), 'runtime update plan') as unknown as Plan
    assert.equal(referenceRecord.originalRawSha256, artifact('reference-identity').originalSha256)
    assert.equal(referenceRecord.originalRawSha256, current.provenance.referenceSha256)
    assert.equal(referenceRecord.contract, reference.contract)
    assert.equal(referenceRecord.baselineTreeSha256, reference.variants.baseline.digest)
    assert.equal(reference.baselineIdentity, current.baselineIdentity)
    assert.equal(planRecord.originalRawSha256, artifact('runtime-plan').originalSha256)
    assert.equal(planRecord.originalRawSha256, current.provenance.planSha256)
    assert.equal(planRecord.referenceSha256, current.provenance.referenceSha256)
    assert.equal(planRecord.planSha256, current.provenance.planSha256)
    assert.equal(plan.referenceSha256, referenceRecord.originalRawSha256)
    assert.deepEqual(plan.candidateRoots, current.changed)
    assert.deepEqual(plan.instrumentationRoots, ['scripts', 'e2e/utils'])
    assert.deepEqual(plan.candidate, current.provenance.candidateDelta)
    assert.deepEqual(plan.instrumentation, current.provenance.instrumentationDelta)
    assert.deepEqual(planRecord.candidateDelta, plan.candidate)
    assert.deepEqual(planRecord.instrumentationDelta, plan.instrumentation)
    assert.deepEqual(applyDelta(reference.variants.baseline.files, plan.instrumentation, plan.instrumentationRoots), sorted(current.variants.baseline.files))
    assert.deepEqual(applyDelta(applyDelta(reference.variants.candidate.files, plan.instrumentation, plan.instrumentationRoots), plan.candidate, plan.candidateRoots), sorted(current.variants.candidate.files))
    assert.deepEqual(productionFiles(current), productionFiles(reference))
    assert.equal(current.sharedStore.contentDigest, reference.sharedStore.contentDigest)
    assert.equal(current.sharedStore.linkDigest, reference.sharedStore.linkDigest)
    assert.equal(external.exactFrozenEquivalence, true)
  }
  else {
    assert.equal(provenance.referenceIdentity, null)
    assert.equal(provenance.plan, null)
    assert.equal(external.exactFrozenEquivalence, null)
  }
  assert.equal(evidence.primaryRawSha256, artifact('primary-report').originalSha256)
  assert.equal(evidence.primaryRawSha256, sourceReport.sha256)
  assert.equal(evidence.evaluationRawSha256, artifact('independent-evaluation').originalSha256)
  if (payload.reports.confirmation) {
    assert.equal(evidence.confirmationRawSha256, artifact('confirmation-report').originalSha256)
    assert.equal(evidence.confirmationRawSha256, object(evaluation.confirmationReport, 'confirmation report').sha256)
    assert.equal(payload.reports.confirmation.identitySha256, currentRecord.originalRawSha256)
  }
  else {
    assert.equal(evidence.confirmationRawSha256, null)
    assert.equal(evaluation.confirmationReport, null)
  }
  if (payload.registration) {
    assert.equal(object(payload.reports.primary.declaration, 'primary declaration').sha256, artifact('preregistration').originalSha256)
    assert.equal(payload.registration.identitySha256, currentRecord.originalRawSha256)
    if (payload.reports.confirmation) {
      assert.equal(object(payload.reports.confirmation.declaration, 'confirmation declaration').sha256, artifact('preregistration').originalSha256)
      const claim = object(await readArtifactJson('confirmation-claim'), 'confirmation claim')
      assert.equal(claim.contract, 'architecture-confirmation-claim-v1')
      assert.equal(claim.declarationSha256, artifact('preregistration').originalSha256)
      assert.equal(claim.primarySha256, artifact('primary-report').originalSha256)
      assert.equal(claim.pairs, 40)
      assert.deepEqual(claim.selection, evaluation.requiredConfirmation)
    }
  }
  return { verified: true, baselineCommit, referenceIdentityPresent: Boolean(current.provenance) }
}
