import type { CollectorStop } from './collectorStop'
import type { GateSummary } from './evaluate'

type Side = 'baseline' | 'optimized'
type BatchName = 'primary' | 'confirmation'
interface RuntimeCounts { standard: number, stateful: number, unknown: number }
interface RuntimeObservation {
  observations: number
  runtimeBefore: RuntimeCounts
  runtimeAfter: RuntimeCounts
  profilePipeline: RuntimeCounts
}
interface DiagnosticBatch {
  samples: Array<{ side: string, values: Array<{ id: string, runtimeBefore?: unknown, runtimeAfter?: unknown, profilePipeline?: unknown }> }>
  errors: string[]
  stop?: CollectorStop
}
interface FeatureCost {
  side: string
  id?: string
  kind?: string
  count?: number
  phase?: string
  extraMs: number | null
  extraPercent?: number | null
  changePercent?: number | null
  overFeatureBudget: boolean | null
}

export interface RuntimeSummary {
  requestedRuntime: string
  unit: 'metric-observations'
  primary: Record<Side, RuntimeObservation>
  confirmation?: Record<Side, RuntimeObservation>
}

export type FailureReason
  = | { kind: 'comparison', scenario: string, status: 'regression' | 'unstable' | 'incomplete' }
    | { kind: 'collection', batch: BatchName, side: Side | 'unknown', round?: number, message: string }
    | { kind: 'collector-stop', batch: BatchName, reason: string, resourcesReleased: boolean }
    | { kind: 'feature-budget', side: string, scenario: string, extraMs: number | null, extraPercent: number | null }

export interface ShardDiagnostics {
  runtimeSummary?: RuntimeSummary
  failureReasons: FailureReason[]
}

function runtimeCounts(): RuntimeCounts {
  return { standard: 0, stateful: 0, unknown: 0 }
}

function runtimeObservations(batch: DiagnosticBatch, shard: string): Record<Side, RuntimeObservation> {
  const side = (name: Side) => {
    const values = batch.samples.filter(row => row.side === name).flatMap(row => row.values).filter(value => value.id.startsWith(`${shard}:`))
    const result: RuntimeObservation = { observations: values.length, runtimeBefore: runtimeCounts(), runtimeAfter: runtimeCounts(), profilePipeline: runtimeCounts() }
    for (const value of values) {
      for (const field of ['runtimeBefore', 'runtimeAfter', 'profilePipeline'] as const) {
        const pipeline = value[field]
        result[field][pipeline === 'standard' || pipeline === 'stateful' ? pipeline : 'unknown']++
      }
    }
    return result
  }
  return { baseline: side('baseline'), optimized: side('optimized') }
}

/** 诊断只解释原始证据，不参与采样、能力例外或门禁判定。 */
export function createShardDiagnostics(input: {
  shard: string
  primary: DiagnosticBatch
  confirmation?: DiagnosticBatch
  gate: GateSummary
  featureCosts: FeatureCost[]
}): ShardDiagnostics {
  const { shard, primary, confirmation, gate, featureCosts } = input
  const runtimeSummary: RuntimeSummary | undefined = shard.startsWith('hmr:')
    ? {
        requestedRuntime: shard.split(':')[1]!,
        unit: 'metric-observations',
        primary: runtimeObservations(primary, shard),
        ...(confirmation ? { confirmation: runtimeObservations(confirmation, shard) } : {}),
      }
    : undefined
  const failureReasons: FailureReason[] = []
  for (const row of gate.scenarios) {
    if (row.status !== 'passed') {
      failureReasons.push({ kind: 'comparison', scenario: row.id, status: row.status })
    }
  }
  for (const [batch, evidence] of [['primary', primary], ['confirmation', confirmation]] as const) {
    if (!evidence) {
      continue
    }
    for (const message of evidence.errors) {
      const scope = /^(?:primary|confirmation)(?: [^\n]*?)? pair ([1-9]\d*) (baseline|optimized):/.exec(message)
      const side = scope?.[2] ?? /^(baseline|optimized):/.exec(message)?.[1]
      failureReasons.push({ kind: 'collection', batch, side: side === 'baseline' || side === 'optimized' ? side : 'unknown', ...(scope ? { round: Number(scope[1]) } : {}), message })
    }
    if (evidence.stop) {
      failureReasons.push({ kind: 'collector-stop', batch, reason: evidence.stop.reason, resourcesReleased: evidence.stop.resourcesReleased })
    }
  }
  for (const cost of featureCosts.filter(row => row.overFeatureBudget)) {
    failureReasons.push({ kind: 'feature-budget', side: cost.side, scenario: cost.id ?? `${cost.kind}:${cost.count}:manual:${cost.phase}`, extraMs: cost.extraMs, extraPercent: cost.extraPercent ?? cost.changePercent ?? null })
  }
  return { ...(runtimeSummary ? { runtimeSummary } : {}), failureReasons }
}

const inline = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('`', '\\`').replace(/\s+/g, ' ')
const showCounts = (counts: RuntimeCounts) => Object.entries(counts).filter(([, count]) => count).map(([pipeline, count]) => `${pipeline}: ${count}`).join(', ') || 'unknown（无观测）'
const showNumber = (value: number | null) => value === null ? 'unknown' : value.toFixed(2)

/** 日志与两层 Markdown 报告共用同一解释，缺失历史字段不推断实际管线。 */
export function renderShardDiagnostics(diagnostics: ShardDiagnostics) {
  const lines: string[] = []
  const runtime = diagnostics.runtimeSummary
  if (runtime) {
    lines.push('#### HMR 请求与实际管线', '', `请求 runtime：\`${inline(runtime.requestedRuntime)}\`。按每个场景阶段的产物观测计数；unknown 表示原始报告对应字段缺失或无法识别，不代表运行 classic 或 stateful。`, '', '| 批次 / 提交侧 | 观测数 | 更新前 | 更新后 | profile 管线 |', '| --- | ---: | --- | --- | --- |')
    for (const batch of ['primary', 'confirmation'] as const) {
      const observations = runtime[batch]
      if (observations) {
        for (const side of ['baseline', 'optimized'] as const) {
          const values = observations[side]
          lines.push(`| ${batch} / ${side} | ${values.observations} | ${showCounts(values.runtimeBefore)} | ${showCounts(values.runtimeAfter)} | ${showCounts(values.profilePipeline)} |`)
        }
      }
    }
    lines.push('实际管线不同仍按原门槛比较，不豁免回退；profile 管线 unknown 也不推断编译耗时。')
  }
  lines.push('', '#### 失败来源', '')
  if (!diagnostics.failureReasons.length) {
    lines.push('无。')
  }
  for (const reason of diagnostics.failureReasons) {
    if (reason.kind === 'comparison') {
      lines.push(`- 跨提交比较 ${reason.status}：\`${inline(reason.scenario)}\`。`)
    }
    else if (reason.kind === 'collection') {
      lines.push(`- 采集失败 ${reason.batch} / ${reason.side}${reason.round ? ` / pair ${reason.round}` : ''}：${inline(reason.message.split('\n')[0]!.slice(0, 500))}`)
    }
    else if (reason.kind === 'collector-stop') {
      lines.push(`- 采集停止 ${reason.batch}：${inline(reason.reason)}；资源已释放：${reason.resourcesReleased ? '是' : '否'}。`)
    }
    else {
      lines.push(`- 功能预算越线 ${inline(reason.side)} / \`${inline(reason.scenario)}\`：增加 ${showNumber(reason.extraMs)} ms / ${showNumber(reason.extraPercent)}%，保留同时超过 200 ms 和 25% 的原门槛。`)
    }
  }
  return lines.join('\n').trim()
}
