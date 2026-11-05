import type { Arm, Sample } from '../../benchmarkWxmlParser/types'
import type { ProfileCheckpoint, ProfileDependencies, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOperation, ProfileOptions, ProfileSummary } from './types'
import { calibrateBatch } from '../../benchmarkWxmlParser/calibration'
import { probeClock } from '../../benchmarkWxmlParser/clock'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { evaluateGate } from '../../performanceGate/evaluate'
import { createProfileRuntime } from './operations'
import { REGRESSION_PROGRESS_PREFIX } from './progress'
import { createWorkloadPlan, physicalEvidence, physicalIdentity, referenceSummary } from './workload'

/** 复用既有共同批量校准与统计，交替成对保留原始样本；该报告不替代旧门禁。 */
export function* measureProfileCells(dependencies: ProfileDependencies, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions): Generator<ProfileCheckpoint, ProfileMeasurement> {
  const workload = createWorkloadPlan(fixtures, groups, options)
  const result: ProfileMeasurement = {
    schemaVersion: workload ? 2 : 1,
    purpose: 'independent-corpus-profile',
    oldPerformanceGate: 'unchanged-464-document-bench:check',
    rounds: options.rounds,
    warmup: options.warmup,
    clock: probeClock(),
    samples: [],
    ...(options.gate ? { warmupSamples: [], parity: [] } : {}),
    calibrations: [],
    summaries: [],
    errors: [],
    firstCalls: [],
    ...(workload ? { workload, physicalMeasurements: [] } : {}),
  }
  const completedJobs = new Map<string, ProfileSummary>()
  const jobByCell = new Map(workload?.cells.map(cell => [`${cell.operation}:${cell.group}`, cell.jobId]))
  const jobs = new Map(workload?.jobs.map(job => [job.id, job]))
  const runtime = createProfileRuntime(dependencies, fixtures)
  let sink: unknown
  const operations = options.operations ?? ['scan', 'parse', 'canonical'] as const
  const selectedGroups = groups.filter(group => !options.groups || options.groups.includes(group.id))
  const totalCells = selectedGroups.reduce((sum, group) => sum + operations.filter(operation => !group.operations || group.operations.includes(operation)).length, 0)
  for (const operation of operations) {
    if (operation !== 'scan' && operation !== 'parse') {
      continue
    }
    for (const arm of ['baseline', 'candidate'] as const) {
      const run = runtime.select(operation, arm)
      const files = fixtures.filter(fixture => arm === 'candidate' || dependencies.baselineApi || fixture.comparison.eligible)
      try {
        const started = performance.now()
        for (const fixture of files) {
          sink = run(fixture)
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
  const verified = new Map<string, boolean>()
  yield { kind: 'start', schemaVersion: result.schemaVersion, rounds: result.rounds, warmup: result.warmup, clock: result.clock, firstCalls: result.firstCalls, errors: [...result.errors], ...(workload ? { workload } : {}) }
  for (const group of selectedGroups) {
    const files = group.fixtureIds.map(id => byId.get(id)!)
    for (const operation of operations) {
      if (group.operations && !group.operations.includes(operation)) {
        continue
      }
      const jobId = jobByCell.get(`${operation}:${group.id}`)
      const previous = jobId && completedJobs.get(jobId)
      if (jobId && previous) {
        const summary = referenceSummary(previous, group.id)
        result.summaries.push(summary)
        yield { kind: 'reference', operation, group: group.id, jobId, evidenceSha256: summary.measurement!.evidenceSha256, completed: result.summaries.length, total: totalCells, summary }
        if (options.progress) {
          console.info(`${REGRESSION_PROGRESS_PREFIX} ${result.summaries.length}/${totalCells} ${operation} ${group.id} ${summary.status} reference=${jobId}`)
        }
        continue
      }
      const before = { samples: result.samples.length, warmup: result.warmupSamples?.length ?? 0, calibrations: result.calibrations.length, parity: result.parity?.length ?? 0, errors: result.errors.length }
      for (const fixture of files) {
        const key = `${operation}:${fixture.id}`
        if (!verified.has(key)) {
          try {
            runtime.verifyOperation?.(fixture, operation)
            verified.set(key, true)
            result.parity?.push({ fixture: fixture.id, operation, equal: true })
          }
          catch (error) {
            verified.set(key, false)
            result.parity?.push({ fixture: fixture.id, operation, equal: false })
            result.errors.push({ fixture: fixture.id, operation, group: group.id, phase: 'parity', error: String(error) })
          }
        }
      }
      let incomplete = files.some(fixture => failures.has(fixture.id))
        || files.some(fixture => verified.get(`${operation}:${fixture.id}`) === false)
      const informational = operation === 'preserve-noop'
      const runners = { baseline: runtime.select(operation, 'baseline'), candidate: runtime.select(operation, 'candidate') }
      let iterations = 1
      const batch = (arm: Arm, iterations: number) => {
        const run = runners[group.comparable ? arm : 'candidate']
        const started = performance.now()
        for (let iteration = 0; iteration < iterations; iteration++) {
          for (const fixture of files) {
            sink = run(fixture)
          }
        }
        return performance.now() - started
      }
      const collect = (round: number, iterations: number, timed: boolean, phase: 'primary' | 'confirmation' = 'primary') => {
        const order: Arm[] = group.comparable ? round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'] : ['candidate']
        for (const arm of order) {
          const durationMs = batch(arm, iterations)
          if (timed) {
            result.samples.push({ operation, cohort: group.id, round, arm, phase, durationMs, iterations, documents: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) })
          }
          else {
            result.warmupSamples?.push({ operation, cohort: group.id, round, arm, phase: 'primary', durationMs, iterations, documents: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) })
          }
        }
      }
      try {
        if (!incomplete) {
          for (let round = 0; round < options.warmup; round++) {
            collect(round, 1, false)
          }
          const calibration = calibrateBatch(batch, group.comparable && !informational)
          iterations = calibration.iterations
          result.calibrations.push({ operation, cohort: group.id, ...calibration, probes: calibration.probes.map(probe => ({ ...probe, arm: group.comparable ? probe.arm : 'candidate' })) })
          if (calibration.candidateResolved === false) {
            throw new Error('Candidate clock resolution is insufficient at the maximum common batch')
          }
          for (let round = 0; round < options.rounds; round++) {
            collect(round, iterations, true)
          }
        }
      }
      catch (error) {
        incomplete = true
        result.errors.push({ operation, group: group.id, phase: 'measurement', error: String(error) })
      }
      const rows = (arm: Arm, phase: 'primary' | 'confirmation' = 'primary'): Sample[] => result.samples.filter(sample => sample.operation === operation && sample.cohort === group.id && sample.arm === arm && sample.phase === phase)
      const candidate = statistics(rows('candidate'))
      const baseline = group.comparable ? statistics(rows('baseline')) : undefined
      const valid = (arm: Arm, phase: 'primary' | 'confirmation' = 'primary') => rows(arm, phase).length === options.rounds && new Set(rows(arm, phase).map(row => row.round)).size === options.rounds && rows(arm, phase).every(row => Number.isFinite(row.durationMs) && (informational ? row.durationMs >= 0 : row.durationMs > 0))
      const complete = !incomplete && valid('candidate') && (!baseline || valid('baseline'))
      let status: ProfileSummary['status'] = complete ? 'complete' : 'incomplete'
      const ratio = baseline && Number.isFinite(candidate.p50Ms / baseline.p50Ms) ? candidate.p50Ms / baseline.p50Ms : null
      const threshold = options.gate && group.comparable && !informational
        ? group.id.endsWith(options.gate.aggregateGroupSuffix) || options.gate.aggregateGroups?.includes(group.id) ? options.gate.aggregateMaximumRatio : options.gate.categoryMaximumRatio
        : undefined
      if (complete && options.gate && threshold !== undefined && ratio !== null && ratio > threshold) {
        try {
          for (let round = 0; round < options.rounds; round++) {
            collect(round, iterations, true, 'confirmation')
          }
          const scenario = {
            id: `${operation}/${group.id}`,
            requiredPairs: options.rounds,
            pairs: Array.from({ length: options.rounds }, (_, round) => ({
              baseline: rows('baseline', 'primary').find(sample => sample.round === round)!.durationMs / rows('baseline', 'primary').find(sample => sample.round === round)!.iterations,
              current: rows('candidate', 'primary').find(sample => sample.round === round)!.durationMs / rows('candidate', 'primary').find(sample => sample.round === round)!.iterations,
            })),
          }
          const confirmation = {
            id: `${operation}/${group.id}`,
            requiredPairs: options.rounds,
            pairs: Array.from({ length: options.rounds }, (_, round) => ({
              baseline: rows('baseline', 'confirmation').find(sample => sample.round === round)!.durationMs / rows('baseline', 'confirmation').find(sample => sample.round === round)!.iterations,
              current: rows('candidate', 'confirmation').find(sample => sample.round === round)!.durationMs / rows('candidate', 'confirmation').find(sample => sample.round === round)!.iterations,
            })),
          }
          const gate = evaluateGate([scenario], [confirmation], (threshold - 1) * 100)
          status = gate.status === 'passed' ? 'passed' : gate.status
        }
        catch (error) {
          incomplete = true
          status = 'incomplete'
          result.errors.push({ operation, group: group.id, phase: 'confirmation', error: String(error) })
        }
      }
      const confirmationCandidate = statistics(rows('candidate', 'confirmation'))
      const confirmationBaseline = statistics(rows('baseline', 'confirmation'))
      result.summaries.push({ operation: operation as ProfileOperation, group: group.id, comparable: group.comparable, status, candidate, ...(baseline ? { baseline } : {}), ratio, ...(rows('candidate', 'confirmation').length ? { confirmation: { candidate: confirmationCandidate, baseline: confirmationBaseline, ratio: confirmationCandidate.p50Ms / confirmationBaseline.p50Ms } } : {}) })
      const record: Extract<ProfileCheckpoint, { kind: 'cell' }> = { kind: 'cell', operation, group: group.id, completed: result.summaries.length, total: totalCells, samples: result.samples.slice(before.samples), warmupSamples: result.warmupSamples?.slice(before.warmup) ?? [], calibrations: result.calibrations.slice(before.calibrations), parity: result.parity?.slice(before.parity) ?? [], errors: result.errors.slice(before.errors), summary: result.summaries.at(-1)! }
      if (jobId) {
        const job = jobs.get(jobId)!
        const physical: Extract<ProfileCheckpoint, { kind: 'job' }> = { ...record, kind: 'job', jobId, keySha256: job.keySha256, evidenceSha256: '', representativeGroup: group.id }
        physical.evidenceSha256 = physicalEvidence(physical)
        physical.summary.measurement = { jobId, evidenceSha256: physical.evidenceSha256, representativeGroup: group.id }
        completedJobs.set(jobId, physical.summary)
        result.physicalMeasurements!.push(physicalIdentity(physical))
        yield physical
      }
      else {
        yield record
      }
      if (options.progress) {
        console.info(`${REGRESSION_PROGRESS_PREFIX} ${result.summaries.length}/${totalCells} ${operation} ${group.id} ${status} ratio=${ratio === null ? 'n/a' : ratio.toFixed(4)} baseline=${baseline?.p50Ms.toFixed(4) ?? 'n/a'}ms candidate=${candidate.p50Ms.toFixed(4)}ms`)
      }
    }
  }
  Reflect.set(globalThis, '__templateCorpusProfileSink', sink)
  yield { kind: 'complete', cells: result.summaries.length, samples: result.samples.length, warmupSamples: result.warmupSamples?.length ?? 0, parity: result.parity?.length ?? 0, errors: result.errors.length, ...(workload ? { physicalJobs: result.physicalMeasurements!.length } : {}) }
  return result
}

/** 保留旧同步入口；未启用持久化时不增加异步回调或改变采样顺序。 */
export function measureProfile(dependencies: ProfileDependencies, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions): ProfileMeasurement {
  const cells = measureProfileCells(dependencies, fixtures, groups, options)
  let step = cells.next()
  while (!step.done) {
    step = cells.next()
  }
  return step.value
}

/** 每格计时和统计结束后才等待 checkpoint；写盘与浏览器 RPC 均在热循环之外。 */
export async function measureProfileWithCheckpoint(dependencies: ProfileDependencies, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions, checkpoint: (record: ProfileCheckpoint) => Promise<void>): Promise<ProfileMeasurement> {
  const cells = measureProfileCells(dependencies, fixtures, groups, options)
  let step = cells.next()
  while (!step.done) {
    await checkpoint(step.value)
    step = cells.next()
  }
  return step.value
}
