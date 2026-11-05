import type { ProfileMeasurement, ProfileSummary } from './types'

function number(value: number | null | undefined): string {
  return value === undefined || value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(4)
}

function rows(runtime: string, result: ProfileMeasurement): string[] {
  return result.summaries.map((summary: ProfileSummary) => `| ${runtime} | ${summary.operation} | ${summary.group} | ${summary.status} | ${number(summary.candidate.p50Ms)} / ${number(summary.candidate.p95Ms)} | ${summary.baseline ? `${number(summary.baseline.p50Ms)} / ${number(summary.baseline.p95Ms)}` : 'n/a'} | ${summary.ratio === null ? 'n/a' : number(summary.ratio)} |`)
}

/** 输出可审阅的回归报告；原始 samples 保留在 JSON 中，不在 Markdown 中截断。 */
export function regressionMarkdown(identity: { corpus: string, documents: number, cases: number, baseline: string, current: string }, results: Record<string, ProfileMeasurement>): string {
  const lines = [
    '# 全平台模板回归基准',
    '',
    `语料 ${identity.corpus}；${identity.documents} 份唯一文档；${identity.cases} 个内容/profile 用例。`,
    `baseline: ${identity.baseline}`,
    `current: ${identity.current}`,
    '',
    '所有合法平台与 profile 组均与冻结 main 入口成对采样；未使用 htmlparser2 排除项。preserve-noop 仅作信息展示。',
    '',
    '| Runtime | Operation | Group | Status | Candidate P50/P95 ms | Baseline P50/P95 ms | Ratio |',
    '| --- | --- | --- | --- | ---: | ---: | ---: |',
  ]
  for (const [runtime, result] of Object.entries(results)) {
    if (result.workload) {
      lines.push(`<!-- ${runtime}: ${result.workload.logicalCells} logical classifications; ${result.workload.physicalJobs} physical measurements; ${result.workload.logicalCells - result.workload.physicalJobs} duplicate measurements avoided. Raw observations are stored once, not independently repeated per label. -->`)
    }
    lines.push(...rows(runtime, result))
  }
  return `${lines.join('\n')}\n`
}
