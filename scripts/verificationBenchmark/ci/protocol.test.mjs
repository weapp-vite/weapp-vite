import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { resolveVerificationTopology, TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../../verification/topology.ts'
import { collectCiEvidence } from '../ci.mjs'
import { compareSamples } from '../compare.mjs'
import { fixture } from './fixture.mjs'

function replaceWorkload(value, patch) {
  const file = '.github/verification-workload.json'
  const source = JSON.stringify({ ...JSON.parse(value.immutableFiles[file]), ...patch })
  value.immutableFiles[file] = source
  Object.assign(value.context.benchmarkWorkload.manifest, {
    sha256: createHash('sha256').update(source).digest('hex'),
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0${source}`).digest('hex'),
  })
  value.contract.workload = structuredClone(value.context.benchmarkWorkload)
}

function formalFixture() {
  const value = fixture()
  value.configuration.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
  value.contract.comparisonProtocol = TOPOLOGY_V2_COMPARISON_PROTOCOL
  value.context.verificationTopology = 'optimized-v1'
  replaceWorkload(value, {
    verificationTopologyByAttempt: Object.fromEntries([1, 2, 3, 4, 5, 6].map(attempt => [String(attempt), attempt % 2 ? 'optimized-v1' : 'optimized-v2'])),
  })
  return value
}

function selectAttempt(value, attempt) {
  const variant = attempt % 2 ? 'baseline' : 'candidate'
  value.run.run_attempt = attempt
  value.configuration.identity.runAttempt = attempt
  value.configuration.cohort = { id: `${variant}-${attempt}`, variant }
  value.context.runAttempt = attempt
  value.context.verificationTopology = variant === 'baseline' ? 'optimized-v1' : 'optimized-v2'
  for (const job of value.jobs) {
    job.run_attempt = attempt
  }
}

it('collects formal v2 CI cohorts at one final revision using immutable attempt selections', async () => {
  const value = formalFixture()
  const samples = []
  for (const attempt of [1, 2, 3, 4, 5, 6]) {
    selectAttempt(value, attempt)
    const result = await collectCiEvidence(value.repository, 123, value.configuration, value.execute)
    expect(result.sample).toMatchObject({
      measurement: 'ci',
      comparisonProtocol: TOPOLOGY_V2_COMPARISON_PROTOCOL,
      executionTopology: resolveVerificationTopology(value.context.verificationTopology, {}),
      metrics: { approvalToCompletionMs: 16000 },
    })
    samples.push(result.sample)
  }
  for (const key of ['revision', 'sourceFingerprint', 'inputDigest', 'scopeDigest']) {
    expect(new Set(samples.map(sample => sample[key])).size).toBe(1)
  }
  expect(compareSamples(samples)).toMatchObject({
    comparisonProtocol: TOPOLOGY_V2_COMPARISON_PROTOCOL,
    measurement: 'ci',
    reductionMetric: 'approvalToCompletionMs',
    reduction: 0,
    meetsTarget: false,
  })
})

it.each([
  ['missing immutable protocol', value => delete value.contract.comparisonProtocol],
  ['missing collection protocol', value => delete value.configuration.comparisonProtocol],
  ['different collection protocol', value => value.configuration.comparisonProtocol = 'same-main-topology-v1'],
  ['unknown protocol', (value) => {
    value.configuration.comparisonProtocol = 'unchecked'
    value.contract.comparisonProtocol = 'unchecked'
  }],
  ['missing actual topology', value => delete value.context.verificationTopology],
  ['swapped cohort', value => value.configuration.cohort.variant = 'candidate'],
  ['spoofed actual topology', value => value.context.verificationTopology = 'optimized-v2'],
  ['changed immutable attempt mapping', value => replaceWorkload(value, { verificationTopologyByAttempt: { 1: 'optimized-v2', 2: 'optimized-v1' } })],
])('rejects formal v2 CI %s before producing a successful sample', async (_, mutate) => {
  const value = formalFixture()
  mutate(value)
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/protocol|topology/iu)
})

it('rejects a candidate that uses its attempt label without the immutable candidate selection', async () => {
  const value = formalFixture()
  selectAttempt(value, 2)
  replaceWorkload(value, { verificationTopologyByAttempt: { 1: 'optimized-v1', 2: 'optimized-v1' } })
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/immutable attempt selection/u)
})
