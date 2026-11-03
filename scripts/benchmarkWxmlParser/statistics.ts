import type { Arm, Operation, Sample, Statistics, Summary } from './types'
import { evaluateGate, percentile as pairedPercentile } from '../performanceGate/evaluate'
import { PERFORMANCE_CONTRACT } from './contracts'

export const percentile = (values: number[], fraction: number) => pairedPercentile(values, fraction) ?? Number.NaN

export function statistics(rows: Sample[]): Statistics {
  const normalized = rows.map(row => row.durationMs / row.iterations)
  const p50Ms = percentile(normalized, 0.5)
  return { count: rows.length, p50Ms, p95Ms: percentile(normalized, 0.95), documentsPerSecond: rows[0] ? rows[0].documents / p50Ms * 1000 : 0, mibPerSecond: rows[0] ? rows[0].bytes / 1048576 / p50Ms * 1000 : 0 }
}

export function summarize(samples: Sample[], operation: Operation, cohort: string, rounds: number): Summary {
  const rows = samples.filter(row => row.operation === operation.id && row.cohort === cohort)
  const stats = (arm: Arm, phase = 'primary') => statistics(rows.filter(row => row.arm === arm && row.phase === phase))
  const baseline = stats('baseline')
  const candidate = stats('candidate')
  const ratio = candidate.p50Ms / baseline.p50Ms
  const complete = (arm: Arm, phase: Sample['phase']) => {
    const selected = rows.filter(row => row.arm === arm && row.phase === phase)
    return selected.length === rounds && new Set(selected.map(row => row.round)).size === rounds
      && selected.every(row => Number.isInteger(row.round) && row.round >= 0 && row.round < rounds
        && (operation.comparable ? row.durationMs > 0 : row.durationMs >= 0)
        && Number.isFinite(row.durationMs) && Number.isInteger(row.iterations) && row.iterations > 0)
  }
  if (!complete('baseline', 'primary') || !complete('candidate', 'primary') || (operation.comparable && !Number.isFinite(ratio))) {
    return { operation: operation.id, cohort, ratio, status: 'incomplete', baseline, candidate }
  }
  if (!operation.comparable) {
    return { operation: operation.id, cohort, ratio, status: 'informational', baseline, candidate }
  }
  const scenario = (phase: Sample['phase']) => ({
    id: `${operation.id}:${cohort}`,
    requiredPairs: rounds,
    pairs: Array.from({ length: rounds }, (_, round) => {
      const before = rows.find(row => row.arm === 'baseline' && row.phase === phase && row.round === round)
      const after = rows.find(row => row.arm === 'candidate' && row.phase === phase && row.round === round)
      return { baseline: before ? before.durationMs / before.iterations : Number.NaN, current: after ? after.durationMs / after.iterations : Number.NaN }
    }),
  })
  const confirmationRows = rows.filter(row => row.phase === 'confirmation')
  const thresholdPercent = (PERFORMANCE_CONTRACT.aggregateCohorts as readonly string[]).includes(cohort)
    ? PERFORMANCE_CONTRACT.aggregateMaximumRegressionPercent
    : PERFORMANCE_CONTRACT.categoryMaximumRegressionPercent
  const gate = evaluateGate([scenario('primary')], confirmationRows.length ? [scenario('confirmation')] : [], thresholdPercent)
  return {
    operation: operation.id,
    cohort,
    ratio,
    status: gate.status,
    baseline,
    candidate,
    pairedDeltaMedianMs: gate.scenarios[0]!.primary.pairedDeltaMedianMs,
    ...(confirmationRows.length ? { confirmation: { baseline: stats('baseline', 'confirmation'), candidate: stats('candidate', 'confirmation'), ratio: stats('candidate', 'confirmation').p50Ms / stats('baseline', 'confirmation').p50Ms } } : {}),
  }
}
