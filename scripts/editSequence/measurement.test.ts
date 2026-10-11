import type { SequenceStepResult } from './measurement'
import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { evaluateResourceTrend, SequenceMeasurements } from './measurement'
import { assertResourceSequence, summarizeResourceSequence } from './resourceSequence'

describe('edit sequence observation gates', () => {
  it('settles queued timers while retaining long-lived timers in the resource growth gate', async () => {
    // 独立 Node 进程保留真实事件循环和资源计数，避免 Vitest 自身超时计时器污染样本。
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
      import { observeProcessResources, sampleProcessResources } from ${JSON.stringify(new URL('./measurement.ts', import.meta.url).href)};
      const baseline = (await sampleProcessResources()).resources.Timeout ?? 0;
      const timeouts = [];
      let completed = 0;
      let retained;
      let retainedFired = false;
      let synchronous;
      try {
        for (let step = 0; step < 15; step++) {
          if (step === 7) retained = setTimeout(() => { retainedFired = true; }, 60_000);
          setTimeout(() => { completed++; }, 0);
          if (step === 0) synchronous = observeProcessResources().resources.Timeout ?? 0;
          const sample = await sampleProcessResources();
          if (completed !== step + 1) throw new Error('Queued timer did not finish before sampling');
          timeouts.push(sample.resources.Timeout ?? 0);
        }
        process.stdout.write(JSON.stringify({ baseline, synchronous, timeouts, completed, retainedFired, retainedRef: retained.hasRef() }));
      }
      finally {
        clearTimeout(retained);
      }
    `], { timeout: 10_000, windowsHide: true })
    const observed = JSON.parse(stdout) as { baseline: number, synchronous: number, timeouts: number[], completed: number, retainedFired: boolean, retainedRef: boolean }
    expect(observed).toMatchObject({ completed: 15, retainedFired: false, retainedRef: true })
    expect(observed.synchronous).toBe(observed.baseline + 1)
    expect(observed.timeouts).toEqual([...Array.from<number>({ length: 7 }).fill(observed.baseline), ...Array.from<number>({ length: 8 }).fill(observed.baseline + 1)])

    const steps: SequenceStepResult[] = observed.timeouts.map((timeoutCount, step) => ({
      step,
      label: `step-${step}`,
      status: 'passed',
      measurement: {
        elapsedMs: 1,
        process: { memory: { rss: 100, heapUsed: 50, heapTotal: 100, external: 0, arrayBuffers: 0 }, resources: { Timeout: timeoutCount }, processListeners: {} },
        processTree: { rssBytes: 100, processCount: 1, observationMs: 1 },
        gc: { count: 1, durationMs: 1, forced: true, observationMs: 1 },
        session: { watchers: 0, engines: 1 },
        build: { loadCalls: 1, loadedModules: [], transformCalls: 1, transformedModules: [], publications: 1, outputFiles: [], outputBytes: 1, patches: 1, patchBytes: 1 },
      },
    }))
    expect(() => assertResourceSequence(summarizeResourceSequence(steps))).toThrow('Resource trend resource:Timeout: growth')
  })

  it('keeps repeated work, affected modules and emitted bytes separate', () => {
    const observer = new SequenceMeasurements('/fixture')
    observer.load('/fixture/changed.js')
    observer.load('/fixture/changed.js')
    observer.transform('/fixture/changed.js')
    observer.publish([{ type: 'asset', fileName: 'page.wxss', source: '你好' }])
    expect(observer.snapshot()).toMatchObject({
      loadCalls: 2,
      loadedModules: ['<fixture>/changed.js'],
      transformCalls: 1,
      transformedModules: ['<fixture>/changed.js'],
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

  it('detects retained growth even after the latest windows become flat', () => {
    expect(evaluateResourceTrend([10, 10, 20, 20, 30, 30, 30, 30, 30, 30], { warmup: 0, window: 2, maxGrowth: 5 }))
      .toMatchObject({ status: 'growth', growth: 20, recentGrowth: 0 })
    expect(evaluateResourceTrend([10, 10, 40, 40, 10, 10, 10, 10, 10, 10], { warmup: 0, window: 2, maxGrowth: 5 }))
      .toMatchObject({ status: 'stable', growth: 0 })
  })

  it('detects a retained plateau within the default fourteen-edit observation', () => {
    const samples = [99, 99, 99, ...Array.from<number>({ length: 4 }).fill(10), ...Array.from<number>({ length: 8 }).fill(30)]
    expect(evaluateResourceTrend(samples, { warmup: 3, window: 4, maxGrowth: 5 }))
      .toMatchObject({ status: 'growth', medians: [10, 30, 30], growth: 20 })
    expect(evaluateResourceTrend(samples.map(value => value === 30 ? 12 : value), { warmup: 3, window: 4, maxGrowth: 5 }))
      .toMatchObject({ status: 'stable', medians: [10, 12, 12], growth: 2 })
  })
})
