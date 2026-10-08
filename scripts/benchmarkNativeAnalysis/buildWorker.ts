/* eslint-disable e18e/ban-dependencies -- 测量真实 CLI 子进程，使用既有跨平台 RSS 采样。 */
import type { Run } from './contract'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { execa } from 'execa'
import { verifyBenchmarkAppOutputs } from '../benchmarkTemplatesPerformance/appOutputs'
import { parseCliBuildMs } from '../benchmarkTemplatesPerformance/cliTiming'
import { createPeakRssSampler } from '../benchmarkTemplatesPerformance/peakRssSampler'
import { sampleProcessTreeRssBytes } from '../benchmarkTemplatesPerformance/processTreeRss'
import { captureArtifacts, normalizeRoots, warningEvidence } from './artifacts'

const job = JSON.parse(await readFile(process.env.NATIVE_BENCHMARK_JOB_FILE!, 'utf8')) as {
  root: string
  project: string
  directory: string
  inputDigest: string
  preload?: string
  result: Run
}
try {
  for (const phase of ['first', 'repeat']) {
    const start = performance.now()
    const child = execa(process.execPath, [...(job.preload ? ['--require', job.preload] : []), path.join(job.root, 'packages/weapp-vite/bin/weapp-vite.js'), 'build', job.project, '--platform', 'weapp'], { cwd: job.root, reject: false })
    if (job.preload && child.pid) {
      (job.result.native.expectedProcessIds ??= []).push(child.pid)
    }
    const sampler = createPeakRssSampler(() => child.pid ? sampleProcessTreeRssBytes(child.pid) : Promise.resolve(null))
    let memory: Awaited<ReturnType<typeof sampler.stop>>
    let result: Awaited<typeof child>
    let wallMs: number
    try {
      result = await child
      wallMs = performance.now() - start
      memory = await sampler.stop()
    }
    finally {
      await sampler.stop()
    }
    const log = `${result.stdout}\n${result.stderr}`
    await writeFile(path.join(job.directory, `${phase}.log`), normalizeRoots(log, [job.project, job.root]))
    if (result.exitCode !== 0) {
      throw new Error(`Build failed (${result.exitCode})`)
    }
    await verifyBenchmarkAppOutputs(job.project)
    const output = await captureArtifacts(path.join(job.project, 'dist'), [job.project, job.root], path.join(job.directory, 'sourcemaps', phase))
    if (!output.maps) {
      throw new Error('Expected emitted sourcemaps are missing')
    }
    job.result.samples.push({ id: `build:${job.result.input}:${phase}`, wallMs, cliMs: parseCliBuildMs(log), rssBytes: memory.rssPeakBytes, rssSampling: memory.rssSampling, inputDigest: job.inputDigest, output, warnings: warningEvidence(log, [job.project, job.root]) })
    await writeFile(path.join(job.directory, 'sample.json'), JSON.stringify(job.result))
  }
}
catch (error) {
  job.result.error = normalizeRoots(String(error), [job.project, job.root])
  process.exitCode = 1
}
await writeFile(path.join(job.directory, 'sample.json'), JSON.stringify(job.result))
