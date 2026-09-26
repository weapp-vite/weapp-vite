import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

export interface Case {
  name: string
  run: () => unknown | Promise<unknown>
  verify: (result: any) => void
  evidence?: (result: any) => unknown
  bytes?: number
}

export function percentile(values: number[], fraction: number) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!
}

/** GC 在计时之外；保留每个样本，避免把缺失结果算作通过。 */
export async function measure(test: Case, count: number) {
  assert.ok(count >= 15)
  for (let warmup = 0; warmup < 5; warmup++) {
    test.verify(await test.run())
  }
  const samples = []
  let evidence: unknown
  for (let index = 0; index < count; index++) {
    globalThis.gc?.()
    const before = process.memoryUsage()
    const start = performance.now()
    const output = await test.run()
    const ms = performance.now() - start
    const after = process.memoryUsage()
    test.verify(output)
    evidence = test.evidence?.(output)
    globalThis.gc?.()
    samples.push({ ms, rss: after.rss, heapUsed: after.heapUsed, heapDelta: after.heapUsed - before.heapUsed, retainedHeapDelta: process.memoryUsage().heapUsed - before.heapUsed })
  }
  return {
    name: test.name,
    bytes: test.bytes,
    evidence,
    medianMs: percentile(samples.map(sample => sample.ms), 0.5),
    p95Ms: percentile(samples.map(sample => sample.ms), 0.95),
    samples,
  }
}
