import type { ScriptVariant } from '../../types'
import type { TimingObservation, TimingReport, TimingSource } from '../types'
import { createHash } from 'node:crypto'
import { balancedOrders } from '../../../nativeBindingAnalysis/orders'
import { scriptBaselineSources } from '../../installHelpers/source'
import { SCRIPT_VARIANTS } from '../../types'
import { timingPlan } from '../types'

export const digest = (value: string) => createHash('sha256').update(value).digest('hex')

/** 固定协议样本使用不相关的两组中位数，区分配对收益和分位数相减。 */
export function timingSources(iterations = 14): Array<TimingSource & { report: TimingReport }> {
  const sourceHashes = Object.fromEntries([...scriptBaselineSources, 'pnpm-lock.yaml', 'scripts/scriptAnalysisBaseline/timing/worker.ts'].map(file => [file, digest(file)]))
  const hooks = Object.fromEntries(scriptBaselineSources.map(file => [file, sourceHashes[file]!]))
  const orders = balancedOrders(SCRIPT_VARIANTS)
  const filenames = {
    'sfc-pressure': 'src/pages/batch-pressure/index.vue',
    'sfc-retail': 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue',
    'sfc-wevu': 'apps/wevu-vue-demo/src/pages/index/index.vue',
  }
  return timingPlan(iterations).map((entry, index) => {
    const scenario = { id: entry.scenario, filename: filenames[entry.scenario], inputSha256: digest(`input-${entry.scenario}`), sourceSha256: digest(`source-${entry.scenario}`) }
    const observe = (variant: ScriptVariant, pair: number): TimingObservation => ({
      outputSha256: digest(`output-${entry.scenario}`),
      inputSha256: scenario.inputSha256,
      failed: false,
      wallMs: variant === 'optimized' ? (pair % 14 || 0.5) : [1, 100, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14][pair % 14]!,
      cpuMicroseconds: 100 + pair,
      rssAfterBytes: 1000 + pair,
      metrics: variant === 'baseline'
        ? {}
        : {
            activeCompiles: 0,
            pendingTransfers: 0,
            astAlreadyConsumed: 0,
            astReuse: variant === 'ast-reuse' || variant === 'optimized' ? 1 : 0,
            propsNoScopeVisits: variant === 'props-no-scope' || variant === 'optimized' ? 1 : 0,
            pageMetaSkipped: variant === 'page-meta-gate' || variant === 'optimized' ? 1 : 0,
            reservedSkipped: variant === 'reserved-props-gate' || variant === 'optimized' ? 1 : 0,
          },
    })
    const report: TimingReport = {
      schemaVersion: 1,
      passed: true,
      cleanupErrors: [],
      sourceHashes: { ...sourceHashes },
      sourcesUnchanged: true,
      scenario,
      batch: entry.batch,
      requestedIterations: iterations,
      orderPeriod: 14,
      warmupRounds: 14,
      completedPairs: iterations,
      startup: Object.fromEntries(SCRIPT_VARIANTS.map(variant => [variant, { sourceHashes: variant === 'baseline' ? {} : { ...hooks } }])) as TimingReport['startup'],
      checks: Object.fromEntries(SCRIPT_VARIANTS.map(variant => [variant, observe(variant, 0)])) as TimingReport['checks'],
      samples: Array.from({ length: iterations }, (_, pair) => ({
        pair,
        order: [...orders[pair % orders.length]!],
        variants: Object.fromEntries(SCRIPT_VARIANTS.map(variant => [variant, observe(variant, pair)])) as TimingReport['checks'],
      })),
      environment: {
        node: 'v24.21.0',
        platform: 'linux',
        arch: 'x64',
        cpus: 4,
        startedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 2)).toISOString(),
        finishedAt: new Date(Date.UTC(2026, 0, 1, 0, index * 2 + 1)).toISOString(),
        initialLoad: [0, 0, 0],
        finalLoad: [0, 0, 0],
      },
    }
    return { id: entry.id, sha256: digest(JSON.stringify(report)), report }
  })
}
