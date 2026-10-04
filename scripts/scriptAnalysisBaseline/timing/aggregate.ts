import type { ScriptVariant } from '../types'
import type { TimingSource } from './types'
import { SCRIPT_VARIANTS } from '../types'
import { TIMING_LIMITATIONS } from './types'
import { validateTimingSources } from './validate'

const comparisons: ReadonlyArray<readonly [ScriptVariant, ScriptVariant]> = [
  ['baseline', 'control'],
  ['control', 'ast-reuse'],
  ['control', 'props-no-scope'],
  ['control', 'page-meta-gate'],
  ['control', 'reserved-props-gate'],
  ['control', 'optimized'],
]

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1]!, p95: sorted[Math.ceil(sorted.length * 0.95) - 1]! }
}

/** 从同轮样本计算配对收益，保留原始顺序与观测；各批各语料独立统计。 */
export function aggregateScriptTimings(sources: TimingSource[], iterations: number) {
  const validated = validateTimingSources(sources, iterations)
  return {
    schemaVersion: 1,
    passed: true,
    productionAcceptance: 'not-evaluated',
    sources: sources.map(({ report: _report, ...source }) => source),
    groups: validated.map(({ id, report }) => ({
      id,
      batch: report.batch,
      corpus: report.scenario.id,
      scenario: report.scenario,
      environment: report.environment,
      pairs: report.samples.length,
      variants: Object.fromEntries(SCRIPT_VARIANTS.map(variant => [variant, {
        wallMs: distribution(report.samples.map(sample => sample.variants[variant].wallMs)),
        cpuMicroseconds: distribution(report.samples.map(sample => sample.variants[variant].cpuMicroseconds)),
        rssAfterBytes: distribution(report.samples.map(sample => sample.variants[variant].rssAfterBytes)),
      }])),
      pairedWall: comparisons.map(([reference, candidate]) => {
        const pairs = report.samples.map((sample) => {
          const before = sample.variants[reference].wallMs
          const after = sample.variants[candidate].wallMs
          const savedMs = before - after
          const savedPercent = savedMs / before * 100
          if (!Number.isFinite(savedMs) || !Number.isFinite(savedPercent)) {
            throw new TypeError(`${id}: non-finite paired wall calculation`)
          }
          return { pair: sample.pair, savedMs, savedPercent }
        })
        return {
          reference,
          candidate,
          savedMs: distribution(pairs.map(pair => pair.savedMs)),
          savedPercent: distribution(pairs.map(pair => pair.savedPercent)),
          pairs,
        }
      }),
      samples: report.samples,
    })),
    limitations: TIMING_LIMITATIONS,
  }
}
