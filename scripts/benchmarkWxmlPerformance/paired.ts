import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { commonCases } from './common'
import { percentile } from './measure'

/** 交替顺序成对采样，用相同批量降低计时器、JIT 和单次 GC 噪声。 */
const baseline = path.resolve(process.env.WXML_PERF_BASELINE_ROOT!)
const optimized = path.resolve(process.env.WXML_PERF_ROOT ?? process.cwd())
const roots = [baseline, optimized]
const report: any = { shas: roots.map(cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()), samples: 20, results: [] }
const suites = []
for (const root of roots) {
  suites.push(await commonCases(file => import(pathToFileURL(path.join(root, '.tmp/wxml-performance/modules', file.replace(/\.ts$/, '.mjs'))).href), existsSync(path.join(root, 'packages/weapp-vite/src/wxml/remove/index.ts'))))
}
assert.ok(globalThis.gc)
for (let testIndex = 0; testIndex < suites[0]!.length; testIndex++) {
  const tests = suites.map(suite => suite[testIndex]!)
  const name = tests[0]!.name
  const count = Number(name.split('/').at(-1))
  const batch = name.includes('text-static') ? 1000 : name.includes('text-binding') || name.includes('/parse') ? Math.max(2, 10000 / count) : 1
  const samples: Array<Array<{ ms: number, rss: number, heapUsed: number }>> = [[], []]
  for (let round = -10; round < 20; round++) {
    for (const side of round % 2 === 0 ? [0, 1] : [1, 0]) {
      const test = tests[side]!
      globalThis.gc!()
      let result: unknown
      const start = performance.now()
      for (let repetition = 0; repetition < batch; repetition++) {
        result = test.run()
        if (result instanceof Promise) {
          result = await result
        }
      }
      const ms = (performance.now() - start) / batch
      test.verify(result)
      if (round >= 0) {
        const { rss, heapUsed } = process.memoryUsage()
        samples[side]!.push({ ms, rss, heapUsed })
      }
    }
  }
  const medians = samples.map(side => percentile(side.map(sample => sample.ms), 0.5))
  const row = { name, batch, medianMs: medians, p95Ms: samples.map(side => percentile(side.map(sample => sample.ms), 0.95)), changePercent: (medians[1]! / medians[0]! - 1) * 100, samples }
  report.results.push(row)
  const output = process.env.WXML_PERF_OUTPUT ?? '.tmp/wxml-performance/paired.json'
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`${name}: ${medians.map(value => value.toFixed(4)).join(' -> ')} ms (${row.changePercent.toFixed(1)}%)\n`)
}
