import { createHash } from 'node:crypto'

/** 固定种子的分层偏移打散输入轮询相位；只安排计时外等待，不删改编辑样本。 */
export function createBenchmarkEditSchedule(count: number, spanMs: number, seed?: string): number[] {
  if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(spanMs) || spanMs <= 0) {
    throw new Error('Benchmark schedule requires positive integer count and span')
  }
  if (seed === undefined) {
    return Array.from<number>({ length: count }).fill(0)
  }
  const offsets = Array.from({ length: count }, (_, index) => Math.floor((index + 0.5) * spanMs / count))
  let state = createHash('sha256').update(seed).digest().readUInt32LE(0) || 1
  for (let index = count - 1; index > 0; index -= 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const target = (state >>> 0) % (index + 1)
    ;[offsets[index], offsets[target]] = [offsets[target], offsets[index]]
  }
  return offsets
}
