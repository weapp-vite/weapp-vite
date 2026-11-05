import type { EntryFixture, EntryProfileSample, EntrySteadyResult } from './types'
import { validCalibrationEvidence } from '../calibrationIntegrity'
import { percentile } from '../statistics'

const finite = (value: number) => Number.isFinite(value) && value >= 0
const distribution = (values: number[]) => ({ samples: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) })

/** 初始化、模块、首次调用和内存保持独立分母，不用核心收益替代根入口完整元数据门禁。 */
export function entryProfileSummary(samples: readonly EntryProfileSample[], steady: EntrySteadyResult) {
  const cold = []
  const warm = []
  for (const operation of ['scan', 'parse'] as const) {
    for (const arm of ['baseline', 'root', 'core'] as const) {
      const rows = samples.filter(sample => sample.operation === operation && sample.arm === arm)
      const firstCall = distribution(rows.map(row => row.firstCallMs))
      const memoryKeys = [...new Set(rows.flatMap(row => Object.keys(row.memory?.beforeImport ?? {})))].sort()
      cold.push({ operation, arm, moduleMs: distribution(rows.map(row => row.moduleMs)), initializationMs: distribution(rows.map(row => row.initializationMs)), initializationKind: arm === 'core' ? 'compile-dialect-and-create-parser' : 'benchmark-adapter-binding', firstCallMs: firstCall, documentsPerSecond: rows[0] && firstCall.p50 > 0 ? rows[0].documents / firstCall.p50 * 1000 : null, mibPerSecond: rows[0] && firstCall.p50 > 0 ? rows[0].bytes / 1048576 / firstCall.p50 * 1000 : null, peakRssBytes: rows.some(row => row.memory?.peakRssBytes === null) ? null : distribution(rows.map(row => row.memory?.peakRssBytes ?? Number.NaN)), memoryDeltas: memoryKeys.map(key => ({ metric: key, module: distribution(rows.map(row => row.memory!.afterImport[key]! - row.memory!.beforeImport[key]!)), initialization: distribution(rows.map(row => row.memory!.afterInitialization[key]! - row.memory!.afterImport[key]!)), firstCall: distribution(rows.map(row => row.memory!.afterFirstCall[key]! - row.memory!.afterInitialization[key]!)) })) })
      if (arm === 'baseline') {
        continue
      }
      const selected = steady.samples.filter(sample => sample.operation === operation && sample.arm === arm && sample.phase === 'primary')
      const duration = distribution(selected.map(sample => sample.durationMs / sample.iterations))
      warm.push({ operation, arm, durationMs: duration, documentsPerSecond: selected[0] && duration.p50 > 0 ? selected[0].documents / duration.p50 * 1000 : null, mibPerSecond: selected[0] && duration.p50 > 0 ? selected[0].bytes / 1048576 / duration.p50 * 1000 : null })
    }
  }
  return { cold, steady: warm }
}

/** 核对三个真实入口、两类首次调用和绑定后所有成对工作量；信息性报告同样拒绝缺样。 */
export function entryProfileIntegrity(result: { samples: EntryProfileSample[], steady: EntrySteadyResult, errors: unknown[] }, fixtures: readonly EntryFixture[], rounds: number, warmup: number): string[] {
  const errors: string[] = []
  const bytes = fixtures.reduce((sum, fixture) => sum + fixture.bytes, 0)
  const parsers = new Set(fixtures.map(fixture => fixture.profileId)).size
  if (!fixtures.length || new Set(fixtures.map(fixture => fixture.id)).size !== fixtures.length || !bytes || result.errors.length || result.steady.errors.length || result.samples.length !== rounds * 6) {
    errors.push('isolated entry errors or missing cold samples')
  }
  const plan = Array.from({ length: rounds }, (_, round) => (['scan', 'parse'] as const).flatMap(operation => (round % 2 ? ['core', 'root', 'baseline'] : ['baseline', 'root', 'core']).map(arm => ({ round, operation, arm })))).flat()
  result.samples.forEach((sample, index) => {
    const expected = plan[index]
    if (!expected || expected.arm !== sample.arm || expected.operation !== sample.operation || expected.round !== sample.round || sample.documents !== fixtures.length || sample.bytes !== bytes || sample.parsers !== parsers || sample.initializationKind !== (sample.arm === 'core' ? 'compile-dialect-and-create-parser' : 'benchmark-adapter-binding') || ![sample.moduleMs, sample.initializationMs, sample.firstCallMs].every(finite)) {
      errors.push(`invalid isolated entry sample ${index}`)
    }
    const stages = ['beforeImport', 'afterImport', 'afterInitialization', 'afterFirstCall'] as const
    const memoryKeys = Object.keys(sample.memory?.beforeImport ?? {}).sort()
    if (!sample.memory || !memoryKeys.length || stages.some(stage => !sample.memory?.[stage] || Object.keys(sample.memory[stage]).sort().join(',') !== memoryKeys.join(',') || Object.values(sample.memory[stage]).some(value => !finite(value))) || (sample.memory.peakRssBytes !== null && !finite(sample.memory.peakRssBytes))) {
      errors.push(`invalid isolated entry memory ${index}`)
    }
    if (sample.clock.source !== 'performance.now' || sample.clock.positiveChanges <= 0 || sample.clock.minimumPositiveDeltaMs === null || sample.clock.minimumPositiveDeltaMs <= 0 || sample.firstCallMs <= sample.clock.minimumPositiveDeltaMs || (sample.injectionMs !== undefined && (!finite(sample.injectionMs) || sample.clock.crossOriginIsolated !== true))) {
      errors.push(`invalid isolated entry clock ${index}`)
    }
  })
  if (result.steady.parity.length !== fixtures.length || new Set(result.steady.parity.map(row => row.fixture)).size !== fixtures.length || result.steady.parity.some(row => !row.scan || !row.parse || !fixtures.some(fixture => fixture.id === row.fixture))) {
    errors.push('missing or failed full metadata root/core parity')
  }
  for (const operation of ['scan', 'parse'] as const) {
    const calibrations = result.steady.calibrations.filter(row => row.operation === operation)
    const calibration = calibrations[0]
    if (calibrations.length !== 1 || !calibration || calibration.candidateResolved !== true || !Number.isInteger(calibration.iterations) || calibration.iterations <= 0 || !validCalibrationEvidence(calibration, true)) {
      errors.push(`missing or unresolved core steady calibration ${operation}`)
      continue
    }
    for (const [phase, count, iterations] of [['warmup', warmup, 1], ['primary', rounds, calibration.iterations]] as const) {
      const rows = result.steady.samples.filter(row => row.operation === operation && row.phase === phase)
      if (rows.length !== count * 2) {
        errors.push(`missing core steady ${phase} pairs ${operation}`)
      }
      rows.forEach((row, index) => {
        const round = Math.floor(index / 2)
        const arm = (round % 2 ? ['core', 'root'] : ['root', 'core'])[index % 2]
        if (row.round !== round || row.arm !== arm || row.iterations !== iterations || row.documents !== fixtures.length || row.bytes !== bytes || !finite(row.durationMs) || row.durationMs === 0) {
          errors.push(`invalid core steady paired workload ${operation}:${phase}:${index}`)
        }
      })
    }
  }
  if (result.steady.samples.length !== (rounds + warmup) * 4) {
    errors.push('extra core steady sample or operation')
  }
  return errors
}
