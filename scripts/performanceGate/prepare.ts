import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 准备结束后核验 checkout 没有移动。
import { execa } from 'execa'
import { prepareBenchmarkRunner, prepareCheckout } from '../compare-templates-performance'

// 准备在独立有界子进程中执行；smoke 只准备当前 checkout。
const output = path.resolve(process.env.TEMPLATES_PERF_REPORT_DIR!)
await mkdir(output, { recursive: true })
await prepareBenchmarkRunner()
const baseline = process.env.PERFORMANCE_PURPOSE === 'smoke' ? undefined : await prepareCheckout('baseline', path.resolve(process.env.TEMPLATES_PERF_BASELINE_DIR!))
const optimized = await prepareCheckout('optimized', path.resolve(process.env.TEMPLATES_PERF_OPTIMIZED_DIR!))
for (const checkout of [baseline, optimized]) {
  if (checkout && (await execa('git', ['rev-parse', 'HEAD'], { cwd: checkout.cwd })).stdout.trim() !== checkout.commit) {
    throw new Error('Checkout moved during preparation')
  }
}
await writeFile(path.join(output, 'prepared.json'), JSON.stringify({ baseline, optimized }))
