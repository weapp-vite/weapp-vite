import { expect, it } from 'vitest'
import { comparisonTopology, resolveVerificationTopology, TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../verification/topology.ts'
import { compareSamples, validateSample } from './compare.mjs'

function samples() {
  return ['baseline', 'candidate'].flatMap(variant => Array.from({ length: 3 }, (_, index) => ({
    schemaVersion: 1,
    id: `${variant}-${index}`,
    variant,
    revision: variant,
    sourceFingerprint: (variant === 'baseline' ? 'a' : 'b').repeat(64),
    inputDigest: 'c'.repeat(64),
    scopeDigest: 'd'.repeat(64),
    outcome: 'passed',
    complete: true,
    profile: { os: 'darwin', node: 'v24.18.0', provider: 'devtools', platform: 'weapp', runnerClass: 'local', cachePolicy: 'warm', arch: 'arm64', packageManager: 'pnpm@12.11.2', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' },
    metrics: { executionMs: variant === 'baseline' ? 100 : 60, approvalWaitMs: 0, schedulingWaitMs: 0, runnerMs: variant === 'baseline' ? 100 : 60 },
  })))
}

it.each(['arch', 'packageManager', 'ideVersion', 'baseLibraryVersion'])('compares actual optional %s identity and rejects missing identity in only one sample', (key) => {
  const values = samples()
  expect(compareSamples(values).meetsTarget).toBe(true)
  values[5].profile[key] = 'different'
  expect(() => compareSamples(values)).toThrow(/profile differ/)
  delete values[5].profile[key]
  expect(() => compareSamples(values)).toThrow(/profile differ/)
})

it('keeps older samples comparable only when every sample omits the same optional identity', () => {
  const values = samples().map(value => ({ ...value, profile: { os: 'linux', node: 'v24.18.0', provider: 'none', platform: 'workspace', runnerClass: 'local', cachePolicy: 'warm' } }))
  expect(compareSamples(values).meetsTarget).toBe(true)
})

it.each(['arch', 'packageManager', 'ideVersion', 'baseLibraryVersion'])('rejects an invalid provided %s rather than dropping it', (key) => {
  for (const value of ['', ' ', null, undefined, 42]) {
    const sample = samples()[0]
    sample.profile[key] = value
    expect(() => validateSample(sample)).toThrow(/optional benchmark profile/)
  }
})

function topologySamples(protocol = TOPOLOGY_COMPARISON_PROTOCOL) {
  return samples().map(sample => ({ ...sample, revision: 'same-final-main', sourceFingerprint: 'a'.repeat(64), comparisonProtocol: protocol, executionTopology: resolveVerificationTopology(comparisonTopology(protocol, sample.variant)) }))
}

it('compares only the explicitly reviewed topology pair at one final revision', () => {
  const report = compareSamples(topologySamples())
  expect(report).toMatchObject({ comparisonProtocol: TOPOLOGY_COMPARISON_PROTOCOL, meetsTarget: true, cohorts: { baseline: { executionTopology: { id: 'legacy-v1' } }, candidate: { executionTopology: { id: 'optimized-v1' } } } })
})

it.each([TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_V2_COMPARISON_PROTOCOL].flatMap(protocol => (
  ['swapped', 'same-topology', 'missing-topology', 'missing-protocol', 'unknown-protocol', 'changed-policy', 'other-revision', 'other-source', 'scope', 'input', 'resources']
    .map(fault => [protocol, fault])
)))(
  'rejects %s %s without weakening complete scope, inputs or resource identity',
  (protocol, fault) => {
    const values = topologySamples(protocol)
    const sample = values[5]
    if (fault === 'swapped') {
      for (const value of values) {
        value.executionTopology = resolveVerificationTopology(comparisonTopology(protocol, value.variant === 'baseline' ? 'candidate' : 'baseline'))
      }
    }
    if (fault === 'same-topology') {
      sample.executionTopology = resolveVerificationTopology(comparisonTopology(protocol, 'baseline'))
    }
    if (fault === 'missing-topology') {
      delete sample.executionTopology
    }
    if (fault === 'missing-protocol') {
      delete sample.comparisonProtocol
    }
    if (fault === 'unknown-protocol') {
      sample.comparisonProtocol = 'unchecked'
    }
    if (fault === 'changed-policy') {
      sample.executionTopology.policyDigest = 'f'.repeat(64)
    }
    if (fault === 'other-revision') {
      for (const value of values.filter(value => value.variant === 'candidate')) {
        value.revision = 'other-main'
      }
    }
    if (fault === 'other-source') {
      for (const value of values.filter(value => value.variant === 'candidate')) {
        value.sourceFingerprint = 'b'.repeat(64)
      }
    }
    if (fault === 'scope') {
      sample.scopeDigest = 'e'.repeat(64)
    }
    if (fault === 'input') {
      sample.inputDigest = 'e'.repeat(64)
    }
    if (fault === 'resources') {
      sample.profile.cachePolicy = 'different'
    }
    expect(() => compareSamples(values)).toThrow()
  },
)

it('compares v2 on the same final source and rejects runner-time growth despite faster completion', () => {
  const values = topologySamples(TOPOLOGY_V2_COMPARISON_PROTOCOL)
  expect(compareSamples(values).meetsTarget).toBe(true)
  expect(compareSamples([...values].reverse()).identityDigest).toBe(compareSamples(values).identityDigest)
  for (const sample of values.filter(sample => sample.variant === 'candidate')) {
    sample.metrics.runnerMs = 101
  }
  expect(compareSamples(values)).toMatchObject({ meetsTarget: false, reduction: 0.4 })
})

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid successful runner time %s before calculating v2 reduction', (runnerMs) => {
  const values = topologySamples(TOPOLOGY_V2_COMPARISON_PROTOCOL)
  values[0].metrics.runnerMs = runnerMs
  expect(() => compareSamples(values)).toThrow('runnerMs')
})

function ciTopologySamples(protocol = TOPOLOGY_V2_COMPARISON_PROTOCOL) {
  return topologySamples(protocol).map(sample => ({
    ...sample,
    measurement: 'ci',
    profile: { ...sample.profile, runnerClass: 'github-hosted' },
    metrics: { ...sample.metrics, approvalToCompletionMs: sample.variant === 'baseline' ? 200 : 130 },
  }))
}

it('uses approval-to-completion medians for formal v2 CI while preserving execution diagnostics', () => {
  const values = ciTopologySamples()
  const report = compareSamples(values)
  expect(report).toMatchObject({ measurement: 'ci', reductionMetric: 'approvalToCompletionMs', meetsTarget: true })
  expect(report.reduction).toBeCloseTo(0.35)
  expect(report.cohorts.candidate.medians).toMatchObject({ approvalToCompletionMs: 130, executionMs: 60 })
  expect(compareSamples([...values].reverse()).identityDigest).toBe(report.identityDigest)
})

it('rejects the speedup target when queue delay consumes a shorter execution path', () => {
  const values = ciTopologySamples()
  for (const sample of values.filter(sample => sample.variant === 'candidate')) {
    sample.metrics.approvalToCompletionMs = 180
    sample.metrics.executionMs = 20
  }
  expect(compareSamples(values)).toMatchObject({ meetsTarget: false })
  expect(compareSamples(values).reduction).toBeCloseTo(0.1)
})

it('requires no runner-time growth in addition to the formal v2 CI wall-time reduction', () => {
  const values = ciTopologySamples()
  for (const sample of values.filter(sample => sample.variant === 'candidate')) {
    sample.metrics.runnerMs = 101
  }
  expect(compareSamples(values).meetsTarget).toBe(false)
})

it('retains the execution metric for v1 CI and v2 local comparisons', () => {
  const values = ciTopologySamples(TOPOLOGY_COMPARISON_PROTOCOL)
  for (const sample of values.filter(sample => sample.variant === 'candidate')) {
    sample.metrics.approvalToCompletionMs = 200
  }
  expect(compareSamples(values)).toMatchObject({ reduction: 0.4, meetsTarget: true })
  expect(compareSamples(topologySamples(TOPOLOGY_V2_COMPARISON_PROTOCOL))).toMatchObject({ reduction: 0.4, meetsTarget: true })
})

it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects missing or invalid formal v2 CI wall time %s', (value) => {
  const values = ciTopologySamples()
  values[0].metrics.approvalToCompletionMs = value
  expect(() => compareSamples(values)).toThrow('approvalToCompletionMs')
})

it('rejects mixed local and CI cohorts or a missing explicit CI measurement identity', () => {
  const mixed = topologySamples(TOPOLOGY_V2_COMPARISON_PROTOCOL)
  mixed[5].measurement = 'ci'
  mixed[5].metrics.approvalToCompletionMs = 130
  expect(() => compareSamples(mixed)).toThrow(/mix CI and local/u)
  const ci = ciTopologySamples()
  delete ci[0].measurement
  expect(() => validateSample(ci[0])).toThrow(/explicit CI measurement/u)
})
