export function observedNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 样本缺失时整体结果未知，避免只选择可用样本导致比较偏差。 */
export function median(values: Array<number | null | undefined>): number | null {
  if (!values.length || values.some(value => observedNumber(value) === null)) {
    return null
  }
  const sorted = [...values as number[]].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function difference(candidate: number | null, baseline: number | null) {
  return candidate === null || baseline === null ? null : candidate - baseline
}
