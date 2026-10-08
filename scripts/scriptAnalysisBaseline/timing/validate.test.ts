import { describe, expect, it } from 'vitest'
import { scriptBaselineSources } from '../installHelpers/source'
import { SCRIPT_VARIANTS } from '../types'
import { digest, timingSources } from './testUtils/reports'
import { validateTimingSources } from './validate'

describe('script baseline timing evidence validation', () => {
  it('accepts complete balanced sources and only an ordered prefix for incremental validation', () => {
    const sources = timingSources(42)
    expect(validateTimingSources(sources, 42)).toHaveLength(6)
    expect(validateTimingSources(sources.slice(0, 2), 42, false)).toHaveLength(2)
    expect(() => validateTimingSources(sources.slice(0, 2), 42)).toThrow(/six-source/)
    expect(() => validateTimingSources([sources[1]!], 42, false)).toThrow(/order/)
  })

  it('rejects a shorter balanced run, missing variants, duplicate pairs and altered execution order', () => {
    const short = timingSources(42)
    short[2]!.report.samples.length = 28
    short[2]!.report.requestedIterations = 28
    short[2]!.report.completedPairs = 28
    expect(() => validateTimingSources(short, 42)).toThrow(/rounds/)
    const missing = timingSources()
    Reflect.deleteProperty(missing[0]!.report.samples[0]!.variants, 'optimized')
    expect(() => validateTimingSources(missing, 14)).toThrow(/paired samples/)
    const duplicate = timingSources()
    duplicate[0]!.report.samples[1]!.pair = 0
    expect(() => validateTimingSources(duplicate, 14)).toThrow(/paired samples/)
    const reordered = timingSources()
    reordered[0]!.report.samples[0]!.order.reverse()
    expect(() => validateTimingSources(reordered, 14)).toThrow(/paired samples/)
  })

  it.each(['passed', 'failure', 'cleanup', 'sourcesChanged'] as const)('rejects %s failure regardless of complete samples', (reason) => {
    const sources = timingSources()
    const report = sources[2]!.report
    if (reason === 'passed') {
      report.passed = false
    }
    else if (reason === 'failure') {
      report.failure = 'Worker comparison failed'
    }
    else if (reason === 'cleanup') {
      report.cleanupErrors = ['Exit not confirmed']
    }
    else {
      report.sourcesUnchanged = false
    }
    expect(() => validateTimingSources(sources, 14)).toThrow(/failed|cleanup|identity/)
  })

  it('rejects source drift and matching-but-false worker hook identities', () => {
    const changed = timingSources()
    changed[3]!.report.sourceHashes['pnpm-lock.yaml'] = digest('changed lockfile')
    expect(() => validateTimingSources(changed, 14)).toThrow(/source identity drift/)
    const falseHooks = timingSources()
    for (const variant of SCRIPT_VARIANTS.filter(variant => variant !== 'baseline')) {
      falseHooks[0]!.report.startup[variant].sourceHashes[scriptBaselineSources[0]] = digest('wrong original source')
    }
    expect(() => validateTimingSources(falseHooks, 14)).toThrow(/hook identity/)
    const baselineHook = timingSources()
    baselineHook[0]!.report.startup.baseline.sourceHashes = { ...baselineHook[0]!.report.startup.control.sourceHashes }
    expect(() => validateTimingSources(baselineHook, 14)).toThrow(/hook identity/)
  })

  it.each(['activeCompiles', 'pendingTransfers', 'astAlreadyConsumed'])('rejects nonzero %s and missing optimized lifecycle evidence', (metric) => {
    const sources = timingSources()
    sources[0]!.report.samples[0]!.variants.optimized.metrics[metric] = 1
    expect(() => validateTimingSources(sources, 14)).toThrow(/AST ownership/)
    sources[0]!.report.samples[0]!.variants.optimized.metrics = {}
    expect(() => validateTimingSources(sources, 14)).toThrow(/AST ownership/)
  })

  it('rejects optimized work in the loader control and a failed observation hidden by passed=true', () => {
    const control = timingSources()
    control[0]!.report.checks.control.metrics.astReuse = 1
    expect(() => validateTimingSources(control, 14)).toThrow(/control performed optimized/)
    const failed = timingSources()
    failed[0]!.report.samples[0]!.variants.optimized.failed = true
    expect(() => validateTimingSources(failed, 14)).toThrow(/failed observation/)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1])('rejects invalid wall time %s', (value) => {
    const sources = timingSources()
    sources[0]!.report.samples[0]!.variants.optimized.wallMs = value
    expect(() => validateTimingSources(sources, 14)).toThrow(/invalid wall/)
  })

  it('rejects invalid CPU, RSS and nonnumeric or negative metric counters', () => {
    const sources = timingSources()
    const sample = sources[0]!.report.samples[0]!.variants.optimized
    sample.cpuMicroseconds = -1
    expect(() => validateTimingSources(sources, 14)).toThrow(/CPU or RSS/)
    sample.cpuMicroseconds = 1
    sample.rssAfterBytes = Number.POSITIVE_INFINITY
    expect(() => validateTimingSources(sources, 14)).toThrow(/CPU or RSS/)
    sample.rssAfterBytes = 1000
    sample.metrics.astReuse = -1
    expect(() => validateTimingSources(sources, 14)).toThrow(/invalid metrics/)
  })

  it('checks every output and input against initial baseline evidence', () => {
    const output = timingSources()
    output[0]!.report.samples[0]!.variants.optimized.outputSha256 = digest('changed map or warning')
    expect(() => validateTimingSources(output, 14)).toThrow(/input\/output mismatch/)
    const input = timingSources()
    input[0]!.report.checks['ast-reuse'].inputSha256 = digest('changed options')
    expect(() => validateTimingSources(input, 14)).toThrow(/input\/output mismatch/)
    const filename = timingSources()
    filename[0]!.report.scenario.filename = 'src/another-page.vue'
    expect(() => validateTimingSources(filename, 14)).toThrow(/fixed scenario/)
  })

  it.each(['input', 'output'] as const)('rejects %s drift across batches even when all seven variants agree within a batch', (kind) => {
    const sources = timingSources()
    const report = sources[3]!.report
    const hash = digest(`different-${kind}`)
    if (kind === 'input') {
      report.scenario.inputSha256 = hash
    }
    const observations = [...Object.values(report.checks), ...report.samples.flatMap(sample => Object.values(sample.variants))]
    for (const value of observations) {
      if (kind === 'input') {
        value.inputSha256 = hash
      }
      else {
        value.outputSha256 = hash
      }
    }
    expect(() => validateTimingSources(sources, 14)).toThrow(/between batches/)
  })

  it('rejects environment drift, malformed timestamps and overlapping collection intervals', () => {
    const drift = timingSources()
    drift[1]!.report.environment.node = 'v26.0.0'
    expect(() => validateTimingSources(drift, 14)).toThrow(/environment drift/)
    const invalid = timingSources()
    invalid[0]!.report.environment.finishedAt = 'invalid timestamp'
    expect(() => validateTimingSources(invalid, 14)).toThrow(/collection interval/)
    const overlap = timingSources()
    overlap[1]!.report.environment.startedAt = overlap[0]!.report.environment.startedAt
    expect(() => validateTimingSources(overlap, 14)).toThrow(/overlapping/)
  })
})
