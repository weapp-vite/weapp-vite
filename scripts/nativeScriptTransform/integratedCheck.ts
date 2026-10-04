import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import type { TransformScriptCaptureRecord } from './captureTypes'
import type { IntegratedMode } from './integratedTypes'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 新进程和参数数组跨平台隔离编译模块缓存及加载器。
import { execa } from 'execa'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { analysisOptions } from '../optimizedCompilerAnalysis/options'
import { optimizedScenarios } from '../optimizedCompilerAnalysis/scenarios'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { decodeCapturedData, readCapturedStageResult } from './captureRead'
import { inspectCompilerOutputs } from './compilerOracle'
import { digest, repository, scriptTransformIdentity } from './identity'
import { verifyIntegratedReport } from './integratedChecks'
import { STAGE_VARIANTS, verifyStageReport } from './stageChecks'
import { inspectTransform } from './transformOracle'

interface Evidence { filename: string, sha256: string }
interface ComparisonSummary extends Evidence { scenarioId: string, iteration: number, comparisonPassed: boolean, exactOutput: boolean, nativeCalls: number, fallbackCalls: number }

/** 原始控制组保持逐字门禁，native 的真实完整返回值单独保存并严格比较。 */
async function main() {
  const args = process.argv.slice(2)
  const allowDifferences = args.includes('--allow-differences')
  if (args.filter(value => value === '--allow-differences').length > 1) {
    throw new Error('Repeated --allow-differences')
  }
  const { binding, output } = await analysisOptions(args.filter(value => value !== '--allow-differences'))
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourcesBefore = await scriptTransformIdentity()
  const bindingBefore = digest(await readFile(binding))
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  const save = async (filename: string, value: unknown): Promise<Evidence> => {
    const raw = `${JSON.stringify(value)}\n`
    await writeFile(path.join(output, filename), raw, { flag: 'wx' })
    return { filename, sha256: digest(raw) }
  }
  await save('identity-before.json', { sourceHashes: sourcesBefore, bindingSha256: bindingBefore })
  const scenarios = await optimizedScenarios()
  const expected = new Map<string, string>()
  const controlWorkers: unknown[] = []
  const integratedWorkers: unknown[] = []
  const comparisons: ComparisonSummary[] = []
  const stageComparisons: (Evidence & { scenarioId: string, callIndex: number, comparisonPassed: boolean })[] = []
  let captured: TransformScriptCaptureRecord[] = []
  let native: ReturnType<typeof verifyIntegratedReport> | undefined
  let failure: DiagnosticError | undefined
  const worker = async (filename: string, args: string[], label: string) => {
    const result = await execa(process.execPath, ['--import', 'tsx', `scripts/nativeScriptTransform/${filename}`, ...args], {
      cwd: repository,
      env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
      timeout: 120_000,
      reject: false,
    })
    await writeFile(path.join(output, `${label}.log`), String(scrub(`${result.stdout}\n${result.stderr}`)), { flag: 'wx' })
    if (result.exitCode !== 0 || result.signal) {
      throw new Error(`${label}: worker failed; full report and log are preserved`)
    }
    const raw = await readFile(path.join(output, label, 'report.json'), 'utf8')
    return { value: JSON.parse(raw) as unknown, sha256: digest(raw) }
  }
  try {
    for (const variant of STAGE_VARIANTS) {
      const report = await worker('stageWorker.ts', [variant, path.join(output, variant)], variant)
      const verified = verifyStageReport(report.value, variant, sourcesBefore, scenarios, expected)
      controlWorkers.push({ variant, reportSha256: report.sha256, ...verified, records: verified.records.length })
      if (variant === 'captured-optimized-js') {
        captured = verified.records
      }
      console.log(`[integrated-script-transform] ${variant}: ${verified.checks.length} byte checks`)
    }
    for (const mode of ['control-js', 'native'] as const satisfies readonly IntegratedMode[]) {
      const label = `integrated-${mode}`
      const report = await worker('integratedWorker.ts', [mode, path.join(output, label), ...(mode === 'native' ? [binding] : [])], label)
      const verified = verifyIntegratedReport(report.value, mode, sourcesBefore, bindingBefore, scenarios, captured, expected)
      const { checks, records, ...summary } = verified
      integratedWorkers.push({ mode, reportSha256: report.sha256, ...summary, records: records.length, checks: checks.length })
      if (mode === 'native') {
        native = verified
      }
      console.log(`[integrated-script-transform] ${mode}: ${checks.length} complete calls; ${verified.nativeSucceeded} native; ${verified.fallbackCalls} fallback`)
    }
    if (!native) {
      throw new Error('Missing native compiler worker')
    }
    for (const [index, check] of native.checks.entries()) {
      const scenario = scenarios[Math.floor(index / 2)]!.scenario
      const baseline = expected.get(check.scenario)!
      const comparison = inspectCompilerOutputs(baseline, check.output, scenario)
      const evidence = await save(`compiler-${String(index).padStart(4, '0')}.json`, { scenario, expected: baseline, actual: check, comparison })
      const owned = check.integratedCallIndexes.map(index => native!.records[index]!)
      comparisons.push({ ...evidence, scenarioId: scenario.id, iteration: check.iteration, comparisonPassed: comparison.comparisonPassed, exactOutput: comparison.exactOutput, nativeCalls: owned.filter(record => record.used === 'native').length, fallbackCalls: owned.reduce((sum, record) => sum + record.fallbackCalls, 0) })
    }
    for (const record of native.records) {
      if (record.used !== 'native') {
        continue
      }
      const control = captured[record.callIndex]!
      const actual = decodeCapturedData(record.result!) as ReturnType<typeof readCapturedStageResult>
      const raw = decodeCapturedData(record.rawNative!) as { warnings: string[] }
      const comparison = inspectTransform(readCapturedStageResult(control), actual, record.source.code, control.warnings, raw.warnings)
      const evidence = await save(`stage-${String(record.callIndex).padStart(4, '0')}.json`, { control, integrated: record, comparison })
      stageComparisons.push({ ...evidence, scenarioId: record.scenarioId, callIndex: record.callIndex, comparisonPassed: comparison.comparisonPassed })
    }
  }
  catch (error) {
    failure = serializeDiagnosticError(error)
  }
  let sourcesAfter: Record<string, string> | undefined
  let bindingAfter: string | undefined
  const identityErrors: DiagnosticError[] = []
  try {
    sourcesAfter = await scriptTransformIdentity()
    bindingAfter = digest(await readFile(binding))
  }
  catch (error) {
    identityErrors.push(serializeDiagnosticError(error))
  }
  await save('identity-after.json', { sourceHashes: sourcesAfter, bindingSha256: bindingAfter, identityErrors })
  const sourcesUnchanged = isDeepStrictEqual(sourcesBefore, sourcesAfter)
  const bindingUnchanged = bindingBefore === bindingAfter
  const completed = !failure && identityErrors.length === 0 && sourcesUnchanged && bindingUnchanged
    && controlWorkers.length === 3 && integratedWorkers.length === 2 && comparisons.length === scenarios.length * 2
    && stageComparisons.length === native?.nativeSucceeded
  const comparisonPassed = completed && native?.fallbackCalls === 0
    && comparisons.every(value => value.comparisonPassed) && stageComparisons.every(value => value.comparisonPassed)
  const summary = {
    schemaVersion: 1,
    completed,
    comparisonPassed,
    allowDifferences,
    failure,
    identityErrors,
    sourceHashesBefore: sourcesBefore,
    sourceHashesAfter: sourcesAfter,
    sourcesUnchanged,
    bindingSha256Before: bindingBefore,
    bindingSha256After: bindingAfter,
    bindingUnchanged,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    controlWorkers,
    integratedWorkers,
    completeControlByteChecks: controlWorkers.length === 3 && integratedWorkers.length >= 1 ? scenarios.length * 2 * 4 : undefined,
    nativeCalls: native?.nativeCalls,
    nativeSucceeded: native?.nativeSucceeded,
    fallbackCalls: native?.fallbackCalls,
    completeCompilerComparisons: comparisons,
    stageComparisons,
    realPages: native?.realPages,
    scope: 'Native output returned at the actual transformScript entry inside isolated complete compiler calls; diagnostic, not production or performance acceptance.',
    limitations: [
      'The four JS control workers must preserve every complete output, map, warning and error byte-for-byte.',
      'Each actual native success is returned to compileVueFile or the direct stage caller. Unsupported outcomes execute the original JS stage once; fallback output must match the control exactly.',
      'Full native compiler outputs, composed maps, warnings and errors are retained independently; byte differences and structural/map compatibility are separate evidence.',
      'All stage origin differences remain failures, including differences where baseline provenance is defective. A completed diagnostic is not compatibility acceptance.',
      'Fallback coverage prevents comparisonPassed even when the resulting complete JS output matches. Both representative pages must use native twice.',
      'No real mini-program runtime, browser, build/HMR timing, memory benchmark, or cross-platform acceptance is performed by this runner.',
    ],
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(scrub(summary), null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify(scrub({ completed, comparisonPassed, nativeSucceeded: native?.nativeSucceeded, fallbackCalls: native?.fallbackCalls, compilerPassed: comparisons.filter(value => value.comparisonPassed).length, failure })))
  if (!completed || (!comparisonPassed && !allowDifferences)) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(serializeDiagnosticError(error))
  process.exitCode = 1
})
