import type { Arm, Sample } from '../../benchmarkWxmlParser/types'
import type { ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOperation, ProfileOptions } from './types'
import { validCalibrationEvidence } from '../../benchmarkWxmlParser/calibrationIntegrity'
import { stable } from '../../benchmarkWxmlParser/operations'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { evaluateGate } from '../../performanceGate/evaluate'
import { workloadIntegrity } from './workloadIntegrity'

function same(actual: unknown, expected: unknown): boolean {
  return stable(actual) === stable(expected)
}

export function regressionThreshold(group: string, gate: NonNullable<ProfileOptions['gate']>): number {
  return group.endsWith(gate.aggregateGroupSuffix) || gate.aggregateGroups?.includes(group) ? gate.aggregateMaximumRatio : gate.categoryMaximumRatio
}

function legacyRegressionIntegrity(result: ProfileMeasurement, fixtures: readonly ProfileFixture[], groups: readonly ProfileGroup[], options: ProfileOptions): string[] {
  const errors: string[] = []
  const operations = options.operations ?? ['scan', 'parse', 'canonical']
  const selected = groups.filter(group => !options.groups || options.groups.includes(group.id))
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  if (byId.size !== fixtures.length || new Set(groups.map(group => group.id)).size !== groups.length || new Set(operations).size !== operations.length) {
    errors.push('duplicate fixture, group or operation in external plan')
  }
  if (result.rounds !== options.rounds || result.warmup !== options.warmup || result.errors.length) {
    errors.push('measurement errors or sample budget differs from external plan')
  }
  const cells = selected.flatMap(group => operations.filter(operation => !group.operations || group.operations.includes(operation as ProfileOperation)).map(operation => ({ group, operation })))
  const cellKeys = new Set(cells.map(({ group, operation }) => `${operation}:${group.id}`))
  for (const row of [...result.samples, ...(result.warmupSamples ?? [])]) {
    if (!cellKeys.has(`${row.operation}:${row.cohort}`)) {
      errors.push(`unexpected sample cell ${row.operation}:${row.cohort}`)
    }
  }
  if (result.summaries.length !== cells.length || result.calibrations.length !== cells.length) {
    errors.push('missing or extra summary/calibration cell')
  }
  const expectedParity = new Set<string>()
  for (const { group, operation } of cells) {
    const key = `${operation}:${group.id}`
    if (!group.comparable || !group.fixtureIds.length || new Set(group.fixtureIds).size !== group.fixtureIds.length || group.fixtureIds.some(id => !byId.has(id))) {
      errors.push(`invalid paired group ${group.id}`)
      continue
    }
    for (const id of group.fixtureIds) {
      expectedParity.add(`${operation}:${id}`)
    }
    const bytes = group.fixtureIds.reduce((sum, id) => sum + byId.get(id)!.bytes, 0)
    const calibrations = result.calibrations.filter(item => item.operation === operation && item.cohort === group.id)
    const calibration = calibrations[0]
    if (calibrations.length !== 1 || !calibration || !Number.isSafeInteger(calibration.iterations) || calibration.iterations < 1) {
      errors.push(`missing, duplicate or invalid calibration ${key}`)
      continue
    }
    const informational = operation === 'preserve-noop'
    if (!validCalibrationEvidence(calibration, !informational)) {
      errors.push(`calibration probes differ from the shared batch policy ${key}`)
    }
    if (!informational && calibration.candidateResolved !== true) {
      errors.push(`unresolved clock calibration ${key}`)
    }
    const samples = result.samples.filter(row => row.operation === operation && row.cohort === group.id)
    const primary = samples.filter(row => row.phase === 'primary')
    const confirmation = samples.filter(row => row.phase === 'confirmation')
    const warmup = (result.warmupSamples ?? []).filter(row => row.operation === operation && row.cohort === group.id)
    const checkRows = (rows: Sample[], rounds: number, phase: string, iterations: number) => {
      if (rows.length !== rounds * 2) {
        errors.push(`missing or extra ${phase} pairs ${key}`)
      }
      rows.forEach((row, index) => {
        const round = Math.floor(index / 2)
        const order: Arm[] = round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
        if (row.round !== round || row.arm !== order[index % 2] || row.iterations !== iterations || row.documents !== group.fixtureIds.length || row.bytes !== bytes || !Number.isFinite(row.durationMs) || (informational ? row.durationMs < 0 : row.durationMs <= 0)) {
          errors.push(`invalid workload, order or duration in ${phase} ${key}:${index}`)
        }
      })
    }
    checkRows(warmup, options.warmup, 'warmup', 1)
    checkRows(primary, options.rounds, 'primary', calibration.iterations)
    if (samples.length !== primary.length + confirmation.length) {
      errors.push(`unknown sampling phase ${key}`)
    }
    const rows = (arm: Arm, phase: Sample['phase']) => samples.filter(row => row.arm === arm && row.phase === phase)
    const baseline = statistics(rows('baseline', 'primary'))
    const candidate = statistics(rows('candidate', 'primary'))
    const ratio = candidate.p50Ms / baseline.p50Ms
    const maximum = options.gate && !informational ? regressionThreshold(group.id, options.gate) : undefined
    const requiresConfirmation = maximum !== undefined && ratio > maximum
    if (requiresConfirmation) {
      checkRows(confirmation, options.rounds, 'confirmation', calibration.iterations)
    }
    else if (confirmation.length) {
      errors.push(`unnecessary confirmation ${key}`)
    }
    const scenario = (phase: Sample['phase']) => ({
      id: key,
      requiredPairs: options.rounds,
      pairs: Array.from({ length: options.rounds }, (_, round) => {
        const before = rows('baseline', phase).find(row => row.round === round)
        const after = rows('candidate', phase).find(row => row.round === round)
        return { baseline: before ? before.durationMs / before.iterations : Number.NaN, current: after ? after.durationMs / after.iterations : Number.NaN }
      }),
    })
    const expectedStatus = maximum === undefined || !requiresConfirmation ? 'complete' : evaluateGate([scenario('primary')], [scenario('confirmation')], (maximum - 1) * 100).status
    const summaries = result.summaries.filter(row => row.operation === operation && row.group === group.id)
    const summary = summaries[0]
    if (summaries.length !== 1 || !summary || summary.comparable !== true || summary.status !== expectedStatus || !same(summary.baseline, baseline) || !same(summary.candidate, candidate) || summary.ratio !== (Number.isFinite(ratio) ? ratio : null)) {
      errors.push(`summary does not match raw samples ${key}`)
    }
    if (summary && confirmation.length) {
      const repeatedBaseline = statistics(rows('baseline', 'confirmation'))
      const repeatedCandidate = statistics(rows('candidate', 'confirmation'))
      if (!same(summary.confirmation, { baseline: repeatedBaseline, candidate: repeatedCandidate, ratio: repeatedCandidate.p50Ms / repeatedBaseline.p50Ms })) {
        errors.push(`confirmation summary differs from raw samples ${key}`)
      }
    }
  }
  const parity = result.parity ?? []
  if (parity.length !== expectedParity.size || new Set(parity.map(row => `${row.operation}:${row.fixture}`)).size !== parity.length || parity.some(row => row.equal !== true || !expectedParity.has(`${row.operation}:${row.fixture}`))) {
    errors.push('missing, duplicate, failed or unexpected operation parity')
  }
  return errors
}

/** 从外部冻结计划重建每格工作量与速度结论，不能信任报告自带的 passed 或分母。 */
export function regressionIntegrity(result: ProfileMeasurement, fixtures: readonly ProfileFixture[], groups: readonly ProfileGroup[], options: ProfileOptions): string[] {
  if (options.workload) {
    try {
      return workloadIntegrity(result, fixtures, groups, options, legacyRegressionIntegrity)
    }
    catch (error) {
      return [`invalid external workload: ${String(error)}`]
    }
  }
  if (result.schemaVersion !== 1 || result.workload || result.physicalMeasurements) {
    return ['Legacy measurement cannot claim shared workload evidence']
  }
  return legacyRegressionIntegrity(result, fixtures, groups, options)
}
