import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import type { SemanticWorkerRequest } from './semantic/types'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { analysisOptions } from '../optimizedCompilerAnalysis/options'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { digest, repository, scriptTransformIdentity } from './identity'
import { compilerArtifacts, ensure } from './semantic/artifacts'
import { semanticDependencyIdentity } from './semantic/dependencies'
import { readSemanticCompilerEvidence } from './semantic/evidence'
import { runSemanticProcess } from './semantic/process'
import { compareSemanticExecutions, verifySemanticExecution } from './semantic/results'
import { semanticCoverage, semanticDependencyFiles } from './semantic/scenarios/index'

/** 重跑严格编译诊断，再在八个独立进程中原样执行两个页面的完整 JS/native 产物。 */
async function main() {
  const { binding, output } = await analysisOptions(process.argv.slice(2))
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourcesBefore = await scriptTransformIdentity()
  const bindingBefore = digest(await readFile(binding))
  const dependenciesBefore = await semanticDependencyIdentity(semanticDependencyFiles)
  const artifacts = compilerArtifacts(output)
  const compiler = compilerArtifacts(path.join(output, 'compiler'))
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  const save = async (filename: string, value: unknown) => {
    const raw = `${JSON.stringify(value, null, 2)}\n`
    await writeFile(path.join(output, filename), raw, { flag: 'wx' })
    await artifacts.read(filename)
    return { filename, sha256: digest(raw) }
  }
  await save('identity-before.json', { sourceHashes: sourcesBefore, bindingSha256: bindingBefore, dependencies: dependenciesBefore })
  let evidence: Awaited<ReturnType<typeof readSemanticCompilerEvidence>> | undefined
  let compilerExitCode: number | undefined
  let failure: DiagnosticError | undefined
  const comparisons: { scenarioId: string, iteration: number, comparisonPassed: boolean, differentFields: string[], filename: string, sha256: string }[] = []
  try {
    compilerExitCode = await runSemanticProcess(['--import', 'tsx', 'scripts/nativeScriptTransform/integratedCheck.ts', `--binding=${binding}`, `--output=${path.join(output, 'compiler')}`], path.join(output, 'compiler-run'), 600_000)
    await artifacts.read('compiler-run.process.json')
    evidence = await readSemanticCompilerEvidence(compiler, sourcesBefore, bindingBefore, compilerExitCode)
    console.log(`[semantic-script-transform] replayed strict compiler evidence; comparisonPassed=${evidence.compilerComparisonPassed}`)
    for (const pair of evidence.pairs) {
      const execute = async (side: 'js' | 'native') => {
        const label = `${pair.scenarioId}-${pair.iteration}-${side}`
        const request: SemanticWorkerRequest = {
          schemaVersion: 1,
          scenarioId: pair.scenarioId,
          filename: `${pair.scenarioId}.mjs`,
          code: side === 'js' ? pair.expectedCode : pair.nativeCode,
          timeoutMs: 10_000,
        }
        const requestEvidence = await save(`${label}.request.json`, request)
        const reportFilename = `${label}.report.json`
        const exitCode = await runSemanticProcess(['--experimental-vm-modules', '--import', 'tsx', 'scripts/nativeScriptTransform/semantic/worker.ts', path.join(output, requestEvidence.filename), path.join(output, reportFilename)], path.join(output, label), 30_000)
        await artifacts.read(`${label}.process.json`)
        const raw = await artifacts.read(reportFilename)
        const report = verifySemanticExecution(raw, request, semanticCoverage(pair.scenarioId), semanticDependencyFiles, exitCode)
        return { report, exitCode, requestEvidence, reportEvidence: { filename: reportFilename, sha256: artifacts.hashes[reportFilename]! } }
      }
      const expected = await execute('js')
      const actual = await execute('native')
      const comparison = compareSemanticExecutions(expected.report, actual.report)
      const { expectedCode, nativeCode, ...identity } = pair
      ensure(digest(expectedCode) === expected.report.loadedCodeSha256 && digest(nativeCode) === actual.report.loadedCodeSha256, 'Worker did not execute the complete compiler output')
      const saved = await save(`${pair.scenarioId}-${pair.iteration}.comparison.json`, { ...identity, expected, actual, comparison })
      comparisons.push({ scenarioId: pair.scenarioId, iteration: pair.iteration, ...comparison, ...saved })
      console.log(`[semantic-script-transform] ${pair.scenarioId} iteration ${pair.iteration}: js=${expected.report.passed}; native=${actual.report.passed}; comparison=${comparison.comparisonPassed}`)
    }
  }
  catch (error) {
    failure = serializeDiagnosticError(error)
  }
  let sourcesAfter: typeof sourcesBefore | undefined
  let bindingAfter: string | undefined
  let dependenciesAfter: typeof dependenciesBefore | undefined
  const identityErrors: DiagnosticError[] = []
  try {
    sourcesAfter = await scriptTransformIdentity()
    bindingAfter = digest(await readFile(binding))
    dependenciesAfter = await semanticDependencyIdentity(semanticDependencyFiles)
    await compiler.verify()
    await artifacts.verify()
  }
  catch (error) {
    identityErrors.push(serializeDiagnosticError(error))
  }
  await save('identity-after.json', { sourceHashes: sourcesAfter, bindingSha256: bindingAfter, dependencies: dependenciesAfter, identityErrors })
  const sourcesUnchanged = isDeepStrictEqual(sourcesBefore, sourcesAfter)
  const bindingUnchanged = bindingBefore === bindingAfter
  const dependenciesUnchanged = isDeepStrictEqual(dependenciesBefore, dependenciesAfter)
  const completed = !failure && identityErrors.length === 0 && sourcesUnchanged && bindingUnchanged && dependenciesUnchanged && comparisons.length === 4 && !!evidence
  const semanticComparisonPassed = completed && comparisons.every(value => value.comparisonPassed)
  const compilerComparisonPassed = evidence?.compilerComparisonPassed === true
  const comparisonPassed = semanticComparisonPassed && compilerComparisonPassed
  const summary = {
    schemaVersion: 1,
    completed,
    comparisonPassed,
    semanticComparisonPassed,
    compilerComparisonPassed,
    compilerExitCode,
    failure,
    identityErrors,
    sourcesUnchanged,
    bindingUnchanged,
    dependenciesUnchanged,
    bindingSha256: bindingBefore,
    sourceHashes: sourcesBefore,
    dependencies: dependenciesBefore,
    compilerEvidence: evidence && { ...evidence, pairs: evidence.pairs.map(({ expectedCode, nativeCode, ...identity }) => identity) },
    compilerArtifacts: compiler.hashes,
    semanticArtifacts: artifacts.hashes,
    comparisons,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    scope: 'Controlled Node execution of unchanged complete compiler scripts, with real reactivity/template/inline helpers and explicit fixture host/business imports.',
    limitations: [
      'Registration, platform, network, navigation and business imports are controlled fixture substitutes. Full Wevu Component host, Stable WeChat DevTools and browser runtimes are not executed.',
      'Two real source pages, each compiled twice and executed in separate JS/native worker processes; repeated iterations are not distinct scenarios.',
      'Independent assertions plus actual inline/computed/lifecycle invocation evidence supplement equality of snapshots and traces. Function snapshots alone do not prove behavior.',
      'Async evidence covers tracked host promises and observed state/return ordering, not all possible detached JavaScript continuations.',
      'Workspace helper source/dist/manifests are hashed before and after; installed dependencies and the Node toolchain are not a full byte closure.',
      'Strict compiler source-map differences remain failures even if controlled semantic observations agree. No production coverage expansion, performance or end-to-end acceptance.',
      'Full requests, output scripts, observations and child logs stay in the local evidence directory; only the sanitized summary is suitable for publication.',
    ],
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(scrub(summary), null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify(scrub({ completed, comparisonPassed, semanticComparisonPassed, compilerComparisonPassed, comparisons: comparisons.length, failure })))
  if (!comparisonPassed) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(serializeDiagnosticError(error))
  process.exitCode = 1
})
