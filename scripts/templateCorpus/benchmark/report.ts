import type { ProfileMeasurement } from './types'

/** 独立画像只展示测量与可比性，不把速度比写成旧性能门禁通过。 */
export function profileMarkdown(identity: { corpus: string, documents: number, cases: number, matrixCases: number, excluded: number }, results: Record<string, ProfileMeasurement>): string {
  const lines = [
    '# 全平台冻结模板性能画像',
    '',
    `语料 ${identity.corpus}；真实来源全局唯一 ${identity.documents}；内容/profile 用例 ${identity.cases}（受控非配额 ${identity.matrixCases}）；非合法预期排除 ${identity.excluded}。`,
    '',
    '该画像使用独立新语料分母。原有 464 份正式 bench:check、历史结果及门槛保持不变；此报告不能证明旧门禁通过。',
    '',
    '| Runtime | Operation | Group | Status | Candidate P50/P95 ms | Baseline P50/P95 ms | Ratio | Candidate MiB/s |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |',
  ]
  const number = (value: number) => Number.isFinite(value) ? value.toFixed(4) : 'n/a'
  for (const [runtime, result] of Object.entries(results)) {
    for (const row of result.summaries) {
      lines.push(`| ${runtime} | ${row.operation} | ${row.group} | ${row.status} | ${number(row.candidate.p50Ms)} / ${number(row.candidate.p95Ms)} | ${row.baseline ? `${number(row.baseline.p50Ms)} / ${number(row.baseline.p95Ms)}` : '独立吞吐'} | ${row.ratio === null ? 'n/a' : number(row.ratio)} | ${number(row.candidate.mibPerSecond)} |`)
    }
  }
  return `${lines.join('\n')}\n`
}
