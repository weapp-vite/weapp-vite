import type { BenchWorkerEvidence } from './evidence'
import type { WorkerResult } from './types'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- worker 与 npm 安装共用跨平台进程封装。
import { execa } from 'execa'
import { createConsumerTemporaryRoot, packConsumerTarballs } from '../../../packages/weapp-vite/scripts/consumerTarballs.mjs'
import { assertEquivalentBenchConsumers, assessBenchMemory } from './acceptance'
import { createRuntimeBenchConsumer } from './consumer'
import { describeBenchError, readBenchEvidence } from './evidence'

const RESULT_PREFIX = 'RUNTIME_BENCH_RESULT '

export async function runPublishedPresetBench(options: {
  repoRoot: string
  provider: string
  tarballDirectory?: string
  output: string
}) {
  const temporaryRoot = await createConsumerTemporaryRoot()
  const results: Record<string, {
    provenance?: Awaited<ReturnType<typeof createRuntimeBenchConsumer>>
    result?: WorkerResult
    evidence?: BenchWorkerEvidence
  }> = {}
  const failures: Record<string, string> = {}
  const report = {
    schemaVersion: 2,
    scope: 'Published tarball consumers; identical Vue input; production build; normal/performance presets',
    generatedAt: new Date().toISOString(),
    commit: '',
    provider: options.provider,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    complete: false,
    collectionComplete: false,
    equivalentInputs: false,
    memoryEvidence: {} as Record<string, ReturnType<typeof assessBenchMemory>>,
    cleanup: { consumers: 'retained', errors: [] as string[] },
    limitations: [
      'AppService JS heap is capability-probed before/after each workload outside its timer; unsupported hosts retain explicit reasons. This excludes renderer/native memory and is not a peak or forced-GC measurement; worker RSS is separate.',
      'Commit means adapter callback/Promise/return settlement; visible state is asserted separately through DOM observations.',
      'Official stable DevTools channel provenance must be recorded by the acceptance operator alongside this report.',
      'First-screen/detail firstCommitMs stays null; ready markers and wall time are not host-commit measurements.',
    ],
    results,
    failures,
  }
  let operationError: unknown
  try {
    const { stdout: commit } = await execa('git', ['rev-parse', 'HEAD'], { cwd: options.repoRoot })
    report.commit = commit.trim()
    const tarballDirectory = options.tarballDirectory ?? path.join(temporaryRoot, 'tarballs')
    if (!options.tarballDirectory) {
      await packConsumerTarballs(options.repoRoot, tarballDirectory)
    }
    for (const preset of ['normal', 'performance']) {
      process.stderr.write(`[runtime-bench] published consumer preset=${preset}\n`)
      const root = path.join(temporaryRoot, preset)
      const evidencePath = path.join(root, 'runtime-bench-evidence.json')
      const entry = results[preset] = {} as typeof results[string]
      let workerError: unknown
      try {
        const provenance = await createRuntimeBenchConsumer({
          root,
          fixtureRoot: path.join(options.repoRoot, 'apps/runtime-bench-vue'),
          tarballDirectory,
        })
        provenance.cliPath = path.relative(root, provenance.cliPath).replaceAll('\\', '/')
        entry.provenance = provenance
        if (preset === 'performance') {
          assertEquivalentBenchConsumers(results.normal!.provenance!, provenance)
          report.equivalentInputs = true
        }
        const { stdout } = await execa(process.execPath, ['--import', 'tsx', path.join(options.repoRoot, 'e2e/scripts/runtime-bench.worker.ts'), root], {
          cwd: options.repoRoot,
          env: {
            NODE_PATH: '',
            WEVU_BENCH_PROJECT: 'runtime-bench-vue',
            WEVU_BENCH_CONSUMER: '1',
            WEVU_BENCH_PRESET: preset,
            WEVU_BENCH_EVIDENCE_PATH: evidencePath,
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
        entry.result = result
      }
      catch (error) {
        failures[preset] = describeBenchError(error)
        workerError = error
      }
      try {
        entry.evidence = await readBenchEvidence(evidencePath)
        entry.result ??= entry.evidence?.result
        report.cleanup.errors.push(...(entry.evidence?.cleanupErrors ?? []).map(error => `${preset}: ${error}`))
        if (!failures[preset]) {
          assert.equal(entry.evidence?.status, 'passed', 'Missing successful worker evidence')
          assert.deepEqual(entry.evidence?.result, entry.result, 'Worker result differs from archived evidence')
        }
      }
      catch (error) {
        failures[`${preset}:evidence`] = describeBenchError(error)
        workerError = workerError ? new AggregateError([workerError, error], 'Worker and evidence read failed') : error
      }
      if (workerError) {
        throw workerError
      }
    }
  }
  catch (error) {
    operationError = error
    failures.runner = describeBenchError(error)
  }
  try {
    report.collectionComplete = ['normal', 'performance'].every(preset => Boolean(results[preset]?.result))
    for (const preset of ['normal', 'performance']) {
      report.memoryEvidence[preset] = assessBenchMemory(results[preset]?.result)
    }
    const ready = report.collectionComplete && report.equivalentInputs
      && Object.values(report.memoryEvidence).every(memory => memory.complete)
      && !Object.keys(failures).length && !report.cleanup.errors.length
    const archive = async () => {
      // 共享报告仅保存匿名化路径；失败消费者的物理位置只打印到本机诊断输出。
      const json = JSON.stringify(report, (_key, value) => typeof value === 'string'
        ? value.replaceAll(temporaryRoot, '<consumer>').replaceAll(options.repoRoot, '<repo>')
        : value, 2)
      const temporaryOutput = `${options.output}.tmp`
      await fs.writeFile(temporaryOutput, `${json}\n`)
      await fs.rename(temporaryOutput, options.output)
    }
    await fs.mkdir(path.dirname(options.output), { recursive: true })
    try {
      await archive()
      if (ready) {
        try {
          await fs.rm(temporaryRoot, { recursive: true, force: true })
          report.cleanup.consumers = 'removed'
          report.complete = true
        }
        catch (error) {
          report.cleanup.errors.push(describeBenchError(error))
          operationError = error
        }
        await archive()
      }
    }
    catch (error) {
      operationError = operationError ? new AggregateError([operationError, error], 'Benchmark and report archive failed') : error
    }
  }
  finally {
    if (report.cleanup.consumers === 'retained') {
      process.stderr.write(`[runtime-bench] incomplete evidence; retained consumers: ${temporaryRoot}\n`)
    }
  }
  if (operationError) {
    throw operationError
  }
  return report
}
