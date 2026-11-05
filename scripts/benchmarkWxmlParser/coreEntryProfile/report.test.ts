import type { EntryFixture, EntryProfileSample, EntrySteadyResult } from './types'
import { describe, expect, it } from 'vitest'
import { probeClock } from '../clock'
import { entryProfileIntegrity, entryProfileSummary } from './report'

const fixtures = [{ id: 'fixture', profileId: 'xml', bytes: 8 }] as EntryFixture[]
function measurement() {
  const samples: EntryProfileSample[] = (['scan', 'parse'] as const).flatMap(operation => (['baseline', 'root', 'core'] as const).map(arm => ({ operation, arm, round: 0, moduleMs: 2, initializationMs: 1, initializationKind: arm === 'core' ? 'compile-dialect-and-create-parser' : 'benchmark-adapter-binding', firstCallMs: 4, documents: 1, bytes: 8, parsers: 1, clock: probeClock(), memory: { beforeImport: { heapUsed: 10 }, afterImport: { heapUsed: 11 }, afterInitialization: { heapUsed: 12 }, afterFirstCall: { heapUsed: 13 }, peakRssBytes: 20 } })))
  const steady: EntrySteadyResult = {
    samples: (['scan', 'parse'] as const).flatMap(operation => (['warmup', 'primary'] as const).flatMap(phase => (['root', 'core'] as const).map(arm => ({ operation, phase, arm, round: 0, durationMs: 4, iterations: phase === 'warmup' ? 1 : 2, documents: 1, bytes: 8 })))),
    calibrations: (['scan', 'parse'] as const).map(operation => ({ operation, iterations: 2, candidateResolved: true, probes: [{ arm: 'baseline', iterations: 1, durationMs: 25 }, { arm: 'candidate', iterations: 2, durationMs: 4 }] })),
    parity: [{ fixture: 'fixture', scan: true, parse: true }],
    errors: [],
  }
  return { samples, steady, errors: [] }
}

describe('isolated entry evidence', () => {
  it('preserves three real entry arms and separates cold and bound steady metrics', () => {
    const result = measurement()
    expect(entryProfileIntegrity(result, fixtures, 1, 1)).toEqual([])
    const summary = entryProfileSummary(result.samples, result.steady)
    expect(summary.cold).toHaveLength(6)
    expect(summary.steady).toHaveLength(4)
    expect(summary.cold.every(row => row.moduleMs.p50 === 2 && row.initializationMs.p50 === 1 && row.firstCallMs.p50 === 4)).toBe(true)
    expect(summary.cold.filter(row => row.arm === 'baseline').every(row => row.initializationKind === 'benchmark-adapter-binding')).toBe(true)
  })

  it.each([
    ['missing baseline arm', (result: ReturnType<typeof measurement>) => { result.samples = result.samples.filter(row => row.arm !== 'baseline') }],
    ['wrong source workload', (result: ReturnType<typeof measurement>) => { result.samples[0]!.bytes++ }],
    ['missing memory evidence', (result: ReturnType<typeof measurement>) => { result.samples[0]!.memory = null }],
    ['missing memory stage', (result: ReturnType<typeof measurement>) => { result.samples[0]!.memory!.afterImport = {} }],
    ['mislabelled baseline initialization', (result: ReturnType<typeof measurement>) => { result.samples[0]!.initializationKind = 'compile-dialect-and-create-parser' }],
    ['unresolved cold clock', (result: ReturnType<typeof measurement>) => { result.samples[0]!.clock.positiveChanges = 0 }],
    ['missing steady operation', (result: ReturnType<typeof measurement>) => { result.steady.samples = result.steady.samples.filter(row => row.operation !== 'scan') }],
    ['unequal steady batches', (result: ReturnType<typeof measurement>) => { result.steady.samples.at(-1)!.iterations++ }],
    ['failed full-metadata parity', (result: ReturnType<typeof measurement>) => { result.steady.parity[0]!.parse = false }],
  ] as const)('rejects %s', (_name, mutate) => {
    const result = measurement()
    mutate(result)
    expect(entryProfileIntegrity(result, fixtures, 1, 1).length).toBeGreaterThan(0)
  })
})
