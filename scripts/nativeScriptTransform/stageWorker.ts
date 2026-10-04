import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { createOptimizedCompilerExecution } from '../optimizedCompilerAnalysis/execution'
import { optimizedScenarios } from '../optimizedCompilerAnalysis/scenarios'
import { installTransformScriptCapture } from './capture'
import { scriptTransformIdentity } from './identity'

/** 原始、优化、附加观察器三组各自独占新进程，观察器不能改变完整编译结果。 */
async function main() {
  const [variant, output] = process.argv.slice(2)
  if (!['baseline', 'optimized-js', 'captured-optimized-js'].includes(variant ?? '') || !output || process.env.WEAPP_VITE_NATIVE !== '0') {
    throw new Error('Expected <baseline|optimized-js|captured-optimized-js> <new directory>, production native disabled')
  }
  await mkdir(output)
  const sourceHashes = await scriptTransformIdentity()
  const capture = variant === 'captured-optimized-js' ? installTransformScriptCapture() : undefined
  let execution: Awaited<ReturnType<typeof createOptimizedCompilerExecution>> | undefined
  const checks: unknown[] = []
  let failure: unknown
  const cleanupErrors: unknown[] = []
  let hookSources: Record<string, string> = {}
  try {
    execution = await createOptimizedCompilerExecution(variant === 'baseline' ? 'baseline' : 'optimized-js')
    hookSources = execution.sourceHashes
    capture?.assertInstalled()
    for (const { scenario } of await optimizedScenarios()) {
      for (let iteration = 0; iteration < 2; iteration++) {
        const owner = execution
        const captured = capture ? await capture.run(scenario.id, () => owner.execute(scenario)) : undefined
        const result = captured ? captured.value : await owner.execute(scenario)
        checks.push({ scenario: scenario.id, iteration, ...result, capturedCallIndexes: captured?.records.map(record => record.callIndex) })
      }
    }
  }
  catch (error) {
    failure = serializeDiagnosticError(error)
  }
  finally {
    for (const owner of [execution, capture]) {
      try {
        owner?.dispose()
      }
      catch (error) {
        cleanupErrors.push(serializeDiagnosticError(error))
      }
    }
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await scriptTransformIdentity())
  const report = { schemaVersion: 1, variant, passed: !failure && cleanupErrors.length === 0 && sourcesUnchanged, failure, cleanupErrors, sourceHashes, hookSources, sourcesUnchanged, checks, capture: capture?.snapshot() }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report)}\n`, { flag: 'wx' })
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
