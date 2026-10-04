import type { BindingAnalysis, BindingInput } from './source'
import { describe, expect, it, vi } from 'vitest'
import { replayWithFallback, replayWithJs, replayWithNative } from './replay'

const input: BindingInput = { expression: 'row.name + format(value)', locals: ['row'], safeCallNames: ['format'] }
const value: BindingAnalysis = {
  dependencies: [{ root: 'value', path: 'value', mode: 'exact-path' }],
  snapshotFallback: false,
}

describe('experimental binding replay', () => {
  it('deduplicates complete requests once per batch and restores original order', () => {
    const other = { ...input, expression: 'other' }
    const analyzeBindingExpressionsNative = vi.fn(() => [value, null])
    const result = replayWithNative([input, other, input], { analyzeBindingExpressionsNative }, ['Math'])
    expect(result.results).toEqual([value, null, value])
    expect(result.nativeCalls).toBe(1)
    expect(result.uniqueInputs).toBe(2)
    expect(analyzeBindingExpressionsNative).toHaveBeenCalledExactlyOnceWith([input, other], ['Math'])
  })

  it('keeps locals and safe-call changes in the key', () => {
    const requests = [input, { ...input, locals: [] }, { ...input, safeCallNames: [] }]
    const analyze = vi.fn(() => value)
    expect(replayWithJs(requests, analyze, true)).toEqual([value, value, value])
    expect(analyze).toHaveBeenCalledTimes(3)
    const binding = { analyzeBindingExpressionsNative: vi.fn(() => [value, value, value]) }
    expect(replayWithNative(requests, binding, []).uniqueInputs).toBe(3)
  })

  it('distinguishes a cached parse failure from an empty success', () => {
    const analyze = vi.fn(() => null)
    expect(replayWithJs([input, input], analyze, true)).toEqual([null, null])
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(replayWithNative([input], { analyzeBindingExpressionsNative: () => [{ dependencies: [], snapshotFallback: false }] }, []).results).toEqual([{ dependencies: [], snapshotFallback: false }])
  })

  it.each([
    () => { throw new Error('native failed') },
    () => [],
    () => [undefined] as unknown as Array<BindingAnalysis | null>,
    () => [{ ...value, dependencies: [{ root: 'x', mode: 'bad' }] }] as unknown as BindingAnalysis[],
  ])('falls back the entire batch after an invalid native result', (analyzeBindingExpressionsNative) => {
    const analyze = vi.fn(() => value)
    const result = replayWithFallback([input, input], { analyzeBindingExpressionsNative }, [], analyze)
    expect(result.fallback).toBeTruthy()
    expect(result.results).toEqual([value, value])
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('does not cross the native boundary for an empty batch', () => {
    const analyzeBindingExpressionsNative = vi.fn(() => [])
    expect(replayWithNative([], { analyzeBindingExpressionsNative }, [])).toEqual({ results: [], nativeCalls: 0, uniqueInputs: 0 })
    expect(analyzeBindingExpressionsNative).not.toHaveBeenCalled()
  })
})
