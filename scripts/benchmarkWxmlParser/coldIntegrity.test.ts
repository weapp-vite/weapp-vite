import type { Fixture, MeasurementResult, Sample } from './types'
import { describe, expect, it } from 'vitest'
import { BENCHMARK_ORIGIN, ISOLATION_HEADERS } from './browserDocument'
import { cohorts } from './cohorts'
import { assertBrowserColdIntegrity, assertNodeColdIntegrity } from './coldIntegrity'
import { RAW_XML_PARSE_OPTIONS } from './parserContract'
import { NODE_STACK_ARGUMENT, STACK_SIZE_KB } from './runtime'
import { percentile, summarize } from './statistics'

const fixtures: Fixture[] = [
  { id: 'shared', sha256: 'shared', bytes: 7, source: '<view/>', origins: ['shared.wxml'], platform: 'weapp', cohort: 'shared', size: 'small', features: ['interpolation'] },
  { id: 'wxml', sha256: 'wxml', bytes: 20, source: '<wxs>source</wxs>', origins: ['script.wxml'], platform: 'weapp', cohort: 'wxml', size: 'medium', features: ['script'] },
  { id: 'stress', sha256: 'stress', bytes: 7, source: '<view/>', origins: [], platform: 'weapp', cohort: 'shared', size: 'small', synthetic: true, pressureId: 'stress-depth-32' },
]

function cells(id: string, quick: boolean) {
  const samples: Sample[] = []
  const rounds = quick ? 1 : 40
  for (const [cohort, files] of cohorts(fixtures)) {
    for (let round = 0; round < rounds; round++) {
      for (const arm of round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const) {
        samples.push({ operation: id, cohort, round, arm, phase: 'primary', durationMs: arm === 'baseline' ? 1 : 2, iterations: 1, documents: files.length, bytes: files.reduce((total, fixture) => total + fixture.bytes, 0) })
      }
    }
  }
  const summaries = cohorts(fixtures).map(([cohort]) => summarize(samples, { id, comparable: false, run: () => undefined }, cohort, rounds))
  return { samples, summaries, errors: [] }
}

function nodeReport(quick = true): Parameters<typeof assertNodeColdIntegrity>[0] {
  const base = cells('cold-first-parse', quick)
  const samples = base.samples.map(sample => ({ ...sample, importMs: sample.round + 1, peakRssBytes: sample.round + 100, memoryBefore: { rss: 100 }, memoryAfter: { rss: 100 }, execArgv: [NODE_STACK_ARGUMENT] }))
  return {
    ...base,
    samples,
    boundary: 'test',
    runtime: { stackSizeKb: STACK_SIZE_KB, nodeArgs: [NODE_STACK_ARGUMENT] },
    baselineParseOptions: RAW_XML_PARSE_OPTIONS,
    loading: cohorts(fixtures).flatMap(([cohort]) => (['baseline', 'candidate'] as const).map((arm) => {
      const rows = samples.filter(row => row.cohort === cohort && row.arm === arm)
      return { cohort, arm, importP50Ms: percentile(rows.map(row => row.importMs), 0.5), importP95Ms: percentile(rows.map(row => row.importMs), 0.95), peakRssP50Bytes: percentile(rows.map(row => row.peakRssBytes), 0.5), peakRssP95Bytes: percentile(rows.map(row => row.peakRssBytes), 0.95) }
    })),
  }
}

function browserReport(quick = true): Parameters<typeof assertBrowserColdIntegrity>[0] {
  const base = cells('browser-first-parse', quick)
  return {
    ...base,
    boundary: 'test',
    parity: [],
    samples: base.samples.map(sample => ({
      ...sample,
      clock: { source: 'performance.now', reads: 10000, positiveChanges: 1, minimumPositiveDeltaMs: 0.001, maximumPositiveDeltaMs: 0.001, timeOrigin: 1, crossOriginIsolated: true, secureContext: true },
      document: { url: `${BENCHMARK_ORIGIN}/cold`, responseHeaders: { ...ISOLATION_HEADERS }, crossOriginIsolated: true },
    })),
  }
}

describe('external cold workload integrity', () => {
  it.each([true, false])('accepts complete informational Node and Chromium cold matrices, quick=%s', (quick) => {
    expect(() => assertNodeColdIntegrity(nodeReport(quick), fixtures, quick)).not.toThrow()
    expect(() => assertBrowserColdIntegrity(browserReport(quick), fixtures, quick)).not.toThrow()
    const node = nodeReport(quick)
    expect(node.summaries.at(-1)!.cohort).toBe('real-all')
    expect(node.samples.filter(row => row.cohort === 'real-all')).toHaveLength((quick ? 1 : 40) * 2)
    expect(node.samples.filter(row => row.cohort === 'real-all').every(row => row.documents === 2 && row.bytes === 27)).toBe(true)
  })

  it('preserves valid zero clock readings without imposing a cold performance gate', () => {
    const report = browserReport()
    report.samples.forEach((sample) => {
      sample.durationMs = 0
    })
    report.summaries = cohorts(fixtures).map(([cohort]) => summarize(report.samples, { id: 'browser-first-parse', comparable: false, run: () => undefined }, cohort, 1))
    expect(() => assertBrowserColdIntegrity(report, fixtures, true)).not.toThrow()
  })

  function variant<T extends Pick<MeasurementResult, 'samples' | 'summaries'>>(name: string, make: () => T, assert: (report: T, fixtures: Fixture[], quick: boolean) => void) {
    const assertCold = (report: T) => assert(report, fixtures, true)
    it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(`rejects invalid ${name} first-call timing %s`, (duration) => {
      const report = make()
      report.samples[0]!.durationMs = duration
      expect(() => assertCold(report)).toThrow('timing')
    })

    it(`rejects missing/duplicate ${name} samples and either arm`, () => {
      const missing = make()
      missing.samples.pop()
      expect(() => assertCold(missing)).toThrow('samples')
      const duplicate = make()
      duplicate.samples.push(duplicate.samples[0]!)
      expect(() => assertCold(duplicate)).toThrow('samples')
      const arm = make()
      arm.samples[1]!.arm = 'baseline'
      expect(() => assertCold(arm)).toThrow('paired')
    })

    it(`rejects an omitted ${name} cohort, changed workload and forged summary`, () => {
      const omitted = make()
      omitted.samples = omitted.samples.filter(sample => sample.cohort !== 'stress-depth-32') as typeof omitted.samples
      omitted.summaries = omitted.summaries.filter(summary => summary.cohort !== 'stress-depth-32')
      expect(() => assertCold(omitted)).toThrow('cells')
      const changed = make()
      changed.samples[0]!.documents++
      expect(() => assertCold(changed)).toThrow('workload')
      const summary = make()
      summary.summaries[0]!.baseline.p50Ms = Number.NaN
      expect(() => assertCold(summary)).toThrow('summary')
      const historical = make()
      historical.samples = historical.samples.filter(sample => sample.cohort !== 'real-all') as typeof historical.samples
      historical.summaries = historical.summaries.filter(summary => summary.cohort !== 'real-all')
      expect(() => assertCold(historical)).toThrow('cells')
    })

    it(`rejects additional ${name} confirmations and cannot replace missing primary evidence`, () => {
      const extra = make()
      extra.samples.push({ ...extra.samples[0]!, phase: 'confirmation' })
      expect(() => assertCold(extra)).toThrow('confirmation')
      const replaced = make()
      replaced.samples[0]!.phase = 'confirmation'
      expect(() => assertCold(replaced)).toThrow('samples')
    })
  }
  variant('Node', nodeReport, assertNodeColdIntegrity)
  variant('Chromium', browserReport, assertBrowserColdIntegrity)

  it('requires all Node loading cells and recomputes their statistics from raw samples', () => {
    const missing = nodeReport()
    missing.loading.pop()
    expect(() => assertNodeColdIntegrity(missing, fixtures, true)).toThrow('loading')
    const duplicate = nodeReport()
    duplicate.loading[1] = duplicate.loading[0]!
    expect(() => assertNodeColdIntegrity(duplicate, fixtures, true)).toThrow('loading')
    const forged = nodeReport()
    forged.loading[0]!.importP50Ms++
    expect(() => assertNodeColdIntegrity(forged, fixtures, true)).toThrow('loading')
    const aggregate = nodeReport()
    aggregate.loading = aggregate.loading.filter(row => row.cohort !== 'real-all')
    expect(() => assertNodeColdIntegrity(aggregate, fixtures, true)).toThrow('loading')
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const sample = nodeReport()
      sample.samples[0]!.importMs = value
      expect(() => assertNodeColdIntegrity(sample, fixtures, true)).toThrow('loading')
      const memory = nodeReport()
      memory.samples[0]!.peakRssBytes = value
      expect(() => assertNodeColdIntegrity(memory, fixtures, true)).toThrow('loading')
    }
  })

  it('checks the Node runtime and each Chromium clock/document independently', () => {
    const node = nodeReport()
    node.samples[0]!.execArgv = []
    expect(() => assertNodeColdIntegrity(node, fixtures, true)).toThrow('stack')
    const browser = browserReport()
    browser.samples[0]!.clock.minimumPositiveDeltaMs = Number.NaN
    expect(() => assertBrowserColdIntegrity(browser, fixtures, true)).toThrow('clock')
    const document = browserReport()
    document.samples[0]!.document.responseHeaders['cross-origin-embedder-policy'] = 'unsafe-none'
    expect(() => assertBrowserColdIntegrity(document, fixtures, true)).toThrow('document')
  })
})
