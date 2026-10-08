import type { CompileVariant } from '../compileProtocol'
import type { ReportSource } from './types'
import { COMPILE_VARIANTS } from '../compileProtocol'
import { CORPORA, LIMITATIONS } from './types'
import { validateCompileSources } from './validate'

const comparisons: ReadonlyArray<readonly [CompileVariant, CompileVariant]> = [
  ['baseline', 'control-js'],
  ['control-js', 'planned-js'],
  ['control-js', 'planned-summary'],
  ['control-js', 'planned-native'],
  ['planned-js', 'planned-native'],
  ['planned-summary', 'planned-native'],
]

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1]!, p95: sorted[Math.ceil(sorted.length * 0.95) - 1]! }
}

/** 从逐轮原始样本重算统计与配对差值，不采用来源报告预先计算的分位数。 */
export function aggregateCompileTimings(sources: ReportSource[], iterations: number) {
  const validated = validateCompileSources(sources, iterations)
  const correctness = validated[0]!
  return {
    schemaVersion: 1,
    scope: 'Two serial batches of five-way warm compileVueFile measurements on shared CI; diagnostic evidence only.',
    passed: true,
    productionAcceptance: 'not-evaluated',
    protocol: { variants: COMPILE_VARIANTS, corpora: CORPORA, batches: 2, iterations, warmupRounds: 10, orderPeriod: 10 },
    identity: { compiler: correctness.report.compiler, toolSources: correctness.report.toolSources, startup: correctness.report.startup },
    sources: sources.map(({ report: _report, ...source }) => source),
    correctness: { scenarios: correctness.report.checks.map(check => check.scenario), environment: correctness.report.environment },
    groups: validated.slice(1).map(({ id, plan, report }) => ({
      id,
      batch: plan.batch,
      corpus: plan.scenario,
      environment: report.environment,
      pairs: report.samples.length,
      variants: Object.fromEntries(COMPILE_VARIANTS.map(variant => [variant, {
        wallMs: distribution(report.samples.map(sample => sample.variants[variant].wallMs)),
        cpuMicroseconds: distribution(report.samples.map(sample => sample.variants[variant].cpuMicroseconds)),
        rssAfterBytes: distribution(report.samples.map(sample => sample.variants[variant].rssAfterBytes)),
      }])),
      pairedWall: comparisons.map(([reference, candidate]) => {
        const pairs = report.samples.map((sample) => {
          const before = sample.variants[reference].wallMs
          const after = sample.variants[candidate].wallMs
          return { pair: sample.pair, savedMs: before - after, savedPercent: (before - after) / before * 100 }
        })
        return {
          reference,
          candidate,
          savedMs: distribution(pairs.map(pair => pair.savedMs)),
          savedPercent: distribution(pairs.map(pair => pair.savedPercent)),
          pairs,
        }
      }),
    })),
    limitations: LIMITATIONS,
  }
}
