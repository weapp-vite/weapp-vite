import type { Launch } from './collection'
import type { Fixture, Mode, Side, WorkerResult } from './types'
import { fileURLToPath } from 'node:url'
import { deserialize, serialize } from 'node:v8'
import { describe, expect, it } from 'vitest'
import { summarizeBatchGc } from '../astMigrationProfile/gc'
import { collect, timingSummary } from './collection'
import { createFixtures } from './fixtures'
import { parseOptions } from './index'
import { assertEquivalent, errorEvidence, outcomeHash, validateWorker } from './outcome'
import { PAIRS } from './types'

const fixtures: Fixture[] = [{ id: 'no-default-export', source: '<script>const n = 1</script>', filename: 'src/page.vue', options: { sourceMap: true } }]

function worker(mode: Mode, side: Side): WorkerResult {
  const outcome = { status: 'success' as const, warnings: [], value: { script: 'result', scriptMap: { version: 3, mappings: 'AAAA', sourcesContent: ['source'] }, optional: undefined } }
  const active = side === 'on' ? 1 : 0
  return { mode, side, samples: [{
    id: 'no-default-export',
    outcome,
    outputSha256: outcomeHash(outcome),
    wallMs: active ? 8 : 10,
    rssBytes: 100,
    ...(mode === 'timing'
      ? {}
      : { diagnostic: {
          compiler: { wallMs: 10, cpu: { userMs: 6, systemMs: 2, scope: 'process' as const }, spans: [], counters: { babelParseCalls: 3 }, unattributedWallMs: 10, coverage: {
            durations: 'inclusive wall time; nested spans must not be added' as const,
            cpu: 'process-wide CPU during the root call; not phase CPU or exclusive thread CPU' as const,
            counters: 'compiler Babel wrapper calls only; Vue, Oxc and native internal parses are not counted' as const,
          } },
          native: { bindingCalls: active, batchCalls: active, inputScripts: active, inputBytes: active * 20, cacheHits: 0, fallbacks: mode === 'fault' ? 1 : 0, loadFailures: 0 },
          compilerBatch: { calls: active, scripts: active },
          gc: { ...summarizeBatchGc([], 0, 1), scope: 'one independent observed compiler call; warmup and paired timing excluded' as const },
        } }),
  }] }
}

describe('production compiler batch collection contract', () => {
  it('uses a stable tagged digest across V8 transport and preserves exceptional values', () => {
    class ScriptMap {
      version = 3
      mappings = 'AAAA'
      sourcesContent = ['source']
    }
    const result = worker('diagnostic', 'off')
    const outcome = result.samples[0]!.outcome
    outcome.value = { scriptMap: new ScriptMap(), counts: [1, 2.5], undefined, negativeZero: -0, nan: Number.NaN, holes: Array.from({ length: 1 }) }
    expect(outcomeHash(outcome)).toBe(outcomeHash((deserialize(serialize(result)) as WorkerResult).samples[0]!.outcome))
    expect(outcomeHash({ status: 'success', warnings: [], value: -0 })).not.toBe(outcomeHash({ status: 'success', warnings: [], value: 0 }))
    expect(outcomeHash({ status: 'success', warnings: [], value: { optional: undefined } })).not.toBe(outcomeHash({ status: 'success', warnings: [], value: {} }))
    const sparse: unknown[] = []
    sparse.length = 1
    expect(outcomeHash({ status: 'success', warnings: [], value: sparse })).not.toBe(outcomeHash({ status: 'success', warnings: [], value: [undefined] }))
  })

  it('keeps registered-component and escaped-source boundaries in the fixed corpus', async () => {
    const corpus = await createFixtures(fileURLToPath(new URL('../../', import.meta.url)))
    expect(corpus.map(fixture => fixture.id)).toEqual(['wevu-home', 'retail-detail', 'define-options', 'dual-script', 'no-default-export', 'imported-components', 'options-api-components', 'escaped-string-components', 'invalid-template', 'invalid-script'])
    const escaped = corpus.find(fixture => fixture.id === 'escaped-string-components')!
    expect(escaped.source).toContain('native/\\uD800')
    expect(escaped.source).not.toContain('\uD800')
    expect(escaped).toMatchObject({ autoComponents: true, expectParseFallback: true })
  })

  it('collects exactly forty alternating pairs and keeps independent diagnostics out of timing', async () => {
    const calls: Array<{ mode: Mode, side: Side }> = []
    const launch: Launch = async (mode, side) => {
      calls.push({ mode, side })
      return worker(mode, side)
    }
    const state = await collect(fixtures, true, launch, async () => {})
    expect(state.pairs).toHaveLength(PAIRS)
    expect(state.diagnostics).toHaveLength(3)
    expect(calls.slice(0, 3)).toEqual([{ mode: 'diagnostic', side: 'off' }, { mode: 'diagnostic', side: 'on' }, { mode: 'fault', side: 'on' }])
    expect(calls.slice(3).map(call => call.side)).toEqual(Array.from({ length: 20 }, () => ['off', 'on', 'on', 'off']).flat())
    expect(calls.filter(call => call.mode === 'timing')).toHaveLength(80)
    expect(state.pairs[0]!.off.samples[0]).not.toHaveProperty('outcome')
    expect(timingSummary(state, fixtures)[0]!.wallMs).toMatchObject({ count: 40, baselineMedianMs: 10, currentMedianMs: 8, changePercent: -20 })
  })

  it('check mode records correctness diagnostics without collecting performance pairs', async () => {
    const state = await collect(fixtures, false, async (mode, side) => worker(mode, side), async () => {})
    expect(state.pairs).toHaveLength(0)
    expect(state.diagnostics).toHaveLength(3)
    expect(parseOptions(['--output=result', '--native-path=binding.node']).mode).toBe('check')
    expect(() => parseOptions(['--output=result', '--native-path=binding.node', '--pairs=2'])).toThrow('fixed')
    expect(() => parseOptions(['--output=result', '--native-path=binding.node', '--mode=full', '--mode=check'])).toThrow()
  })

  it.each(['missing-batch', 'repeated-batch', 'fallback', 'load-failure', 'map', 'warnings', 'missing-result'])('rejects %s evidence before starting timed pairs', async (mutation) => {
    let calls = 0
    await expect(collect(fixtures, true, async (mode, side) => {
      calls++
      const value = worker(mode, side)
      if (side === 'on') {
        const sample = value.samples[0]!
        if (mutation === 'missing-batch') {
          sample.diagnostic!.compilerBatch.calls = 0
        }
        if (mutation === 'repeated-batch') {
          sample.diagnostic!.compilerBatch.calls = 2
        }
        if (mutation === 'fallback') {
          sample.diagnostic!.native.fallbacks = 1
        }
        if (mutation === 'load-failure') {
          sample.diagnostic!.native.loadFailures = 1
        }
        if (mutation === 'map') {
          sample.outcome.value = { script: 'result', scriptMap: { mappings: 'BBBB' } }
        }
        if (mutation === 'warnings') {
          sample.outcome.warnings = ['changed warning']
        }
        sample.outputSha256 = outcomeHash(sample.outcome)
        if (mutation === 'missing-result') {
          value.samples = []
        }
      }
      return value
    }, async () => {})).rejects.toThrow()
    expect(calls).toBe(2)
  })

  it('does not accept instrumented measurements or a retry in the single-call fallback case', () => {
    const instrumented = worker('diagnostic', 'on')
    instrumented.mode = 'timing'
    expect(() => validateWorker(instrumented, fixtures)).toThrow('instrumentation')
    const retry = worker('fault', 'on')
    retry.samples[0]!.diagnostic!.native.batchCalls = 2
    expect(() => validateWorker(retry, fixtures)).toThrow('exactly once')
  })

  it('retains error metadata and undefined fields while excluding only stack text', () => {
    const cause = new Error('underlying')
    const error = new Error('invalid template', { cause })
    Object.defineProperty(error, 'loc', { value: { line: 2, column: 5 }, enumerable: false })
    Object.assign(error, { code: 'WV2001', diagnostics: [{ severity: 'error', filename: 'src/page.vue' }] })
    const first = errorEvidence(error)
    error.stack = 'different process stack'
    expect(errorEvidence(error)).toEqual(first)
    expect(first).toMatchObject({ prototype: { name: 'Error' }, fields: { message: 'invalid template', loc: { fields: { line: 2, column: 5 } }, code: 'WV2001', cause: { fields: { message: 'underlying' } }, diagnostics: { fields: { 0: { fields: { severity: 'error', filename: 'src/page.vue' } } } } } })
    expect(() => assertEquivalent({ status: 'success', value: { optional: undefined }, warnings: [] }, { status: 'success', value: {}, warnings: [] }, 'undefined')).toThrow('mismatch')
    const changed = errorEvidence(Object.assign(new Error('invalid template'), { code: 'different' }))
    expect(() => assertEquivalent({ status: 'error', error: first, warnings: [] }, { status: 'error', error: changed, warnings: [] }, 'errors')).toThrow('mismatch')
  })
})
