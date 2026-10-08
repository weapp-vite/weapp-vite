import type { BindingAnalysis, BindingInput, BindingSyntaxSummary } from './source'
import { describe, expect, it, vi } from 'vitest'
import { replayWithFallback, replayWithJs, replayWithJsSummary, replayWithNative } from './replay'

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

  it('specializes one syntax summary per expression and deduplicates complete requests', () => {
    const summary: BindingSyntaxSummary = Object.freeze({
      dependencies: Object.freeze(['row', 'format', 'value'].map(root => Object.freeze({ root, path: root, mode: 'exact-path' as const }))),
      directCallNames: Object.freeze(['format']),
      unconditionalSnapshotFallback: false,
    })
    const summarize = vi.fn(() => summary)
    const requests = [input, { ...input, locals: ['format'] }, { ...input, safeCallNames: [] }, input]
    const result = replayWithJsSummary(requests, summarize)
    expect(summarize).toHaveBeenCalledExactlyOnceWith(input.expression)
    expect(result.map(analysis => analysis?.dependencies.map(dependency => dependency.root))).toEqual([
      ['format', 'value'],
      ['row', 'value'],
      ['format', 'value'],
      ['format', 'value'],
    ])
    expect(result.map(analysis => analysis?.snapshotFallback)).toEqual([false, false, true, false])
    expect(result[0]).toBe(result[3])
    result[0]!.dependencies[1]!.path = 'changed'
    expect(result[1]!.dependencies[1]!.path).toBe('value')
    expect(summary.dependencies[2]!.path).toBe('value')
  })

  it('keys syntax summaries by the exact expression and resets both caches per batch', () => {
    const summarize = vi.fn((): BindingSyntaxSummary => ({ dependencies: [], directCallNames: [], unconditionalSnapshotFallback: false }))
    const requests = [input, { ...input, expression: ` ${input.expression}` }, input]
    const first = replayWithJsSummary(requests, summarize)
    const second = replayWithJsSummary(requests, summarize)
    expect(summarize).toHaveBeenCalledTimes(4)
    expect(summarize.mock.calls).toEqual([[input.expression], [` ${input.expression}`], [input.expression], [` ${input.expression}`]])
    expect(first).toEqual(second)
    expect(first[0]).not.toBe(second[0])
    expect(replayWithJsSummary([], summarize)).toEqual([])
    expect(summarize).toHaveBeenCalledTimes(4)
  })

  it('caches null summaries separately from empty results with and without fallback', () => {
    const summarize = vi.fn((expression: string): BindingSyntaxSummary | null => expression === 'value +'
      ? null
      : { dependencies: [], directCallNames: [], unconditionalSnapshotFallback: expression === '() => 1' })
    const requests = ['value +', '42', '() => 1', 'value +'].map(expression => ({ ...input, expression }))
    requests.push({ ...requests[0]!, locals: [] })
    expect(replayWithJsSummary(requests, summarize)).toEqual([
      null,
      { dependencies: [], snapshotFallback: false },
      { dependencies: [], snapshotFallback: true },
      null,
      null,
    ])
    expect(summarize).toHaveBeenCalledTimes(3)
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
