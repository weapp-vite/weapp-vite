import type { Input, Options, Run, Side } from './contract'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runCollector } from '../performanceGate/process'
import { normalizeRoots } from './artifacts'
import { assertCollectionActive } from './contract'
import { createDiagnosticPreload, readDiagnosticObservation, validNativeDiagnostic } from './diagnosticObservation'
import { collectHmr } from './hmr'
import { collectorEnvironment, createDiagnosticBinding, readNativeTrace } from './native'
import { stageInput } from './stage'

/** 准备、诊断、计时分离；所有进程通过既有有界采集器串行运行。 */
export async function collectRun(options: Options, input: Input, kind: Run['kind'], side: Side, pair: number, batch: Run['batch'], diagnostic = false): Promise<Run> {
  const directory = path.join(options.output, diagnostic ? 'diagnostic' : batch, kind, input.id, String(pair), side)
  let result: Run = { input: input.id, kind, side, pair, batch, marker: `native-${batch}-${pair}`, samples: [], native: { calls: 0, failures: 0, processes: 0 } }
  await mkdir(directory, { recursive: true })
  try {
    assertCollectionActive(options)
    const staged = await stageInput(options, input)
    result.inputDigest = staged.inputDigest
    result.sourceDigest = staged.sourceDigest
    await writeFile(path.join(directory, 'input-manifest.json'), JSON.stringify(staged.manifest))
    assertCollectionActive(options)
    if (kind === 'hmr') {
      await collectHmr(options, input, result, staged.project, directory, staged.inputDigest)
    }
    else {
      await runCollector(process.execPath, [path.join(options.root, 'packages/weapp-vite/bin/weapp-vite.js'), 'prepare', staged.project], {
        cwd: options.root,
        logFile: path.join(directory, 'prepare.log'),
        timeoutMs: 120_000,
        env: collectorEnvironment(side, options.nativePath),
        redact: [staged.project, options.root],
      })
      let nativePath = options.nativePath
      assertCollectionActive(options)
      const trace = path.join(directory, 'native-calls.jsonl')
      const processTrace = path.join(directory, 'native-processes.jsonl')
      let preload: string | undefined
      if (diagnostic) {
        nativePath = path.join(options.output, '.workspace/diagnostic-binding.cjs')
        await createDiagnosticBinding(options.nativePath, nativePath, trace)
        preload = path.join(options.output, '.workspace/diagnostic-preload.cjs')
        await createDiagnosticPreload(preload, processTrace)
      }
      const jobFile = path.join(directory, 'job.json')
      await writeFile(jobFile, JSON.stringify({ root: options.root, project: staged.project, directory, inputDigest: staged.inputDigest, preload, result }))
      try {
        assertCollectionActive(options)
        await runCollector(process.execPath, ['--import', 'tsx', 'scripts/benchmarkNativeAnalysis/buildWorker.ts'], {
          cwd: options.root,
          logFile: path.join(directory, 'collector.log'),
          timeoutMs: 15 * 60_000,
          env: { ...collectorEnvironment(side, nativePath), NATIVE_BENCHMARK_JOB_FILE: jobFile },
          redact: [staged.project, options.root],
        })
      }
      finally {
        const saved = await readFile(path.join(directory, 'sample.json'), 'utf8').catch(() => undefined)
        if (saved) {
          result = JSON.parse(saved) as Run
        }
        await rm(jobFile, { force: true })
      }
      if (diagnostic) {
        const observation = await readDiagnosticObservation(processTrace, result.native.expectedProcessIds ?? [])
        const counters = await readNativeTrace(trace)
        result.native = { ...counters, observation, coverage: counters.calls ? 'exercised' : 'not-exercised' }
        if (!validNativeDiagnostic(result)) {
          throw new Error('Native diagnostic is incomplete, observed load/execution fallback, or the fixed target was not exercised')
        }
      }
    }
  }
  catch (error) {
    result.error = normalizeRoots(String(error), [options.output, options.root])
  }
  finally {
    try {
      await rm(path.join(options.output, '.workspace'), { recursive: true, force: true })
    }
    catch (error) {
      result.error = `Owned workspace cleanup failed: ${normalizeRoots(String(error), [options.output, options.root])}`
    }
    await writeFile(path.join(directory, 'sample.json'), JSON.stringify(result))
  }
  return result
}
