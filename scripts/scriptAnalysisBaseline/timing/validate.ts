import type { ScriptVariant } from '../types'
import type { TimingCorpus, TimingObservation, TimingReport, TimingSource } from './types'
import { isDeepStrictEqual } from 'node:util'
import { balancedOrders } from '../../nativeBindingAnalysis/orders'
import { scriptBaselineSources } from '../installHelpers/source'
import { SCRIPT_VARIANTS } from '../types'
import { timingPlan } from './types'

const filenames: Record<TimingCorpus, string> = {
  'sfc-pressure': 'src/pages/batch-pressure/index.vue',
  'sfc-retail': 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue',
  'sfc-wevu': 'apps/wevu-vue-demo/src/pages/index/index.vue',
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
}

function hashes(value: unknown): value is Record<string, string> {
  return record(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, digest]) => key.length > 0
    && !key.startsWith('/') && !key.includes('\\') && !key.includes(':') && !key.split('/').includes('..') && hash(digest))
}

function variants(value: unknown): value is Record<ScriptVariant, unknown> {
  return record(value) && isDeepStrictEqual(Object.keys(value).sort(), [...SCRIPT_VARIANTS].sort())
}

function observation(value: unknown, variant: ScriptVariant, input: string, output: string, label: string): TimingObservation {
  ensure(record(value) && value.failed === false && value.inputSha256 === input && value.outputSha256 === output, `${label}: failed observation or input/output mismatch`)
  ensure(typeof value.wallMs === 'number' && Number.isFinite(value.wallMs) && value.wallMs > 0
    && Number.isSafeInteger(value.cpuMicroseconds) && Number(value.cpuMicroseconds) >= 0
    && Number.isSafeInteger(value.rssAfterBytes) && Number(value.rssAfterBytes) > 0, `${label}: invalid wall, CPU or RSS value`)
  ensure(record(value.metrics) && Object.values(value.metrics).every(metric => Number.isSafeInteger(metric) && Number(metric) >= 0), `${label}: invalid metrics`)
  const metrics = value.metrics
  const idle = ['activeCompiles', 'pendingTransfers', 'astAlreadyConsumed'].every(key => variant === 'baseline'
    ? metrics[key] === undefined || metrics[key] === 0
    : metrics[key] === 0)
  ensure(idle, `${label}: unfinished or repeated AST ownership`)
  if (variant === 'baseline' || variant === 'control') {
    ensure(Object.values(metrics).every(metric => metric === 0), `${label}: baseline/control performed optimized work`)
  }
  return value as unknown as TimingObservation
}

function validateReport(value: unknown, entry: ReturnType<typeof timingPlan>[number]): TimingReport {
  const label = entry.id
  ensure(record(value) && value.schemaVersion === 1 && value.passed === true && value.failure === undefined, `${label}: source run failed`)
  ensure(Array.isArray(value.cleanupErrors) && value.cleanupErrors.length === 0, `${label}: cleanup failure`)
  ensure(value.sourcesUnchanged === true && hashes(value.sourceHashes), `${label}: missing or changed source identity`)
  const sourceHashes = value.sourceHashes
  ensure(scriptBaselineSources.every(file => hash(sourceHashes[file])), `${label}: missing original hook source identity`)
  ensure(variants(value.startup), `${label}: missing seven-worker startup evidence`)
  const expectedHooks = Object.fromEntries(scriptBaselineSources.map(file => [file, sourceHashes[file]]))
  for (const variant of SCRIPT_VARIANTS) {
    const ready = value.startup[variant]
    ensure(record(ready) && isDeepStrictEqual(ready.sourceHashes, variant === 'baseline' ? {} : expectedHooks), `${label}/${variant}: hook identity differs from original sources`)
  }
  ensure(record(value.scenario) && value.scenario.id === entry.scenario && value.scenario.filename === filenames[entry.scenario]
    && hash(value.scenario.inputSha256) && hash(value.scenario.sourceSha256), `${label}: invalid fixed scenario identity`)
  ensure(value.batch === entry.batch && value.requestedIterations === entry.iterations && value.completedPairs === entry.iterations
    && value.orderPeriod === 14 && value.warmupRounds === 14 && Array.isArray(value.samples) && value.samples.length === entry.iterations, `${label}: incomplete batch, warmup or timing rounds`)
  ensure(variants(value.checks) && record(value.checks.baseline) && hash(value.checks.baseline.outputSha256), `${label}: missing baseline correctness evidence`)
  const output = value.checks.baseline.outputSha256
  for (const variant of SCRIPT_VARIANTS) {
    observation(value.checks[variant], variant, value.scenario.inputSha256, output, `${label}/check/${variant}`)
  }
  const orders = balancedOrders(SCRIPT_VARIANTS)
  for (const [index, sample] of value.samples.entries()) {
    ensure(record(sample) && sample.pair === index && isDeepStrictEqual(sample.order, orders[index % orders.length])
      && variants(sample.variants), `${label}: missing, duplicate or reordered paired samples`)
    for (const variant of SCRIPT_VARIANTS) {
      observation(sample.variants[variant], variant, value.scenario.inputSha256, output, `${label}/pair-${index}/${variant}`)
    }
  }
  ensure(record(value.environment), `${label}: missing environment`)
  const environment = value.environment
  ensure(['node', 'platform', 'arch'].every(key => typeof environment[key] === 'string' && environment[key])
    && Number.isSafeInteger(environment.cpus) && Number(environment.cpus) > 0, `${label}: invalid environment`)
  ensure(typeof environment.startedAt === 'string' && typeof environment.finishedAt === 'string'
    && Number.isFinite(Date.parse(environment.startedAt)) && Number.isFinite(Date.parse(environment.finishedAt))
    && Date.parse(environment.finishedAt) >= Date.parse(environment.startedAt), `${label}: invalid collection interval`)
  ensure(['initialLoad', 'finalLoad'].every(key => Array.isArray(environment[key]) && environment[key].length === 3
    && environment[key].every((load: unknown) => typeof load === 'number' && Number.isFinite(load) && load >= 0)), `${label}: invalid load observations`)
  return value as unknown as TimingReport
}

/** 按固定六次调用验证未知 JSON；增量模式只接受有序前缀，最终模式要求完整两批。 */
export function validateTimingSources(sources: TimingSource[], iterations: number, complete = true) {
  const plan = timingPlan(iterations)
  ensure(sources.length > 0 && (complete ? sources.length === plan.length : sources.length <= plan.length), 'Incomplete six-source timing evidence')
  const validated = sources.map((source, index) => {
    const entry = plan[index]!
    ensure(source.id === entry.id && hash(source.sha256), 'Unexpected report order, ownership or digest')
    return { ...source, report: validateReport(source.report, entry), plan: entry }
  })
  const first = validated[0]!.report
  const corpora = new Map<TimingCorpus, TimingReport>()
  for (const [index, source] of validated.entries()) {
    const report = source.report
    ensure(isDeepStrictEqual(report.sourceHashes, first.sourceHashes), `${source.id}: source identity drift between runs`)
    ensure(['node', 'platform', 'arch', 'cpus'].every(key => report.environment[key as keyof typeof report.environment] === first.environment[key as keyof typeof first.environment]), `${source.id}: environment drift between runs`)
    if (index > 0) {
      ensure(Date.parse(report.environment.startedAt) >= Date.parse(validated[index - 1]!.report.environment.finishedAt), `${source.id}: overlapping collection intervals`)
    }
    const reference = corpora.get(report.scenario.id)
    if (reference) {
      ensure(isDeepStrictEqual(report.scenario, reference.scenario)
        && report.checks.baseline.outputSha256 === reference.checks.baseline.outputSha256, `${source.id}: corpus input or output drift between batches`)
    }
    else {
      corpora.set(report.scenario.id, report)
    }
  }
  return validated
}
