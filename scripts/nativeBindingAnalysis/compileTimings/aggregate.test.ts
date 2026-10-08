import type { CompilerReport } from './types'
import { describe, expect, it } from 'vitest'
import { aggregateCompileTimings } from './aggregate'
import { hash, reportSources } from './testUtils/reports'

describe('complete compiler timing evidence', () => {
  it('recomputes per-batch quantiles and paired savings without treating a difference of medians as paired improvement', () => {
    const sources = reportSources()
    Object.assign(sources[1]!.report as object, { measured: { 'control-js': { wallMs: { p50: -999, p95: -999 } } } })
    const report = aggregateCompileTimings(sources, 10)
    const group = report.groups[0]!
    expect(report.passed).toBe(true)
    expect(report.productionAcceptance).toBe('not-evaluated')
    expect(report.correctness.scenarios).toHaveLength(13)
    expect(report.sources[1]).toEqual({ id: sources[1]!.id, reportPath: sources[1]!.reportPath, sha256: sources[1]!.sha256 })
    expect(report.groups.map(group => [group.batch, group.corpus])).toEqual([[1, 'pressure'], [1, 'retail'], [1, 'wevu'], [2, 'pressure'], [2, 'retail'], [2, 'wevu']])
    expect(group.variants['control-js']!.wallMs).toEqual({ p50: 6, p95: 100 })
    expect(group.variants['planned-native']!.wallMs).toEqual({ p50: 4, p95: 9 })
    expect(group.variants['planned-native']!.cpuMicroseconds).toEqual({ p50: 104, p95: 109 })
    expect(group.variants['planned-native']!.rssAfterBytes).toEqual({ p50: 1004, p95: 1009 })
    const paired = group.pairedWall.find(pair => pair.reference === 'control-js' && pair.candidate === 'planned-native')!
    expect(paired.savedMs).toEqual({ p50: 1, p95: 99 })
    expect(paired.pairs[1]).toEqual({ pair: 1, savedMs: 99, savedPercent: 99 })
  })

  it.each(['failed', 'cleanup', 'changed-during-run'] as const)('rejects %s source evidence even when timing arrays are complete', (failure) => {
    const sources = reportSources()
    const report = sources[3]!.report as CompilerReport
    if (failure === 'failed') {
      report.passed = false
    }
    else if (failure === 'cleanup') {
      report.cleanupErrors.push('Exit was not confirmed')
    }
    else {
      report.sourcesUnchanged = false
    }
    expect(() => aggregateCompileTimings(sources, 10)).toThrow(/failed|cleanup|identity/)
  })

  it('rejects a shorter but internally balanced run instead of accepting its declared round count', () => {
    const sources = reportSources(40)
    const report = sources[2]!.report as CompilerReport
    report.samples = report.samples.slice(0, 30)
    report.requestedIterations = 30
    report.completedPairs = 30
    expect(() => aggregateCompileTimings(sources, 40)).toThrow(/rounds/)
    expect(() => aggregateCompileTimings(reportSources().slice(0, -1), 10)).toThrow(/seven-run/)
  })

  it.each(['compiler', 'tool', 'worker'] as const)('rejects cross-run %s identity drift even when every source claims unchanged inputs', (target) => {
    const sources = reportSources()
    const report = sources[4]!.report as CompilerReport
    if (target === 'compiler') {
      report.compiler.compilerSourceTreeSha256 = hash('other compiler')
    }
    else if (target === 'tool') {
      report.toolSources['scripts/nativeBindingAnalysis/compile.ts'] = hash('other tool')
    }
    else {
      report.startup['planned-native'].sourceHashes['packages-runtime/wevu-compiler/src/index.ts'] = hash('other worker')
    }
    expect(() => aggregateCompileTimings(sources, 10)).toThrow(/identity drift/)
  })

  it('rejects missing correctness cases and changed timing options instead of comparing different inputs', () => {
    const missing = reportSources()
    ;(missing[0]!.report as CompilerReport).checks.pop()
    expect(() => aggregateCompileTimings(missing, 10)).toThrow(/correctness scenarios/)
    const changed = reportSources()
    ;(changed[1]!.report as CompilerReport).checks[0]!.options.isPage = false
    expect(() => aggregateCompileTimings(changed, 10)).toThrow(/corpus, options/)
  })

  it('rejects broken pair ordering and native fallback within otherwise successful samples', () => {
    const reordered = reportSources()
    ;(reordered[1]!.report as CompilerReport).samples[1]!.pair = 0
    expect(() => aggregateCompileTimings(reordered, 10)).toThrow(/paired samples/)
    const fallback = reportSources()
    ;(fallback[1]!.report as CompilerReport).samples[0]!.variants['planned-native'].metrics.fallbackCount = 1
    expect(() => aggregateCompileTimings(fallback, 10)).toThrow(/native sample/)
  })
})
