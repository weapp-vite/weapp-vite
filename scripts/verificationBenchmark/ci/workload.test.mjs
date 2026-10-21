import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { collectCiEvidence } from '../ci.mjs'
import { fixture } from './fixture.mjs'
import { readCiWorkload } from './workload.mjs'

function replaceWorkload(value, patch) {
  const file = '.github/verification-workload.json'
  const manifest = { ...JSON.parse(value.immutableFiles[file]), ...patch }
  const source = JSON.stringify(manifest)
  value.immutableFiles[file] = source
  const receipt = value.context.benchmarkWorkload
  Object.assign(receipt, { id: manifest.id, baseBranch: manifest.baseBranch, profiles: manifest.profiles })
  Object.assign(receipt.manifest, {
    sha256: createHash('sha256').update(source).digest('hex'),
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0${source}`).digest('hex'),
  })
  value.contract.workload = structuredClone(receipt)
}

it.each([
  ['missing receipt', value => delete value.context.benchmarkWorkload],
  ['changed manifest hash', value => value.context.benchmarkWorkload.manifest.sha256 = 'f'.repeat(64)],
  ['changed blob', value => value.context.benchmarkWorkload.manifest.blobSha = 'f'.repeat(40)],
  ['missing profile', value => value.context.selections.ci = false],
  ['extra profile', value => value.context.selections.extra = true],
  ['wrong selection source', value => value.context.selectionSources.ci = 'path'],
  ['untyped path selection', value => value.context.pathSelections.ci = 'true'],
  ['extra path selection', value => value.context.pathSelections.extra = true],
  ['changed committed workload', value => value.immutableFiles['.github/verification-workload.json'] += '\n'],
  ['contract workload drift', value => value.contract.workload.id = 'another-workload'],
])('rejects %s instead of producing a formal workload claim', async (_, mutate) => {
  const value = fixture()
  mutate(value)
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/workload|manifest|selections/iu)
})

it('rejects a PR absent from the committed explicit workload allowlist', async () => {
  const value = fixture()
  replaceWorkload(value, { pullRequests: [43] })
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/not explicitly selected/u)
})

it('rejects a workload profile whose immutable branch restriction excludes the frozen base', async () => {
  const value = fixture()
  value.immutableFiles['.github/pr-checks.json'] = JSON.stringify({ ci: { paths: [], baseBranches: ['another-mainline'], checkoutMode: 'merge' } })
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/does not apply to base/u)
})

it('rejects a head-projected child context before reading any substitute workload', async () => {
  const value = fixture()
  await expect(readCiWorkload({ ...value.context, checkoutMode: 'head', checkoutSha: value.context.headSha }, () => {
    throw new Error('unexpected immutable read')
  })).rejects.toThrow(/root merge context/u)
})

it('requires exact selected profiles even when an additional normal path selection is valid', async () => {
  const value = fixture()
  const profile = { paths: [], baseBranches: [], checkoutMode: 'merge' }
  value.immutableFiles['.github/pr-checks.json'] = JSON.stringify({ ci: profile, extra: profile })
  value.context.pathSelections.extra = true
  value.context.selections.extra = true
  value.context.selectionSources.extra = 'path'
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/equal the complete benchmark workload/u)
})

it('distinguishes valid immutable workloads with identical actual product coverage', async () => {
  const value = fixture()
  const first = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  replaceWorkload(value, { id: 'another-ci-test-v1' })
  const second = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(second.evidence.execution.scopeDigest).toBe(first.evidence.execution.scopeDigest)
  expect(second.sample.scopeDigest).not.toBe(first.sample.scopeDigest)
})

it('includes the immutable workload identity in the cross-variant comparison scope', async () => {
  const value = fixture()
  const first = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
  expect(first.evidence.workload).toEqual(value.context.benchmarkWorkload)
  expect(first.sample.scopeDigest).not.toBe(first.evidence.execution.scopeDigest)
  expect(first.evidence.workload.profiles).toEqual(['ci'])
})
