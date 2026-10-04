import { describe, expect, it } from 'vitest'
import { aggregateScriptTimings } from './aggregate'
import { timingSources } from './testUtils/reports'

describe('script baseline timing aggregation', () => {
  it('preserves six separate groups and every original pair while computing savings within each pair', () => {
    const sources = timingSources(42)
    const summary = aggregateScriptTimings(sources, 42)
    expect(summary.passed).toBe(true)
    expect(summary.productionAcceptance).toBe('not-evaluated')
    expect(summary.sources).toEqual(sources.map(({ id, sha256 }) => ({ id, sha256 })))
    expect(summary.groups.map(group => [group.batch, group.corpus])).toEqual([
      [1, 'sfc-pressure'],
      [1, 'sfc-retail'],
      [1, 'sfc-wevu'],
      [2, 'sfc-pressure'],
      [2, 'sfc-retail'],
      [2, 'sfc-wevu'],
    ])
    for (const [index, group] of summary.groups.entries()) {
      expect(group.samples).toEqual(sources[index]!.report.samples)
      expect(group.pairs).toBe(42)
      expect(group.variants.control!.wallMs).toEqual({ p50: 8, p95: 100 })
      expect(group.variants.optimized!.wallMs).toEqual({ p50: 6, p95: 13 })
      expect(group.variants.optimized!.cpuMicroseconds).toEqual({ p50: 120, p95: 139 })
      expect(group.variants.optimized!.rssAfterBytes).toEqual({ p50: 1020, p95: 1039 })
      expect(group.pairedWall.map(pair => [pair.reference, pair.candidate])).toEqual([
        ['baseline', 'control'],
        ['control', 'ast-reuse'],
        ['control', 'props-no-scope'],
        ['control', 'page-meta-gate'],
        ['control', 'reserved-props-gate'],
        ['control', 'optimized'],
      ])
      const paired = group.pairedWall.find(pair => pair.candidate === 'optimized')!
      expect(paired.pairs).toHaveLength(42)
      expect(paired.savedMs).toEqual({ p50: 1, p95: 99 })
      expect(paired.savedMs.p50).not.toBe(group.variants.control!.wallMs.p50 - group.variants.optimized!.wallMs.p50)
      expect(paired.savedPercent.p95).toBe(99)
      expect(paired.pairs[1]).toEqual({ pair: 1, savedMs: 99, savedPercent: 99 })
      // 收益分位数属于另一分布，不是候选实现的坏尾延迟或其比值。
      expect(paired.savedPercent.p95).not.toBe((1 - group.variants.optimized!.wallMs.p95 / group.variants.control!.wallMs.p95) * 100)
    }
  })

  it('rejects finite observations whose paired percentage overflows instead of serializing Infinity as null', () => {
    const sources = timingSources()
    sources[0]!.report.samples[0]!.variants.control.wallMs = Number.MIN_VALUE
    sources[0]!.report.samples[0]!.variants.optimized.wallMs = Number.MAX_VALUE
    expect(() => aggregateScriptTimings(sources, 14)).toThrow(/non-finite paired/)
  })
})
