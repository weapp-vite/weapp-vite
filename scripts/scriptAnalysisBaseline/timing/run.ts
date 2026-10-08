import type { ScriptVariant } from '../types'
import type { ScriptTimingSample, ScriptTimingScenario } from './protocol'
import type { TimingCorpus, TimingObservation, TimingReport } from './types'
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus, loadavg } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { balancedOrders } from '../../nativeBindingAnalysis/orders'
import { sanitizeScriptDiagnostic } from '../diagnostics'
import { scriptDigest, scriptRepository, scriptSourceIdentity } from '../identity'
import { scriptScenarios } from '../scenarios'
import { SCRIPT_VARIANTS } from '../types'
import { createScriptTimingProcess } from './process'
import { timingPlan } from './types'

export interface TimingRunOptions { scenario: TimingCorpus, batch: number, iterations: number, output: string }

function numericMetrics(sample: ScriptTimingSample) {
  const metrics: Record<string, number> = {}
  for (const [key, value] of Object.entries(sample.metrics)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid diagnostic counter: ${key}`)
    }
    metrics[key] = value
  }
  if (metrics.activeCompiles || metrics.pendingTransfers || metrics.astAlreadyConsumed) {
    throw new Error('Unfinished or repeated AST ownership')
  }
  return metrics
}

/** 每组拥有独立进程；先校验，再预热，最后按固定顺序逐次测量与对照。 */
export async function runScriptTiming(options: TimingRunOptions) {
  if (!timingPlan(options.iterations).some(item => item.scenario === options.scenario && item.batch === options.batch)) {
    throw new Error('Unexpected script timing corpus or batch')
  }
  const output = path.resolve(options.output)
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourceHashes = await scriptSourceIdentity()
  const scenario = (await scriptScenarios()).find(item => item.kind === 'sfc' && item.id === options.scenario) as ScriptTimingScenario | undefined
  if (!scenario) {
    throw new Error('Timing scenario is missing')
  }
  const inputSha256 = scriptDigest(JSON.stringify(scenario))
  const orders = balancedOrders(SCRIPT_VARIANTS)
  const children = new Map<ScriptVariant, Awaited<ReturnType<typeof createScriptTimingProcess>>>()
  const startup: Partial<TimingReport['startup']> = {}
  const checks: Partial<TimingReport['checks']> = {}
  const samples: TimingReport['samples'] = []
  const cleanupErrors: string[] = []
  const startedAt = new Date().toISOString()
  const initialLoad = loadavg()
  let warmupRounds = 0
  let failure: string | undefined
  let expected: string | undefined
  const scrub = (value: unknown) => String(sanitizeScriptDiagnostic(String(value), [output, scriptRepository]))
  const invoke = async (variant: ScriptVariant): Promise<TimingObservation> => {
    const sample = await children.get(variant)!.compile(scenario)
    const rejectSample = async (reason: string): Promise<never> => {
      const diagnostic = sanitizeScriptDiagnostic({ reason, expectedInputSha256: inputSha256, expectedOutput: expected, actual: sample }, [output, scriptRepository])
      await writeFile(path.join(output, `${variant}-mismatch.json`), JSON.stringify(diagnostic), { flag: 'wx' })
      throw new Error(`${variant}: ${reason}`)
    }
    if (sample.failed || sample.inputSha256 !== inputSha256) {
      return rejectSample('compilation failed or worker input differs')
    }
    if (expected === undefined && variant === 'baseline') {
      expected = sample.output
    }
    if (expected !== sample.output) {
      return rejectSample('complete output/map/warning/error mismatch')
    }
    const metrics = numericMetrics(sample)
    if (variant !== 'baseline' && ['activeCompiles', 'pendingTransfers', 'astAlreadyConsumed'].some(key => metrics[key] !== 0)) {
      throw new Error(`${variant}: missing ownership evidence`)
    }
    for (const [key, value] of Object.entries({ wallMs: sample.wallMs, cpuMicroseconds: sample.cpuMicroseconds, rssAfterBytes: sample.rssAfterBytes })) {
      if (!Number.isFinite(value) || (key === 'cpuMicroseconds' ? value < 0 : value <= 0)) {
        throw new Error(`${variant}: invalid ${key}`)
      }
    }
    if ((variant === 'control' || variant === 'baseline') && Object.values(metrics).some(value => value !== 0)) {
      throw new Error(`${variant}: control unexpectedly performed optimized analysis`)
    }
    return { outputSha256: scriptDigest(sample.output), inputSha256, failed: false, metrics, wallMs: sample.wallMs, cpuMicroseconds: sample.cpuMicroseconds, rssAfterBytes: sample.rssAfterBytes }
  }
  try {
    for (const variant of SCRIPT_VARIANTS) {
      const child = await createScriptTimingProcess(variant)
      children.set(variant, child)
      startup[variant] = { sourceHashes: child.ready.sourceHashes }
      if (variant === 'baseline' ? Object.keys(child.ready.sourceHashes).length !== 0 : !isDeepStrictEqual(child.ready.sourceHashes, startup.control?.sourceHashes)) {
        throw new Error(`${variant}: loader sources differ from the control`)
      }
    }
    for (const variant of SCRIPT_VARIANTS) {
      checks[variant] = await invoke(variant)
    }
    for (const order of orders) {
      for (const variant of order) {
        await invoke(variant)
      }
      warmupRounds++
    }
    for (let pair = 0; pair < options.iterations; pair++) {
      const order = orders[pair % orders.length]!
      const variants: Partial<Record<ScriptVariant, TimingObservation>> = {}
      for (const variant of order) {
        variants[variant] = await invoke(variant)
      }
      samples.push({ pair, order, variants: variants as Record<ScriptVariant, TimingObservation> })
    }
  }
  catch (error) {
    failure = scrub(error)
  }
  finally {
    for (const child of [...children.values()].reverse()) {
      try {
        await child.close()
      }
      catch (error) {
        cleanupErrors.push(scrub(error))
      }
    }
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await scriptSourceIdentity())
  if (!sourcesUnchanged) {
    failure = `${failure ?? ''} Source identity changed during collection`.trim()
  }
  const report = {
    schemaVersion: 1,
    passed: !failure && cleanupErrors.length === 0 && samples.length === options.iterations,
    failure,
    cleanupErrors,
    sourceHashes,
    sourcesUnchanged,
    scenario: { id: options.scenario, filename: scenario.filename, inputSha256, sourceSha256: scriptDigest(scenario.source) },
    batch: options.batch,
    requestedIterations: options.iterations,
    orderPeriod: orders.length,
    warmupRounds,
    completedPairs: samples.length,
    startup,
    checks,
    samples,
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length, startedAt, finishedAt: new Date().toISOString(), initialLoad, finalLoad: loadavg() },
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  return report
}
