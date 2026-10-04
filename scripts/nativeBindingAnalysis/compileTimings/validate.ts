import type { CompilerReport, ReportSource, TimingPlan } from './types'
import { isDeepStrictEqual } from 'node:util'
import { COMPILE_VARIANTS } from '../compileProtocol'
import { balancedOrders } from '../orders'
import { compileTimingPlan, CORRECTNESS_SCENARIOS } from './types'

function ensure(condition: unknown, label: string): asserts condition {
  if (!condition) {
    throw new Error(label)
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
}

function hashMap(value: unknown, allowEmpty = false): value is Record<string, string> {
  return object(value) && (allowEmpty || Object.keys(value).length > 0)
    && Object.entries(value).every(([key, value]) => !key.startsWith('/') && !key.includes('\\') && !key.split('/').includes('..') && !key.includes(':') && hash(value))
}

function fiveVariants(value: unknown) {
  return object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...COMPILE_VARIANTS].sort())
}

function emptyWork(value: unknown) {
  return object(value) && ['pendingInputs', 'pendingRecords', 'activeTemplates'].every(key => value[key] === undefined || value[key] === 0)
}

/** 先校验来源契约，再缩窄 JSON 类型；失败、缺样与身份漂移均不能进入统计。 */
function validateReport(value: unknown, plan: TimingPlan): CompilerReport {
  const fail = (reason: string) => `${plan.id}: ${reason}`
  ensure(object(value), fail('invalid report'))
  ensure(value.schemaVersion === 1 && value.passed === true && !value.failure, fail('source run failed'))
  ensure(Array.isArray(value.cleanupErrors) && value.cleanupErrors.length === 0, fail('process cleanup did not succeed'))
  ensure(value.sourcesUnchanged === true && value.compilerInputsUnchanged === true, fail('source identity changed during collection'))
  ensure(object(value.compiler) && Number.isSafeInteger(value.compiler.compilerSourceFiles) && Number(value.compiler.compilerSourceFiles) > 0
    && ['compilerSourceTreeSha256', 'lockfileSha256', 'bindingSha256'].every(key => hash((value.compiler as Record<string, unknown>)[key])), fail('missing compiler identity'))
  ensure(hashMap(value.toolSources), fail('missing diagnostic source identity'))
  ensure(fiveVariants(value.startup), fail('missing five-worker startup evidence'))
  for (const variant of COMPILE_VARIANTS) {
    const ready = (value.startup as Record<string, unknown>)[variant]
    ensure(object(ready) && ready.id === 0 && ready.kind === 'ready' && ready.bindingSha256 === value.compiler.bindingSha256
      && hashMap(ready.sourceHashes, variant === 'baseline'), fail('worker identity does not match controller'))
  }
  ensure(object(value.environment), fail('missing environment'))
  const environment = value.environment
  ensure(['node', 'platform', 'arch'].every(key => typeof environment[key] === 'string' && environment[key])
    && Number.isSafeInteger(environment.cpus) && Number(environment.cpus) > 0, fail('invalid environment'))
  const start = typeof environment.startedAt === 'string' ? Date.parse(environment.startedAt) : Number.NaN
  const end = typeof environment.finishedAt === 'string' ? Date.parse(environment.finishedAt) : Number.NaN
  ensure(Number.isFinite(start) && Number.isFinite(end) && end >= start, fail('invalid collection interval'))
  ensure(['initialLoad', 'finalLoad'].every(key => Array.isArray(environment[key])
    && environment[key].length === 3 && environment[key].every((load: unknown) => typeof load === 'number' && Number.isFinite(load) && load >= 0)), fail('invalid load observations'))
  ensure(Array.isArray(value.checks), fail('missing correctness checks'))
  const expectedScenarios: readonly string[] = plan.scenario === 'all' ? CORRECTNESS_SCENARIOS : [plan.scenario]
  ensure(value.checks.length === expectedScenarios.length && new Set(value.checks.map(check => object(check) ? check.scenario : undefined)).size === expectedScenarios.length, fail('missing or duplicate correctness scenarios'))
  for (const check of value.checks) {
    ensure(object(check) && typeof check.scenario === 'string' && expectedScenarios.includes(check.scenario)
      && typeof check.filename === 'string' && hash(check.sourceSha256) && object(check.options)
      && fiveVariants(check.variants), fail('invalid correctness evidence'))
    const variants = check.variants as Record<string, unknown>
    const baseline = variants.baseline
    ensure(object(baseline) && hash(baseline.outputSha256), fail('missing baseline output identity'))
    for (const variant of COMPILE_VARIANTS) {
      const result = variants[variant]
      ensure(object(result) && result.outputSha256 === baseline.outputSha256 && result.failed === (check.scenario === 'invalid-template')
        && emptyWork(result.metrics), fail('non-equivalent correctness output or unfinished work'))
    }
  }
  const count = plan.iterations
  ensure(value.requestedIterations === count && value.completedPairs === count && Array.isArray(value.samples) && value.samples.length === count, fail('missing or unexpected timing rounds'))
  ensure(value.orderPeriod === 10 && value.warmupRounds === (count ? 10 : 0) && value.fullyBalanced === (count > 0), fail('incomplete warmup or balanced cycle'))
  const orders = balancedOrders(COMPILE_VARIANTS)
  for (const [index, sample] of value.samples.entries()) {
    ensure(object(sample) && sample.pair === index && isDeepStrictEqual(sample.order, orders[index % orders.length])
      && fiveVariants(sample.variants), fail('missing, duplicate or reordered paired samples'))
    for (const variant of COMPILE_VARIANTS) {
      const measurement = (sample.variants as Record<string, unknown>)[variant]
      ensure(object(measurement) && measurement.failed === false && emptyWork(measurement.metrics), fail('failed sample or unfinished work'))
      ensure(['wallMs', 'cpuMicroseconds', 'rssAfterBytes'].every(key => typeof measurement[key] === 'number'
        && Number.isFinite(measurement[key]) && (key === 'cpuMicroseconds' ? measurement[key] >= 0 : measurement[key] > 0)), fail('invalid timing, CPU or RSS value'))
      if (variant === 'planned-native') {
        const metrics = measurement.metrics as Record<string, unknown>
        ensure(typeof metrics.nativeCalls === 'number' && metrics.nativeCalls > 0 && metrics.fallbackCount === 0, fail('native sample was not exercised cleanly'))
      }
    }
  }
  return value as unknown as CompilerReport
}

/** 支持逐个来源验证，及时停止；最终聚合必须具备全部七份报告。 */
export function validateCompileSources(sources: ReportSource[], iterations: number, complete = true) {
  const plan = compileTimingPlan(iterations)
  ensure(sources.length > 0 && (complete ? sources.length === plan.length : sources.length <= plan.length), 'Incomplete seven-run evidence')
  const validated = sources.map((source, index) => {
    const entry = plan[index]!
    ensure(source.id === entry.id && source.reportPath === `${entry.id}/report.json` && hash(source.sha256), 'Unexpected source report ownership or digest')
    return { ...source, report: validateReport(source.report, entry), plan: entry }
  })
  const reference = validated[0]!.report
  for (const [index, source] of validated.entries()) {
    const report = source.report
    ensure(isDeepStrictEqual(report.compiler, reference.compiler) && isDeepStrictEqual(report.toolSources, reference.toolSources)
      && isDeepStrictEqual(report.startup, reference.startup), `${source.id}: compiler, diagnostic source or worker identity drift`)
    ensure(['node', 'platform', 'arch', 'cpus'].every(key => report.environment[key as keyof typeof report.environment] === reference.environment[key as keyof typeof reference.environment]), `${source.id}: environment drift`)
    if (index > 0) {
      ensure(Date.parse(report.environment.startedAt) >= Date.parse(validated[index - 1]!.report.environment.finishedAt), `${source.id}: overlapping collection intervals`)
      const expected = reference.checks.find(check => check.scenario === source.plan.scenario)
      ensure(expected && isDeepStrictEqual(report.checks[0], expected), `${source.id}: corpus, options, output or coverage drift`)
    }
  }
  return validated
}
