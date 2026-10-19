import { expect, it } from 'vitest'
import { vitestScope } from './verificationBenchmark/capture.mjs'
import { compareSamples, validateSample } from './verificationBenchmark/compare.mjs'

function sample(variant, index, executionMs) {
  return {
    schemaVersion: 1,
    id: `${variant}-${index}`,
    variant,
    revision: variant,
    sourceFingerprint: (variant === 'baseline' ? 'c' : 'd').repeat(64),
    inputDigest: 'a'.repeat(64),
    scopeDigest: 'b'.repeat(64),
    profile: { os: 'linux', node: '24', provider: 'headless', platform: 'weapp', runnerClass: 'github-hosted', cachePolicy: 'warm' },
    complete: true,
    outcome: 'passed',
    metrics: { executionMs, approvalWaitMs: 100, schedulingWaitMs: 200, runnerMs: executionMs * 2 },
  }
}

function samples() {
  return [...[100, 110, 120].map((ms, i) => sample('baseline', i, ms)), ...[60, 70, 80].map((ms, i) => sample('candidate', i, ms))]
}

it('compares medians independently from approval, queue and runner cost', () => {
  const report = compareSamples(samples())
  expect(report.reduction).toBeCloseTo(1 - 70 / 110)
  expect(report.meetsTarget).toBe(true)
  expect(report.cohorts.candidate.medians).toEqual({ executionMs: 70, approvalWaitMs: 100, schedulingWaitMs: 200, runnerMs: 140 })
  expect(compareSamples(samples().map(value => ({ ...value, metrics: { ...value.metrics, executionMs: 100 } })))).toMatchObject({ reduction: 0, meetsTarget: false })
})

it('retains failed samples without including them in the speedup claim', () => {
  const failed = { ...sample('candidate', 3, 1), outcome: 'failed', complete: false }
  const report = compareSamples([...samples(), failed])
  expect(report.cohorts.candidate.samples).toHaveLength(3)
  expect(report.excluded).toEqual([{ id: 'candidate-3', outcome: 'failed' }])
  expect(() => compareSamples([...samples().slice(0, 5), failed])).toThrow(/successful candidate/)
})

it('excludes partial runtime attempts without requiring an unobserved IDE identity', () => {
  const values = samples().map(value => ({ ...value, profile: { ...value.profile, ideVersion: 'stable', baseLibraryVersion: 'sdk' } }))
  const failed = { ...sample('candidate', 3, 1), inputDigest: 'e'.repeat(64), outcome: 'partial', complete: false }
  const report = compareSamples([failed, ...values])
  expect(report.profile).toEqual(values[0].profile)
  expect(report.inputDigest).toBe(values[0].inputDigest)
  expect(report.cohorts.candidate.samples).toHaveLength(3)
  expect(report.excluded).toEqual([{ id: 'candidate-3', outcome: 'partial' }])
})

it.each(['inputDigest', 'scopeDigest', 'revision', 'sourceFingerprint'])('rejects changed %s during sampling', (key) => {
  const values = samples()
  values[5] = { ...values[5], [key]: 'f'.repeat(64) }
  expect(() => compareSamples(values)).toThrow(/differ|Source changed/)
})

it('derives the exact executed Vitest case set and rejects partial or duplicate evidence', () => {
  const root = process.cwd()
  const report = {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numTotalTests: 2,
    numPassedTests: 2,
    testResults: [{ name: `${root}/sample.test.ts`, assertionResults: [{ fullName: 'case A', status: 'passed' }, { fullName: 'case B', status: 'passed' }] }],
  }
  expect(vitestScope(report, root)).toEqual(['sample.test.ts:case A', 'sample.test.ts:case B'])
  expect(() => vitestScope({ ...report, numPendingTests: 1 }, root)).toThrow(/complete/)
  expect(() => vitestScope({ ...report, numTotalTests: 3, numPassedTests: 3 }, root)).toThrow(/inventory/)
  expect(() => vitestScope({ ...report, testResults: [...report.testResults, ...report.testResults], numTotalTests: 4, numPassedTests: 4 }, root)).toThrow(/duplicated/)
})

it.each(['os', 'node', 'provider', 'platform', 'runnerClass', 'cachePolicy'])('rejects incomparable %s profiles', (key) => {
  const values = samples()
  values[5].profile = { ...values[5].profile, [key]: 'other' }
  expect(() => compareSamples(values)).toThrow(/profile differ/)
})

it('rejects duplicate identities, missing rounds, invalid metrics and partial success', () => {
  expect(() => compareSamples([...samples(), samples()[0]])).toThrow(/Duplicate/)
  expect(() => compareSamples(samples().slice(0, 5))).toThrow(/candidate/)
  expect(() => validateSample({ ...samples()[0], complete: false })).toThrow(/partial/)
  for (const executionMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0]) {
    expect(() => validateSample({ ...samples()[0], metrics: { ...samples()[0].metrics, executionMs } })).toThrow(/executionMs/)
  }
})
