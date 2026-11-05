import type { Sample } from '../../benchmarkWxmlParser/types'
import type { ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions } from './types'
import { describe, expect, it } from 'vitest'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { regressionIntegrity } from './regressionIntegrity'

const fixture = { id: 'fixture', bytes: 8 } as ProfileFixture
const group: ProfileGroup = { id: 'old464/real-all', comparable: true, fixtureIds: [fixture.id] }
const options: ProfileOptions = { rounds: 2, warmup: 1, operations: ['parse'], gate: { aggregateGroupSuffix: '/all', aggregateGroups: ['old464/real-all'], aggregateMaximumRatio: 1.03, categoryMaximumRatio: 1.05 } }

function rows(ratio: number, rounds = 2, phase: Sample['phase'] = 'primary', iterations = 2): Sample[] {
  return Array.from({ length: rounds }, (_, round) => (round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']).map(arm => ({ operation: 'parse', cohort: group.id, round, arm: arm as Sample['arm'], phase, durationMs: arm === 'baseline' ? 10 : 10 * ratio, iterations, documents: 1, bytes: 8 }))).flat()
}

function measurement(ratio = 1, repeated?: number): ProfileMeasurement {
  const primary = rows(ratio)
  const baseline = statistics(primary.filter(row => row.arm === 'baseline'))
  const candidate = statistics(primary.filter(row => row.arm === 'candidate'))
  const confirmation = repeated === undefined ? [] : rows(repeated, 2, 'confirmation')
  const repeatedBaseline = statistics(confirmation.filter(row => row.arm === 'baseline'))
  const repeatedCandidate = statistics(confirmation.filter(row => row.arm === 'candidate'))
  return {
    schemaVersion: 1,
    purpose: 'independent-corpus-profile',
    oldPerformanceGate: 'unchanged-464-document-bench:check',
    rounds: 2,
    warmup: 1,
    clock: { resolutionMs: 0.001, samples: 1 } as unknown as ProfileMeasurement['clock'],
    samples: [...primary, ...confirmation],
    warmupSamples: rows(1, 1, 'primary', 1),
    calibrations: [{ operation: 'parse', cohort: group.id, iterations: 2, candidateResolved: true, probes: [{ arm: 'baseline', iterations: 1, durationMs: 25 }, { arm: 'candidate', iterations: 2, durationMs: 10 }] }],
    summaries: [{ operation: 'parse', group: group.id, comparable: true, status: repeated === undefined ? 'complete' : repeated > 1.03 ? 'regression' : 'unstable', baseline, candidate, ratio: candidate.p50Ms / baseline.p50Ms, ...(repeated === undefined ? {} : { confirmation: { baseline: repeatedBaseline, candidate: repeatedCandidate, ratio: repeatedCandidate.p50Ms / repeatedBaseline.p50Ms } }) }],
    parity: [{ fixture: fixture.id, operation: 'parse', equal: true }],
    errors: [],
    firstCalls: [],
  }
}

const check = (result: ProfileMeasurement) => regressionIntegrity(result, [fixture], [group], options)

describe('regression evidence integrity', () => {
  it('recomputes a complete passing workload from raw pairs', () => {
    expect(check(measurement())).toEqual([])
  })

  it.each(['regression', 'unstable'] as const)('preserves one equal-size %s confirmation', (status) => {
    expect(check(measurement(1.06, status === 'regression' ? 1.07 : 1.01))).toEqual([])
  })

  it.each([
    ['whole operation removed', (result: ProfileMeasurement) => {
      result.samples = []
      result.summaries = []
      result.calibrations = []
    }],
    ['paired arm omitted', (result: ProfileMeasurement) => { result.samples.pop() }],
    ['pair order reversed', (result: ProfileMeasurement) => { result.samples.reverse() }],
    ['batch differs', (result: ProfileMeasurement) => { result.samples[1]!.iterations++ }],
    ['workload shrunk', (result: ProfileMeasurement) => { result.samples[0]!.bytes-- }],
    ['summary forged', (result: ProfileMeasurement) => { result.summaries[0]!.candidate.p50Ms = 0.1 }],
    ['warmup omitted', (result: ProfileMeasurement) => { result.warmupSamples = [] }],
    ['calibration probes omitted', (result: ProfileMeasurement) => { result.calibrations[0]!.probes = [] }],
    ['parity omitted', (result: ProfileMeasurement) => { result.parity = [] }],
    ['unnecessary confirmation', (result: ProfileMeasurement) => { result.samples.push(...rows(1, 2, 'confirmation')) }],
    ['zero production duration', (result: ProfileMeasurement) => { result.samples[0]!.durationMs = 0 }],
  ] as const)('rejects %s', (_name, mutate) => {
    const result = measurement()
    mutate(result)
    expect(check(result).length).toBeGreaterThan(0)
  })

  it('rejects a missing confirmation and a forged passing conclusion', () => {
    const result = measurement(1.06)
    expect(check(result).length).toBeGreaterThan(0)
    const confirmed = measurement(1.06, 1.07)
    confirmed.summaries[0]!.status = 'passed'
    expect(check(confirmed).length).toBeGreaterThan(0)
  })
})
