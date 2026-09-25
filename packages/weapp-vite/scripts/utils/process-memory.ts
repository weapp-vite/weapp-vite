import { createPeakRssSampler as createSerialPeakRssSampler } from '../../../../scripts/benchmarkTemplatesPerformance/peakRssSampler'
import { sampleProcessTreeRssBytes } from '../../../../scripts/benchmarkTemplatesPerformance/processTreeRss'

export interface MemorySummary {
  max: number | null
  mean: number | null
  min: number | null
  samples: number[]
}

/** 与模板基准共用有界串行探针；停止时不新建采样进程。 */
export function createPeakRssSampler(rootPid: number | undefined) {
  return createSerialPeakRssSampler(async () => typeof rootPid === 'number' ? sampleProcessTreeRssBytes(rootPid) : null)
}

export function summarizeOptionalMemory(values: Array<number | null | undefined>): MemorySummary {
  const samples = values.filter((value): value is number => Number.isFinite(value))
  const sorted = [...samples].sort((a, b) => a - b)
  const total = samples.reduce((sum, value) => sum + value, 0)
  return {
    max: sorted.at(-1) ?? null,
    mean: samples.length ? total / samples.length : null,
    min: sorted[0] ?? null,
    samples,
  }
}

export function formatMemoryMiB(value: number | null | undefined) {
  return typeof value === 'number'
    ? `${(value / 1024 / 1024).toFixed(1)} MiB`
    : '-'
}
