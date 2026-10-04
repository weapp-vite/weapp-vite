import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 参数数组与当前 Node 路径保证三平台串行子进程一致。
import { execa } from 'execa'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { TIMING_CORPORA } from '../scriptAnalysisBaseline/timing/types'
import { serializeDiagnosticError } from './diagnosticError'
import { OPTIMIZED_COMPILER_VARIANTS } from './execution'
import { digest, optimizedSourceIdentity, repository } from './identity'
import { analysisOptions } from './options'
import { verifyCpuWorker } from './profileCheck'
import { optimizedScenarios } from './scenarios'
import { object, verifyOptimizedCheck, verifyStartup } from './verify'

/** 先校验全部语义场景，再逐语料逐实现采样；原始图留本地，只输出脱敏计数摘要。 */
async function main() {
  const { binding, output } = await analysisOptions(process.argv.slice(2))
  const sourceHashes = await optimizedSourceIdentity()
  const bindingSha256 = digest(await readFile(binding))
  const scenarios = await optimizedScenarios()
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  const child = async (script: string, args: string[], log: string) => {
    const result = await execa(process.execPath, ['--import', 'tsx', script, ...args], {
      cwd: repository,
      env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
      timeout: 180_000,
      reject: false,
    })
    await writeFile(path.join(output, log), String(scrub(`${result.stdout}\n${result.stderr}`)), { flag: 'wx' })
    if (result.exitCode !== 0 || result.signal) {
      throw new Error(`${script} failed; its private report and log are preserved`)
    }
  }
  let failure: unknown
  let correctness: unknown
  const runs: Awaited<ReturnType<typeof verifyCpuWorker>>[] = []
  try {
    const correctnessDirectory = path.join(output, 'correctness')
    await child('scripts/optimizedCompilerAnalysis/check.ts', [`--binding=${binding}`, `--output=${correctnessDirectory}`], 'correctness.log')
    const raw = await readFile(path.join(correctnessDirectory, 'report.json'), 'utf8')
    const report = object(JSON.parse(raw) as unknown)
    if (report.passed !== true || report.sourcesUnchanged !== true || report.bindingUnchanged !== true
      || !isDeepStrictEqual(report.sourceHashes, sourceHashes) || report.bindingSha256 !== bindingSha256) {
      throw new Error('Full correctness gate identity or result differs')
    }
    correctness = { reportSha256: digest(raw), checks: scenarios.length * 2 * OPTIMIZED_COMPILER_VARIANTS.length }
    const baseline = verifyStartup(JSON.parse(await readFile(path.join(correctnessDirectory, 'baseline/report.json'), 'utf8')) as unknown, 'baseline', sourceHashes, bindingSha256)
    if (!Array.isArray(baseline.checks) || baseline.checks.length !== scenarios.length * 2) {
      throw new Error('Missing original compiler correctness oracle')
    }
    const oracles = new Map(baseline.checks.map((value, index) => {
      const check = verifyOptimizedCheck(value, scenarios[Math.floor(index / 2)]!, 'baseline', index % 2)
      return [check.scenario, check.output]
    }))
    for (const id of TIMING_CORPORA) {
      const found = scenarios.find(entry => entry.scenario.id === id)
      if (!found || found.scenario.kind !== 'sfc') {
        throw new Error('Missing representative full SFC scenario')
      }
      const entry = { ...found, bindingCoverage: 'batched' as const }
      for (const variant of OPTIMIZED_COMPILER_VARIANTS) {
        const directory = path.join(output, `${id}-${variant}`)
        await child('scripts/optimizedCompilerAnalysis/cpuWorker.ts', [variant, binding, id, directory], `${id}-${variant}.log`)
        const raw = await readFile(path.join(directory, 'report.json'), 'utf8')
        runs.push(await verifyCpuWorker(raw, directory, entry, variant, sourceHashes, bindingSha256, oracles.get(id)!))
        console.log(`[optimized-cpu] ${id}/${variant}: verified 20 compiler profiles`)
      }
    }
  }
  catch (error) {
    failure = scrub(serializeDiagnosticError(error))
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await optimizedSourceIdentity())
  const bindingUnchanged = bindingSha256 === digest(await readFile(binding))
  const report = {
    schemaVersion: 1,
    passed: !failure && sourcesUnchanged && bindingUnchanged && runs.length === 15,
    failure,
    sourceHashes,
    sourcesUnchanged,
    bindingSha256,
    bindingUnchanged,
    correctness,
    runs,
    limitations: [
      'V8 main-thread attribution only: this is not a wall-time speedup, cold-build, Vite/HMR, memory or runtime acceptance experiment.',
      'Each corpus/variant uses a fresh worker; initial compile plus 14 warmups precede 20 independent inspector windows at 1000 microseconds.',
      'Only compileVueFile is inside the requested window; inspector start/stop plumbing and asynchronous continuation can still appear in samples.',
      'Input hashing, metrics, output serialization/comparison and profile writes are outside sampling. Between-call work can still perturb GC and scheduling.',
      'Every initial, warmup and sampled output is checked in full inside each worker, then its digest is checked against the original compiler by the collector.',
      'Loader controls and diagnostic counters remain inside compilation. Variant order is fixed, not randomized or suitable for paired timing inference.',
      'Merged trees provide counts only, without a synthetic timeline. GC, idle and unattributed samples stay in the denominator; inclusive shares overlap.',
      'V8 sampling does not provide Rust/native internal stacks, every process thread, process CPU duration or sourcemap-resolved original locations.',
      'Raw profiles and complete worker outputs remain private; this summary is sanitized separately from the exact byte comparisons and hashes.',
      'Source/binary hashes do not identify every installed dependency file or prove the binary build provenance. Shared-machine contention is not controlled.',
    ],
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(scrub(report), null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ passed: report.passed, workers: runs.length, failure }))
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
