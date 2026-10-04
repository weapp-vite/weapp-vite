import { PerformanceObserver } from 'node:perf_hooks'
import { describe, expect, it, vi } from 'vitest'
import { observeBatchGc, summarizeBatchGc } from './gc'

function entry(startTime: number, duration: number, entryType: 'gc' | 'measure' = 'gc') {
  return { name: 'gc', entryType, startTime, duration, detail: { kind: 1, flags: 0 } }
}

describe('batch GC observation', () => {
  it('attributes only process GC entries within the batch window', () => {
    const report = summarizeBatchGc([entry(1, 3), entry(12, 2), entry(15, 1), entry(30, 1), entry(14, 1, 'measure')], 10, 20)
    expect(report.count).toBe(2)
    expect(report.durationMs).toBe(3)
    expect(report.entries).toEqual([
      { startMs: 2, durationMs: 2, kind: 1, flags: 0 },
      { startMs: 5, durationMs: 1, kind: 1, flags: 0 },
    ])
    expect(report.attribution).toContain('not attributable')
    expect(report.scope).toContain('baseline and observed')
  })

  it('closes its observer when the diagnostic operation fails', async () => {
    const disconnect = vi.spyOn(PerformanceObserver.prototype, 'disconnect')
    const failure = new Error('compile failed')
    try {
      await expect(observeBatchGc(async () => {
        throw failure
      })).rejects.toBe(failure)
      expect(disconnect).toHaveBeenCalledTimes(PerformanceObserver.supportedEntryTypes.includes('gc') ? 1 : 0)
    }
    finally {
      disconnect.mockRestore()
    }
  })
})
