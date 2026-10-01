import { describe, expect, it } from 'vitest'
import { evaluateResourceTrend, SequenceMeasurements } from './measurement'

describe('edit sequence observation gates', () => {
  it('keeps repeated work, affected modules and emitted bytes separate', () => {
    const observer = new SequenceMeasurements('/fixture')
    observer.load('/fixture/changed.js')
    observer.load('/fixture/changed.js')
    observer.transform('/fixture/changed.js')
    observer.publish([{ type: 'asset', fileName: 'page.wxss', source: '你好' }])
    expect(observer.snapshot()).toMatchObject({
      loadCalls: 2,
      loadedModules: ['changed.js'],
      transformCalls: 1,
      transformedModules: ['changed.js'],
      publications: 1,
      outputFiles: ['page.wxss'],
      outputBytes: 6,
    })
    observer.reset()
    expect(observer.snapshot()).toMatchObject({ loadCalls: 0, transformCalls: 0, publications: 0, outputBytes: 0 })
  })

  it('ignores warmup and isolated RSS spikes while retaining raw window statistics', () => {
    const samples = [900, 800, 100, 100, 900, 100, 100, 100, 100, 100, 100]
    const result = evaluateResourceTrend(samples, { warmup: 2, window: 3, maxGrowth: 50 })
    expect(result).toMatchObject({ status: 'stable', medians: [100, 100, 100] })
  })

  it('detects sustained retained resources and insufficient observation explicitly', () => {
    expect(evaluateResourceTrend([0, 1, 2, 3, 4, 5, 6, 7, 8], { warmup: 0, window: 3, maxGrowth: 2 }))
      .toMatchObject({ status: 'growth', medians: [1, 4, 7], growth: 6 })
    expect(evaluateResourceTrend([1, 2], { warmup: 2, window: 3, maxGrowth: 0 }))
      .toMatchObject({ status: 'unknown', medians: [] })
  })

  it('rejects invalid samples and unbounded window settings', () => {
    expect(() => evaluateResourceTrend([Number.NaN], { warmup: 0, window: 1, maxGrowth: 0 })).toThrow()
    expect(() => evaluateResourceTrend([], { warmup: 0, window: 0, maxGrowth: 0 })).toThrow()
  })
})
