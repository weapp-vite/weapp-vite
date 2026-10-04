import type { OptimizedCompilerVariant } from './execution'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { serializeDiagnosticError } from './diagnosticError'
import { createOptimizedCompilerExecution, OPTIMIZED_COMPILER_VARIANTS } from './execution'
import { digest, optimizedSourceIdentity, repository } from './identity'
import { optimizedScenarios } from './scenarios'

/** 每个组合模式独占进程，先验证所有语义边界；不收集性能数值。 */
async function main() {
  const [variant, bindingPath, output] = process.argv.slice(2) as [OptimizedCompilerVariant, string, string]
  if (!OPTIMIZED_COMPILER_VARIANTS.includes(variant) || !bindingPath || !output || process.env.WEAPP_VITE_NATIVE !== '0') {
    throw new Error('Expected <variant> <experimental .node> <new output directory> and production native disabled')
  }
  await mkdir(output)
  const sourceHashes = await optimizedSourceIdentity()
  const bindingSha256 = digest(await readFile(bindingPath))
  const checks: unknown[] = []
  let hookSources: Record<string, string> = {}
  let failure: unknown
  const cleanupErrors: unknown[] = []
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(serializeDiagnosticError(value), [repository, output, path.dirname(bindingPath)])
  let execution: Awaited<ReturnType<typeof createOptimizedCompilerExecution>> | undefined
  try {
    execution = await createOptimizedCompilerExecution(variant, bindingPath)
    hookSources = execution.sourceHashes
    if (variant === 'optimized-native' && execution.bindingSha256 !== bindingSha256) {
      throw new Error('Loaded binding identity differs from the worker input')
    }
    for (const entry of await optimizedScenarios()) {
      for (let iteration = 0; iteration < 2; iteration++) {
        checks.push({ scenario: entry.scenario.id, iteration, ...await execution.execute(entry.scenario, { nativeFault: variant === 'optimized-native' ? entry.nativeFault : undefined }) })
      }
    }
  }
  catch (error) {
    failure = scrub(error)
  }
  finally {
    try {
      execution?.dispose()
    }
    catch (error) {
      cleanupErrors.push(scrub(error))
    }
  }
  const sourcesUnchanged = isDeepStrictEqual(sourceHashes, await optimizedSourceIdentity())
  const bindingUnchanged = bindingSha256 === digest(await readFile(bindingPath))
  const report = {
    schemaVersion: 1,
    variant,
    passed: !failure && cleanupErrors.length === 0 && sourcesUnchanged && bindingUnchanged,
    failure,
    cleanupErrors,
    sourceHashes,
    hookSources,
    sourcesUnchanged,
    bindingSha256,
    bindingUnchanged,
    checks,
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report)}\n`, { flag: 'wx' })
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
