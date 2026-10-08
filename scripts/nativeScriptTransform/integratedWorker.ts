import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import type { IntegratedCheck, IntegratedMode, IntegratedWorkerReport } from './integratedTypes'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { createOptimizedCompilerExecution } from '../optimizedCompilerAnalysis/execution'
import { optimizedScenarios } from '../optimizedCompilerAnalysis/scenarios'
import { digest, scriptTransformIdentity } from './identity'
import { installIntegratedTransform } from './integrated'

/** 独占进程真实执行完整 compiler，native 产物及失败回退都保留原始输出与 map。 */
async function main() {
  const [variant, output, binding, ...extra] = process.argv.slice(2)
  if (!['control-js', 'native'].includes(variant ?? '') || !output || extra.length || process.env.WEAPP_VITE_NATIVE !== '0'
    || (variant === 'native') !== (binding !== undefined)) {
    throw new Error('Expected <control-js|native> <new output directory> [absolute experimental .node], production native disabled')
  }
  await mkdir(output)
  const sourceHashesBefore = await scriptTransformIdentity()
  let sourceHashesAfter: Record<string, string> | undefined
  let integration: Awaited<ReturnType<typeof installIntegratedTransform>> | undefined
  let execution: Awaited<ReturnType<typeof createOptimizedCompilerExecution>> | undefined
  const checks: IntegratedCheck[] = []
  let failure: DiagnosticError | undefined
  const cleanupErrors: DiagnosticError[] = []
  let hookSources: Record<string, string> = {}
  let bindingSha256After: string | undefined
  try {
    integration = await installIntegratedTransform({ mode: variant as IntegratedMode, binding })
    execution = await createOptimizedCompilerExecution('optimized-js')
    hookSources = execution.sourceHashes
    integration.assertInstalled()
    for (const { scenario } of await optimizedScenarios()) {
      for (let iteration = 0; iteration < 2; iteration++) {
        const owner = execution
        const { value, records } = await integration.run(scenario.id, () => owner.execute(scenario))
        checks.push({ scenario: scenario.id, iteration, ...value, integratedCallIndexes: records.map(record => record.callIndex) })
      }
    }
  }
  catch (error) {
    failure = serializeDiagnosticError(error)
  }
  finally {
    for (const owner of [execution, integration]) {
      try {
        owner?.dispose()
      }
      catch (error) {
        cleanupErrors.push(serializeDiagnosticError(error))
      }
    }
  }
  try {
    sourceHashesAfter = await scriptTransformIdentity()
    if (binding) {
      bindingSha256After = digest(await readFile(binding))
    }
  }
  catch (error) {
    cleanupErrors.push(serializeDiagnosticError(error))
  }
  const snapshot = integration?.snapshot()
  const records = snapshot?.records ?? []
  const realPages = ['sfc-wevu', 'sfc-retail'].map((scenarioId) => {
    const required = records.filter(record => record.scenarioId === scenarioId)
    const nativeSucceeded = required.filter(record => record.used === 'native' && record.nativeStatus === 'ok' && record.status === 'returned').length
    return { scenarioId, requiredRecords: required.length, nativeSucceeded, passed: required.length === 2 && nativeSucceeded === 2 }
  })
  const sourcesUnchanged = isDeepStrictEqual(sourceHashesBefore, sourceHashesAfter)
  const bindingUnchanged = variant === 'control-js' || Boolean(snapshot?.bindingSha256 && snapshot.bindingSha256 === bindingSha256After)
  const report: IntegratedWorkerReport = {
    schemaVersion: 1,
    variant: variant as IntegratedMode,
    passed: !failure && cleanupErrors.length === 0 && sourcesUnchanged && bindingUnchanged
      && Boolean(records.length) && records.every(record => record.status !== 'active' && record.evidenceErrors.length === 0)
      && (variant === 'control-js' || realPages.every(page => page.passed)),
    failure,
    cleanupErrors,
    sourceHashesBefore,
    sourceHashesAfter,
    sourcesUnchanged,
    hookSources,
    bindingSha256Before: snapshot?.bindingSha256,
    bindingSha256After,
    bindingUnchanged,
    checks,
    integration: snapshot,
    nativeCalls: records.reduce((count, record) => count + record.nativeCalls, 0),
    nativeSucceeded: records.filter(record => record.used === 'native' && record.status === 'returned').length,
    fallbackCalls: records.reduce((count, record) => count + record.fallbackCalls, 0),
    realPages,
    scope: 'Diagnostic complete compileVueFile/script execution with actual stage replacement and JS fallback; passed is execution coverage, not native output parity or runtime acceptance.',
  }
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report)}\n`, { flag: 'wx' })
  if (!report.passed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(serializeDiagnosticError(error))
  process.exitCode = 1
})
