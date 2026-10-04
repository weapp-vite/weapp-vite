import type { PerformanceEntry } from 'node:perf_hooks'
import { performance, PerformanceObserver } from 'node:perf_hooks'
import { setImmediate } from 'node:timers/promises'

type GcPerformanceEntry = Pick<PerformanceEntry, 'entryType' | 'startTime' | 'duration'> & {
  detail?: { kind?: number, flags?: number }
}

export interface BatchGcObservation {
  status: 'available' | 'unavailable'
  scope: 'process-wide diagnostic batch, including warmup and both baseline and observed calls'
  attribution: 'not attributable to a compiler stage or one side of a pair; durations are GC performance entries, not CPU time'
  count: number | null
  durationMs: number | null
  entries: Array<{ startMs: number, durationMs: number, kind: number | null, flags: number | null }>
}

/** 仅保留本批开始后、结束前触发的 GC；没有记录不代表没有分配或没有 GC 成本。 */
export function summarizeBatchGc(entries: readonly GcPerformanceEntry[], startedAt: number, endedAt: number): BatchGcObservation {
  const selected = entries.filter(entry => entry.entryType === 'gc' && entry.startTime >= startedAt && entry.startTime <= endedAt)
  const samples = selected.map((entry) => {
    const detail = entry.detail
    return { startMs: entry.startTime - startedAt, durationMs: entry.duration, kind: detail?.kind ?? null, flags: detail?.flags ?? null }
  })
  return {
    status: 'available',
    scope: 'process-wide diagnostic batch, including warmup and both baseline and observed calls',
    attribution: 'not attributable to a compiler stage or one side of a pair; durations are GC performance entries, not CPU time',
    count: samples.length,
    durationMs: samples.reduce((total, entry) => total + entry.durationMs, 0),
    entries: samples,
  }
}

/** 不触发强制 GC；异步观测结束后排空事件并关闭本批创建的 observer。 */
export async function observeBatchGc<T>(run: () => Promise<T>) {
  if (!PerformanceObserver.supportedEntryTypes.includes('gc')) {
    const value = await run()
    const gc: BatchGcObservation = { ...summarizeBatchGc([], 0, 0), status: 'unavailable', count: null, durationMs: null }
    return { value, gc }
  }
  const entries: PerformanceEntry[] = []
  const observer = new PerformanceObserver(list => entries.push(...list.getEntries()))
  observer.observe({ entryTypes: ['gc'] })
  const startedAt = performance.now()
  try {
    const value = await run()
    const endedAt = performance.now()
    await setImmediate()
    entries.push(...observer.takeRecords())
    return { value, gc: summarizeBatchGc(entries, startedAt, endedAt) }
  }
  finally {
    observer.disconnect()
  }
}
