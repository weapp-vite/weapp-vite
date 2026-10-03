import type { AnalysisSample } from './results'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createAnalysisControl, instrumentTemplateParser } from './control'
import { assertAnalysisSamples, summarizeAnalysisSamples } from './results'

function samples(): AnalysisSample[] {
  return [0, 1, 2].flatMap(trial => (['shared', 'duplicate-control'] as const).flatMap(variant => (['cold', 'warm'] as const).flatMap(condition => (['timing', 'allocation'] as const).map(metric => ({
    variant,
    condition,
    metric,
    trial,
    outputHash: 'same-complete-compiler-output',
    parseCount: variant === 'shared' ? 3 : 6,
    compileMs: [15, 10, 20][trial]!,
    processPeakRssBytes: 1024,
    retainedHeapDeltaBytes: -8,
    ...(metric === 'allocation' ? { sampledAllocationBytes: 4096 } : {}),
  })))))
}

describe('template analysis measurement integrity', () => {
  it('compares complete output and reports separate timing/allocation medians', () => {
    expect(summarizeAnalysisSamples(samples())).toEqual(expect.arrayContaining([
      expect.objectContaining({ variant: 'shared', condition: 'cold', compileMedianMs: 15, sampledAllocationMedianBytes: 4096, retainedHeapDeltaMedianBytes: -8 }),
    ]))
  })

  it('rejects changed compiler output, incomplete pairs and duplicate trial cells', () => {
    const changed = samples()
    changed[0]!.outputHash = 'different'
    expect(() => assertAnalysisSamples(changed)).toThrow('outputs differ')
    expect(() => assertAnalysisSamples(samples().slice(1))).toThrow('parse evidence')
    const duplicated = samples()
    duplicated[0] = duplicated[8]!
    expect(() => assertAnalysisSamples(duplicated)).toThrow('parse evidence')
  })

  it('rejects missing instrumentation and unusable allocation or timing', () => {
    const uninstrumented = samples()
    uninstrumented[0]!.parseCount = 0
    expect(() => assertAnalysisSamples(uninstrumented)).toThrow('parse evidence')
    const allocation = samples()
    allocation[1]!.sampledAllocationBytes = Number.NaN
    expect(() => assertAnalysisSamples(allocation)).toThrow('Allocation profiling')
    const timing = samples()
    timing[0]!.compileMs = Number.POSITIVE_INFINITY
    expect(() => assertAnalysisSamples(timing)).toThrow('not finite')
  })

  it('keeps the control attached to the real owner and fails after parser boundary changes', async () => {
    const source = await readFile(new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/componentSources.ts', import.meta.url), 'utf8')
    const control = createAnalysisControl(source)
    expect(control).toContain('collectVueTemplateTags(template,')
    expect(() => createAnalysisControl(source.replace('analyzeVueTemplateTags(template)', 'changedOwner(template)'))).toThrow('owner changed')
    expect(() => instrumentTemplateParser('changed parser')).toThrow('boundary changed')
  })
})
