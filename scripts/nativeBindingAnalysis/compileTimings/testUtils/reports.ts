import type { CompilerReport, ReportSource } from '../types'
import { createHash } from 'node:crypto'
import { COMPILE_VARIANTS } from '../../compileProtocol'
import { balancedOrders } from '../../orders'
import { compileTimingPlan, CORRECTNESS_SCENARIOS } from '../types'

export const hash = (text: string) => createHash('sha256').update(text).digest('hex')

/** 用不同配对分布构造协议证据，确保不能用两组中位数相减代替配对统计。 */
export function reportSources(iterations = 10): ReportSource[] {
  const orders = balancedOrders(COMPILE_VARIANTS)
  const compiler = { compilerSourceFiles: 1, compilerSourceTreeSha256: hash('compiler'), lockfileSha256: hash('lockfile'), bindingSha256: hash('binding') }
  const toolSources = { 'scripts/nativeBindingAnalysis/compile.ts': hash('tool') }
  const startup = Object.fromEntries(COMPILE_VARIANTS.map(variant => [variant, {
    id: 0,
    kind: 'ready',
    sourceHashes: variant === 'baseline' ? {} : { 'packages-runtime/wevu-compiler/src/index.ts': hash('hook') },
    bindingSha256: compiler.bindingSha256,
  }])) as CompilerReport['startup']
  const checks = CORRECTNESS_SCENARIOS.map(scenario => ({
    scenario,
    filename: `src/${scenario}.vue`,
    sourceSha256: hash(scenario),
    options: { isPage: true },
    variants: Object.fromEntries(COMPILE_VARIANTS.map(variant => [variant, {
      outputSha256: hash(`output-${scenario}`),
      failed: scenario === 'invalid-template',
      metrics: {},
    }])) as CompilerReport['checks'][number]['variants'],
  }))
  return compileTimingPlan(iterations).map((entry, index) => {
    const samples = Array.from({ length: entry.iterations }, (_, pair) => ({
      pair,
      order: orders[pair % orders.length]!,
      variants: Object.fromEntries(COMPILE_VARIANTS.map(variant => [variant, {
        wallMs: variant === 'planned-native' ? (pair % 10 || 0.5) : [1, 100, 3, 4, 5, 6, 7, 8, 9, 10][pair % 10]!,
        cpuMicroseconds: 100 + pair,
        rssAfterBytes: 1000 + pair,
        failed: false,
        metrics: { nativeCalls: variant === 'planned-native' ? 1 : 0, fallbackCount: 0, pendingInputs: 0, pendingRecords: 0, activeTemplates: 0 },
      }])) as CompilerReport['samples'][number]['variants'],
    }))
    const report: CompilerReport = {
      schemaVersion: 1,
      passed: true,
      cleanupErrors: [],
      sourcesUnchanged: true,
      compilerInputsUnchanged: true,
      compiler: structuredClone(compiler),
      toolSources: structuredClone(toolSources),
      startup: structuredClone(startup),
      environment: { node: 'v24.18.0', platform: 'linux', arch: 'x64', cpus: 2, startedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index * 2)).toISOString(), finishedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index * 2 + 1)).toISOString(), initialLoad: [0, 0, 0], finalLoad: [0, 0, 0] },
      checks: structuredClone(entry.scenario === 'all' ? checks : checks.filter(check => check.scenario === entry.scenario)),
      requestedIterations: entry.iterations,
      completedPairs: entry.iterations,
      warmupRounds: entry.iterations ? 10 : 0,
      orderPeriod: 10,
      fullyBalanced: entry.iterations > 0,
      samples,
    }
    return { id: entry.id, reportPath: `${entry.id}/report.json`, sha256: hash(JSON.stringify(report)), report }
  })
}
