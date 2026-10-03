import type { WorkerResult } from './types'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- worker 与 npm 安装共用跨平台进程封装。
import { execa } from 'execa'
import { createConsumerTemporaryRoot, packConsumerTarballs } from '../../../packages/weapp-vite/scripts/consumerTarballs.mjs'
import { createRuntimeBenchConsumer } from './consumer'

const RESULT_PREFIX = 'RUNTIME_BENCH_RESULT '

export async function runPublishedPresetBench(options: {
  repoRoot: string
  provider: string
  tarballDirectory?: string
  output: string
}) {
  const temporaryRoot = await createConsumerTemporaryRoot()
  const results: Record<string, { provenance: Awaited<ReturnType<typeof createRuntimeBenchConsumer>>, result: WorkerResult }> = {}
  const failures: Record<string, string> = {}
  const { stdout: commit } = await execa('git', ['rev-parse', 'HEAD'], { cwd: options.repoRoot })
  const report = {
    schemaVersion: 2,
    scope: 'Published tarball consumers; identical Vue input; production build; normal/performance presets',
    generatedAt: new Date().toISOString(),
    commit: commit.trim(),
    provider: options.provider,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    complete: false,
    limitations: [
      'AppService JS heap is capability-probed before/after each workload outside its timer; unsupported hosts retain explicit reasons. This excludes renderer/native memory and is not a peak or forced-GC measurement; worker RSS is separate.',
      'Commit means adapter callback/Promise/return settlement; visible state is asserted separately through DOM observations.',
      'Official stable DevTools channel provenance must be recorded by the acceptance operator alongside this report.',
    ],
    results,
    failures,
  }
  try {
    const tarballDirectory = options.tarballDirectory ?? path.join(temporaryRoot, 'tarballs')
    if (!options.tarballDirectory) {
      await packConsumerTarballs(options.repoRoot, tarballDirectory)
    }
    for (const preset of ['normal', 'performance']) {
      process.stderr.write(`[runtime-bench] published consumer preset=${preset}\n`)
      try {
        const root = path.join(temporaryRoot, preset)
        const provenance = await createRuntimeBenchConsumer({
          root,
          fixtureRoot: path.join(options.repoRoot, 'apps/runtime-bench-vue'),
          tarballDirectory,
        })
        const { stdout } = await execa(process.execPath, ['--import', 'tsx', path.join(options.repoRoot, 'e2e/scripts/runtime-bench.worker.ts'), root], {
          cwd: options.repoRoot,
          env: {
            NODE_PATH: '',
            WEVU_BENCH_PROJECT: 'runtime-bench-vue',
            WEVU_BENCH_CONSUMER: '1',
            WEVU_BENCH_PRESET: preset,
            WEAPP_VITE_E2E_RUNTIME_PROVIDER: options.provider,
            WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK: undefined,
            WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP: undefined,
          },
        })
        const line = stdout.split(/\r?\n/).find(item => item.startsWith(RESULT_PREFIX))
        assert(line, `Missing published benchmark result: ${preset}`)
        const result = JSON.parse(line.slice(RESULT_PREFIX.length)) as WorkerResult
        assert.equal(result.schemaVersion, 2, 'Unexpected benchmark metric schema')
        assert.equal(result.preset, preset, 'Benchmark preset mismatch')
        // 报告只保存可复现的相对路径，临时消费者物理路径只供当前进程构建使用。
        provenance.cliPath = path.relative(root, provenance.cliPath).replaceAll('\\', '/')
        results[preset] = { provenance, result }
      }
      catch (error) {
        failures[preset] = String(error).replaceAll(temporaryRoot, '<consumer>').replaceAll(options.repoRoot, '<repo>')
        throw error
      }
    }
    assert.equal(results.normal!.provenance.sourceHash, results.performance!.provenance.sourceHash, 'Preset fixture inputs differ')
    assert.equal(results.normal!.provenance.archiveHash, results.performance!.provenance.archiveHash, 'Preset candidate archives differ')
    report.complete = true
  }
  finally {
    await fs.mkdir(path.dirname(options.output), { recursive: true })
    await fs.writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`)
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
  return report
}
