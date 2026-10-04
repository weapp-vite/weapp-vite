import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { countCompilerOperation, measureCompilerStage, measureCompilerStageAsync, observeCompiler, observeCompilerAsync } from './internal'

describe('internal compiler observation', () => {
  it('does not read clocks or CPU when observation is disabled', async () => {
    const clock = vi.spyOn(performance, 'now')
    const cpu = vi.spyOn(process, 'cpuUsage')
    try {
      expect(measureCompilerStage('sync', () => 42)).toBe(42)
      expect(await measureCompilerStageAsync('async', async () => 43)).toBe(43)
      countCompilerOperation('babelParseCalls')
      expect(clock).not.toHaveBeenCalled()
      expect(cpu).not.toHaveBeenCalled()
    }
    finally {
      vi.restoreAllMocks()
    }
  })

  it('preserves errors and releases failed observation contexts', () => {
    const failure = new Error('parser failed')
    expect(() => observeCompiler(() => measureCompilerStage('parse', () => {
      throw failure
    }))).toThrow(failure)
    const next = observeCompiler(() => {
      try {
        measureCompilerStage('failed-child', () => {
          throw failure
        })
      }
      catch (error) {
        expect(error).toBe(failure)
      }
      return 1
    })
    expect(next.value).toBe(1)
    expect(next.observation.spans.map(span => [span.name, span.status])).toEqual([['failed-child', 'failed']])
    expect(next.observation.counters).toEqual({})
  })

  it('isolates concurrent async calls and nested observations', async () => {
    let resume!: () => void
    const gate = new Promise<void>((resolve) => {
      resume = resolve
    })
    const first = observeCompilerAsync(() => measureCompilerStageAsync('first', async () => {
      countCompilerOperation('babelParseCalls')
      await gate
      countCompilerOperation('babelParseCalls')
      return 'first'
    }))
    const second = await observeCompilerAsync(() => measureCompilerStageAsync('second', async () => {
      const nested = observeCompiler(() => measureCompilerStage('nested', () => {
        countCompilerOperation('babelGenerateCalls')
      }))
      expect(nested.observation.counters).toEqual({ babelGenerateCalls: 1 })
      countCompilerOperation('babelTraverseCalls')
      resume()
      return 'second'
    }))
    const firstResult = await first
    expect(firstResult.observation.spans.map(span => span.name)).toEqual(['first'])
    expect(firstResult.observation.counters).toEqual({ babelParseCalls: 2 })
    expect(second.observation.spans.map(span => span.name)).toEqual(['second'])
    expect(second.observation.counters).toEqual({ babelTraverseCalls: 1 })
    expect(firstResult.observation.cpu.scope).toBe('process')
  })

  it('keeps nested inclusive wall time separate from unexplained time', async () => {
    const observed = await observeCompilerAsync(() => measureCompilerStageAsync('parent', async () => {
      await Promise.all([
        measureCompilerStageAsync('left', async () => { await Promise.resolve() }),
        measureCompilerStageAsync('right', async () => { await Promise.resolve() }),
      ])
    }))
    const [parent, ...children] = observed.observation.spans
    expect(parent!.parentId).toBeUndefined()
    expect(children.every(child => child.parentId === parent!.id)).toBe(true)
    expect(parent!.selfWallMs).toBeGreaterThanOrEqual(0)
    expect(parent!.selfWallMs).toBeLessThanOrEqual(parent!.wallMs)
    expect(observed.observation.unattributedWallMs + parent!.wallMs).toBeCloseTo(observed.observation.wallMs, 5)
  })
})
