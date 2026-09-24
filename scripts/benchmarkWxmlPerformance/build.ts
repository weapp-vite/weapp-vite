/* eslint-disable e18e/ban-dependencies -- 性能采样使用跨平台进程启动器。 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { execa } from 'execa'
import { verifyBenchmarkAppOutputs } from '../benchmarkTemplatesPerformance/appOutputs'
import { createPeakRssSampler } from '../benchmarkTemplatesPerformance/peakRssSampler'
import { sampleProcessTreeRssBytes } from '../benchmarkTemplatesPerformance/processTreeRss'

const root = path.resolve(process.env.WXML_PERF_ROOT ?? process.cwd())
const output = path.resolve(process.env.WXML_PERF_OUTPUT ?? '.tmp/wxml-performance/build.json')
const templates = ['weapp-vite-tailwindcss-tdesign-template', 'weapp-vite-template', 'weapp-vite-wevu-template']
const report: any = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), samples: [] }
await mkdir(path.dirname(output), { recursive: true })
for (const template of templates) {
  const project = path.join(root, 'templates', template)
  for (let iteration = 1; iteration <= 7; iteration++) {
    await rm(path.join(project, 'dist'), { recursive: true, force: true })
    const start = performance.now()
    const child = execa('pnpm', ['--filter', template, 'build'], { cwd: root, reject: false })
    const memory = createPeakRssSampler(() => typeof child.pid === 'number' ? sampleProcessTreeRssBytes(child.pid) : Promise.resolve(null))
    const result = await child
    const ms = performance.now() - start
    const rss = await memory.stop()
    assert.equal(result.exitCode, 0, `Build failed: ${template}`)
    const artifacts = await verifyBenchmarkAppOutputs(project)
    report.samples.push({ template, iteration, ms, ...rss, artifacts })
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${template} ${iteration}/7: ${ms.toFixed(1)} ms\n`)
  }
}
