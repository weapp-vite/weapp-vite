import type { BatchCounts, Fixture, Outcome, Sample, WorkerJob, WorkerResult } from './types'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { inspect } from 'node:util'
import { serialize } from 'node:v8'
import { compileVueFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import { observeCompilerAsync } from '../../packages-runtime/wevu-compiler/src/profiling/node'
import { observeNativeAnalysis } from '../../packages/ast/src/native/observation'
import { observeBatchGc } from '../astMigrationProfile/gc'
import { assertEquivalent, errorEvidence, outcomeHash } from './outcome'
import { WARMUP } from './types'

const job = JSON.parse(await readFile(process.argv[2]!, 'utf8')) as WorkerJob
const binding = job.diagnosticBinding
  ? createRequire(import.meta.url)(job.diagnosticBinding) as { getCompilerBatchDiagnosticCounts: () => BatchCounts }
  : undefined
const rawErrors: NonNullable<WorkerResult['rawErrors']> = []

/** 计时只覆盖原生产入口调用；收集、哈希和序列化不进入该窗口。 */
async function compile(fixture: Fixture) {
  const warnings: string[] = []
  const options = {
    ...fixture.options,
    ...(fixture.autoComponents ? { autoUsingComponents: { enabled: true, resolveUsingComponentPath: async (source: string) => source } } : {}),
    warn: (warning: string) => warnings.push(warning),
  }
  let value: unknown
  let error: unknown
  let failed = false
  const started = performance.now()
  try {
    value = await compileVueFile(fixture.source, fixture.filename, options)
  }
  catch (cause) {
    error = cause
    failed = true
  }
  const wallMs = performance.now() - started
  const rssBytes = process.memoryUsage().rss
  if (failed) {
    rawErrors.push({ id: fixture.id, inspection: inspect(error, { depth: null, showHidden: true, getters: false, maxArrayLength: null, maxStringLength: null, customInspect: false }) })
  }
  const outcome: Outcome = failed
    ? { status: 'error', error: errorEvidence(error), warnings }
    : { status: 'success', value, warnings }
  return { outcome, wallMs, rssBytes, errorStack: error instanceof Error ? error.stack : undefined }
}

const result: WorkerResult = { mode: job.mode, side: job.side, samples: [], rawErrors }
try {
  for (const fixture of job.fixtures) {
    let baseline: Outcome | undefined
    // 故障路径只调用一次，其他路径先完成相同的两次预热。
    for (let round = 0; round < (job.mode === 'fault' ? 0 : WARMUP); round++) {
      const warm = await compile(fixture)
      if (baseline) {
        assertEquivalent(baseline, warm.outcome, `${fixture.id}/warmup`)
      }
      baseline = warm.outcome
    }
    let sample: Sample
    if (job.mode === 'timing') {
      const measured = await compile(fixture)
      sample = { id: fixture.id, ...measured, outputSha256: outcomeHash(measured.outcome) }
    }
    else {
      const before = binding?.getCompilerBatchDiagnosticCounts() ?? { calls: 0, scripts: 0 }
      const observed = await observeBatchGc(() => observeNativeAnalysis(() => observeCompilerAsync(() => compile(fixture))))
      const measured = observed.value.value.value
      const after = binding?.getCompilerBatchDiagnosticCounts() ?? { calls: 0, scripts: 0 }
      sample = {
        id: fixture.id,
        ...measured,
        outputSha256: outcomeHash(measured.outcome),
        diagnostic: {
          compiler: observed.value.value.observation,
          native: observed.value.stats,
          compilerBatch: { calls: after.calls - before.calls, scripts: after.scripts - before.scripts },
          gc: { ...observed.gc, scope: 'one independent observed compiler call; warmup and paired timing excluded' },
        },
      }
    }
    if (baseline) {
      assertEquivalent(baseline, sample.outcome, `${fixture.id}/measured`)
    }
    result.samples.push(sample)
  }
}
catch (error) {
  result.failure = error instanceof Error ? error.stack ?? error.message : String(error)
}
await writeFile(job.resultFile, serialize(result), { flag: 'wx', mode: 0o600 })
if (result.failure) {
  process.exitCode = 1
}
