import type { AuditSample, Checkout } from './collect'
import type { GateScenario, GateSummary } from './evaluate'
import os from 'node:os'
import process from 'node:process'
import { evaluateGate, percentile } from './evaluate'
import { isOutputEvidence } from './outputEvidence'

export interface AuditBatch {
  samples: Array<{ round: number, side: 'baseline' | 'optimized', values: AuditSample[] }>
  errors: string[]
}

/** 严格按轮次与场景配对，不因一侧缺失而缩小比较集合。 */
export function pairBatch(batch: AuditBatch, expected: string[] = []): GateScenario[] {
  const ids = new Set([...expected, ...batch.samples.flatMap(row => row.values.map(value => value.id))])
  return [...ids].map((id) => {
    const baseline = batch.samples.filter(row => row.side === 'baseline' && row.values.some(value => value.id === id))
    const current = batch.samples.filter(row => row.side === 'optimized' && row.values.some(value => value.id === id))
    const duplicatedRound = [baseline, current].some(rows => new Set(rows.map(row => row.round)).size !== rows.length)
    let outputMismatch = false
    const pairs = baseline.map((before) => {
      const after = current.filter(row => row.round === before.round)
      const a = before.values.filter(value => value.id === id)
      const b = after[0]?.values.filter(value => value.id === id) ?? []
      if (id.startsWith('build:') || id.startsWith('auto-build:')) {
        const first = a[0]?.output
        const second = b[0]?.output
        outputMismatch ||= !isOutputEvidence(first) || !isOutputEvidence(second)
          || first.pageCount !== second.pageCount || first.templateDigest !== second.templateDigest || first.configDigest !== second.configDigest
      }
      return { baseline: a.length === 1 ? a[0]!.ms : Number.NaN, current: after.length === 1 && b.length === 1 ? b[0]!.ms : Number.NaN }
    })
    return { id, requiredPairs: id.startsWith('build:') || id.startsWith('auto-build:') ? 7 : 20, pairs, error: duplicatedRound ? 'Duplicate paired round' : outputMismatch ? 'Missing or different emitted page/template/config evidence' : current.length !== baseline.length ? 'Unequal sample counts' : undefined }
  })
}

/** 单个类别失败不抹去其他类别的完整证据，但始终阻止整个验收通过。 */
export function evaluateAuditGate(primary: AuditBatch, confirmation?: AuditBatch, expected: string[] = []): GateSummary {
  const gate = evaluateGate(pairBatch(primary, expected), confirmation ? pairBatch(confirmation) : [])
  if (primary.errors.length || confirmation?.errors.length) {
    gate.status = gate.status === 'regression' ? 'regression' : 'incomplete'
  }
  return gate
}

/** 兼容既有 artifact 外壳，同时保留新门禁全部原始成对样本。 */
export function createAuditReport(checkouts: { baseline: Checkout, optimized: Checkout }, primary: AuditBatch, confirmation: AuditBatch | undefined, gate: GateSummary) {
  const samples = (side: string, id?: string) => primary.samples.filter(row => row.side === side).flatMap(row => row.values).filter(value => !id || value.id === id)
  const stats = (values: number[]) => ({ mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, median: percentile(values, 0.5), p95: percentile(values, 0.95) })
  const measure = (side: string, id: string) => {
    const values = samples(side, id)
    const time = stats(values.map(value => value.ms))
    const memory = stats(values.map(value => value.rssBytes).filter((value): value is number => typeof value === 'number'))
    const cli = values.map(value => value.cliMs).filter((value): value is number => typeof value === 'number')
    const core = values.map(value => value.profile?.totalMs).filter((value): value is number => typeof value === 'number')
    const outsideCli = values.filter(value => typeof value.cliMs === 'number').map(value => value.ms - value.cliMs!)
    return { totalAverageMs: time.mean, totalMedianMs: time.median, p95Ms: time.p95, averageWallMs: time.mean, wallSamples: values.map(value => value.ms), count: values.length, cli: { ...stats(cli), count: cli.length }, outsideCli: { ...stats(outsideCli), count: outsideCli.length }, core: { ...stats(core), count: core.length }, rssPeakAverageBytes: memory.mean, rssAverageBytes: memory.mean }
  }
  const rows = gate.scenarios.map(row => ({ id: row.id, key: row.id, comparable: row.status !== 'incomplete', baseline: measure('baseline', row.id), optimized: measure('optimized', row.id) }))
  const side = (name: 'baseline' | 'optimized') => {
    const values = samples(name).filter(value => value.id.startsWith('build:'))
    const hmrValues = samples(name).filter(value => value.id.startsWith('hmr:'))
    const summarize = (phase: string) => {
      const selected = values.filter(value => value.phase === phase)
      return { totalAverageMs: stats(selected.map(value => value.ms)).mean, count: selected.length }
    }
    const templates = [...new Set(hmrValues.map(value => value.template))].map(id => ({
      id,
      scenarios: [{ id: 'paired-phases', samples: hmrValues.filter(value => value.template === id).map(value => ({ ...value, timingSource: value.profile ? 'compiler-profile' : 'output-observation' })) }],
    }))
    return { commit: checkouts[name].commit, packageManager: checkouts[name].packageManager, lockfileSha256: checkouts[name].lockfileSha256, build: { samples: values.map(value => ({ ...value, totalMs: value.ms, iteration: value.phase === 'first' ? 1 : 2, status: 0 })), raw: summarize('first'), warm: summarize('repeat') }, hmr: { templates } }
  }
  const aggregate = (kind: string) => {
    const result: Record<string, number | null> = {}
    for (const [name, suffix] of [['baseline', 'Baseline'], ['optimized', 'Optimized']] as const) {
      const values = samples(name).filter(value => value.id.startsWith(kind))
      result[`totalAverage${suffix}Ms`] = stats(values.map(value => value.ms)).mean
      result[`wallAverage${suffix}Ms`] = stats(values.map(value => value.ms)).mean
      result[`cliAverage${suffix}Ms`] = stats(values.map(value => value.cliMs).filter((value): value is number => typeof value === 'number')).mean
      result[`coreAverage${suffix}Ms`] = stats(values.map(value => value.profile?.totalMs).filter((value): value is number => typeof value === 'number')).mean
      result[`rssPeakAverage${suffix}Bytes`] = stats(values.map(value => value.rssBytes).filter((value): value is number => typeof value === 'number')).mean
      result[`rssAverage${suffix}Bytes`] = result[`rssPeakAverage${suffix}Bytes`]!
      result[`heapUsedAverage${suffix}Bytes`] = stats(values.map(value => value.heapBytes).filter((value): value is number => typeof value === 'number')).mean
    }
    return result
  }
  return {
    benchmark: 'templates-paired-performance',
    generatedAt: new Date().toISOString(),
    environment: { os: process.platform, release: os.release(), arch: process.arch, node: process.version, cpus: os.cpus().length, driver: 'same-checkout', order: 'alternating-by-pair', buildLifecycle: 'fresh CLI each time; repeat retains previous build output', hmrLifecycle: 'fresh dev session per pair; first and repeat edits separated', memory: 'build: sampled process-tree peak RSS; HMR: dev process after GC; RSS and heap are distinct' },
    buildIterations: 7,
    hmrIterations: 20,
    baseline: side('baseline'),
    optimized: side('optimized'),
    build: { all: aggregate('build:'), rows: rows.filter(row => row.id.startsWith('build:')), failed: rows.filter(row => row.id.startsWith('build:') && !row.comparable) },
    hmr: { all: aggregate('hmr:'), rows: rows.filter(row => row.id.startsWith('hmr:')), failed: rows.filter(row => row.id.startsWith('hmr:') && !row.comparable) },
    gate,
    primary,
    confirmation,
  }
}

function format(value: number | null) {
  return value === null ? '不可用' : value.toFixed(2)
}

function formatStatus(status: GateSummary['status']) {
  return status === 'passed' ? '✅ passed' : `🔴 ${status}`
}

function formatChange(value: number | null, status: GateSummary['status']) {
  const marker = status !== 'passed' ? '🔴 ' : value !== null && value < 0 ? '🟢 ' : ''
  return `${marker}${value === null ? '不可用' : `${format(value)}%`}`
}

export function renderGate(gate: GateSummary) {
  return [
    '# 成对性能门禁',
    '',
    `结论：**${formatStatus(gate.status)}**；阈值：${gate.thresholdPercent}%。正数表示当前提交更慢。`,
    '',
    '标记：🔴 未通过（回退、不稳定或证据不完整，优先于单批下降）；🟢 已通过场景的耗时下降；✅ 门禁通过。阈值内的小幅增加保持中性，不标为性能提升。',
    '',
    '| 场景 | 基线 P50 / P95 | 当前 P50 / P95 | P50 增量 | 变化 | 样本对 | 复核变化 | 结论 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...gate.scenarios.map(({ id, primary: p, confirmation: c, status }) => `| ${id} | ${format(p.baselineMedianMs)} / ${format(p.baselineP95Ms)} ms | ${format(p.currentMedianMs)} / ${format(p.currentP95Ms)} ms | ${format(p.currentMedianMs !== null && p.baselineMedianMs !== null ? p.currentMedianMs - p.baselineMedianMs : null)} ms | ${formatChange(p.changePercent, status)} | ${p.count} | ${c ? formatChange(c.changePercent, status) : '未执行'} | ${formatStatus(status)} |`),
    '',
    '首次构建指清理项目产物后的构建，重复构建保留前次产物；每次均启动新 CLI，不声称清空 OS 文件缓存。HMR 每对使用独立 dev 会话，编辑和恢复分别保留。编译 profile、内存和原始日志为诊断证据，不替代端到端产物确认。',
  ].join('\n')
}
