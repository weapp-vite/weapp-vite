import type { Cell, Collection, Measurement, Outcome } from './types'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertExactParity(expected: Outcome, actual: Outcome, label: string) {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error(`Exact compiler parity failed: ${label}; output, map, metadata, diagnostics, warning order or error changed.`)
  }
}

export function cellKey(cell: Cell, includeArm = true) {
  return [cell.caseId, cell.condition, cell.sourceMap, cell.metric, cell.trial, ...(includeArm ? [cell.arm] : [])].join(':')
}

export function assertMeasurement(sample: Measurement, expected: Cell) {
  if (!isDeepStrictEqual(sample.cell, expected)) {
    throw new Error(`Worker returned a different sampling cell: ${cellKey(expected)}`)
  }
  for (const key of ['compileMs', 'addonLoadMs', 'importMs', 'preparationMs', 'rssBefore', 'rssAfter', 'peakRssBytes'] as const) {
    if (!Number.isFinite(sample[key]) || sample[key] < 0) {
      throw new Error(`Invalid measurement ${key}: ${cellKey(expected)}`)
    }
  }
  if (sample.outcome.status !== 'success') {
    throw new Error(`Real fixture compilation failed: ${cellKey(expected)}`)
  }
  if (expected.metric === 'wall' && (sample.counters || sample.cpu || sample.gc || sample.sampledAllocationBytes !== null)) {
    throw new Error('Wall samples must not include diagnostic instrumentation.')
  }
  if (expected.arm === 'on' && !sample.identity.addonSha256) {
    throw new Error('Native arm did not identify its loaded release addon.')
  }
}

export function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!
}

export function summarize(collection: Collection) {
  if (collection.status !== 'passed') {
    return []
  }
  const groups = new Map<string, Measurement[]>()
  for (const sample of collection.samples.filter(item => item.cell.metric === 'wall')) {
    const key = [sample.cell.caseId, sample.cell.condition, sample.cell.sourceMap].join(':')
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }
  return [...groups.entries()].map(([scenario, samples]) => {
    const arm = (value: 'off' | 'on') => samples.filter(sample => sample.cell.arm === value)
    const stats = (value: 'off' | 'on') => ({
      samples: arm(value).length,
      p50Ms: percentile(arm(value).map(sample => sample.compileMs), 0.5),
      p95Ms: percentile(arm(value).map(sample => sample.compileMs), 0.95),
      p50AddonLoadMs: percentile(arm(value).map(sample => sample.addonLoadMs), 0.5),
      p95AddonLoadMs: percentile(arm(value).map(sample => sample.addonLoadMs), 0.95),
      p50PeakRssBytes: percentile(arm(value).map(sample => sample.peakRssBytes), 0.5),
      p95PeakRssBytes: percentile(arm(value).map(sample => sample.peakRssBytes), 0.95),
    })
    const off = stats('off')
    const on = stats('on')
    const pairedReductions = arm('off').map((sample) => {
      const paired = arm('on').find(other => other.cell.trial === sample.cell.trial)!
      return 100 * (1 - paired.compileMs / sample.compileMs)
    })
    return { scenario, off, on, p50ReductionPercent: 100 * (1 - on.p50Ms / off.p50Ms), pairedReductionP50Percent: percentile(pairedReductions, 0.5) }
  })
}
