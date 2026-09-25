import process from 'node:process'

/** 确认批次仅选择配置，配置内部的首次/重复及编辑/恢复顺序不变。 */
export function benchmarkModeSelected(count: number, mode: 'manual' | 'automatic') {
  const input = process.env.BENCH_CONFIGURATIONS
  if (!input) {
    return true
  }
  const values: unknown = JSON.parse(input)
  if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string' || !/^(?:1|20|50|69):(?:manual|automatic)$/.test(value))) {
    throw new Error('Invalid BENCH_CONFIGURATIONS')
  }
  return values.includes(`${count}:${mode}`)
}

/** 单模式确认仅保存真实原始样本，不发布空侧的零值比较摘要。 */
export function benchmarkReportResults<T extends { usedCount: number, requestedCount: number, raw: unknown }>(results: T[]) {
  return process.env.BENCH_CONFIGURATIONS
    ? results.map(({ usedCount, requestedCount, raw }) => ({ usedCount, requestedCount, raw }))
    : results
}
