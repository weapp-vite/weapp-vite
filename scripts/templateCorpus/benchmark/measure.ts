import type { Arm, Sample } from '../../benchmarkWxmlParser/types'
import type { ProfileDependencies, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOperation, ProfileOptions } from './types'
import { calibrateBatch } from '../../benchmarkWxmlParser/calibration'
import { probeClock } from '../../benchmarkWxmlParser/clock'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { createProfileRuntime } from './operations'

/** 复用既有共同批量校准与统计，交替成对保留原始样本；该报告不替代旧门禁。 */
export function measureProfile(dependencies: ProfileDependencies, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions): ProfileMeasurement {
  const result: ProfileMeasurement = {
    schemaVersion: 1,
    purpose: 'independent-corpus-profile',
    oldPerformanceGate: 'unchanged-464-document-bench:check',
    rounds: options.rounds,
    warmup: options.warmup,
    clock: probeClock(),
    samples: [],
    calibrations: [],
    summaries: [],
    errors: [],
    firstCalls: [],
  }
  const runtime = createProfileRuntime(dependencies, fixtures)
  let sink: unknown
  for (const operation of ['scan', 'parse', 'canonical'] as const) {
    if (operation === 'canonical') {
      continue
    }
    for (const arm of ['baseline', 'candidate'] as const) {
      const files = fixtures.filter(fixture => arm === 'candidate' || fixture.comparison.eligible)
      try {
        const started = performance.now()
        for (const fixture of files) {
          sink = runtime.run(fixture, operation, arm)
        }
        result.firstCalls.push({ operation, arm, durationMs: performance.now() - started, documents: files.length })
      }
      catch (error) {
        result.errors.push({ operation, phase: 'first-corpus-pass', error: String(error) })
      }
    }
  }
  const failed = runtime.prepare()
  result.errors.push(...failed.map(failure => ({ ...failure, phase: 'preflight' })))
  const failures = new Set(failed.map(failure => failure.fixture))
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  for (const group of groups.filter(group => !options.groups || options.groups.includes(group.id))) {
    const files = group.fixtureIds.map(id => byId.get(id)!)
    for (const operation of ['scan', 'parse', 'canonical'] as const) {
      let incomplete = files.some(fixture => failures.has(fixture.id))
      const batch = (arm: Arm, iterations: number) => {
        const started = performance.now()
        for (let iteration = 0; iteration < iterations; iteration++) {
          for (const fixture of files) {
            sink = runtime.run(fixture, operation, group.comparable ? arm : 'candidate')
          }
        }
        return performance.now() - started
      }
      const collect = (round: number, iterations: number, timed: boolean) => {
        const order: Arm[] = group.comparable ? round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'] : ['candidate']
        for (const arm of order) {
          const durationMs = batch(arm, iterations)
          if (timed) {
            result.samples.push({ operation, cohort: group.id, round, arm, phase: 'primary', durationMs, iterations, documents: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) })
          }
        }
      }
      try {
        if (!incomplete) {
          for (let round = 0; round < options.warmup; round++) {
            collect(round, 1, false)
          }
          const calibration = calibrateBatch(batch, group.comparable)
          result.calibrations.push({ operation, cohort: group.id, ...calibration, probes: calibration.probes.map(probe => ({ ...probe, arm: group.comparable ? probe.arm : 'candidate' })) })
          if (calibration.candidateResolved === false) {
            throw new Error('Candidate clock resolution is insufficient at the maximum common batch')
          }
          for (let round = 0; round < options.rounds; round++) {
            collect(round, calibration.iterations, true)
          }
        }
      }
      catch (error) {
        incomplete = true
        result.errors.push({ operation, group: group.id, phase: 'measurement', error: String(error) })
      }
      const rows = (arm: Arm): Sample[] => result.samples.filter(sample => sample.operation === operation && sample.cohort === group.id && sample.arm === arm)
      const candidate = statistics(rows('candidate'))
      const baseline = group.comparable ? statistics(rows('baseline')) : undefined
      const valid = (arm: Arm) => rows(arm).length === options.rounds && new Set(rows(arm).map(row => row.round)).size === options.rounds && rows(arm).every(row => Number.isFinite(row.durationMs) && row.durationMs > 0)
      const complete = !incomplete && valid('candidate') && (!baseline || valid('baseline'))
      result.summaries.push({ operation: operation as ProfileOperation, group: group.id, comparable: group.comparable, status: complete ? 'complete' : 'incomplete', candidate, ...(baseline ? { baseline } : {}), ratio: baseline && Number.isFinite(candidate.p50Ms / baseline.p50Ms) ? candidate.p50Ms / baseline.p50Ms : null })
    }
  }
  Reflect.set(globalThis, '__templateCorpusProfileSink', sink)
  return result
}
