import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import type { CapturedStageResult, CapturedValue, TransformScriptCaptureRecord } from './captureTypes'
import type { NativeTransformOutcome } from './transformNative'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 Node 与参数数组跨平台启动独占的有界子进程。
import { execa } from 'execa'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { analysisOptions } from '../optimizedCompilerAnalysis/options'
import { optimizedScenarios } from '../optimizedCompilerAnalysis/scenarios'
import { sanitizeScriptDiagnostic } from '../scriptAnalysisBaseline/diagnostics'
import { readCapturedStageResult } from './captureRead'
import { serializeCaptureValue } from './captureSerialize'
import { digest, repository, scriptTransformIdentity } from './identity'
import { scriptRequestContractSnapshot, serializeTransformScriptRequest } from './request'
import { STAGE_VARIANTS, verifyStageReport } from './stageChecks'
import { loadScriptTransformer } from './transformNative'
import { inspectTransform } from './transformOracle'

const requiredPages = ['sfc-wevu', 'sfc-retail'] as const
type Comparison = ReturnType<typeof inspectTransform>
interface Observation {
  scenarioId: string
  callIndex: number
  sourceSha256: string
  requestSha256?: string
  evidenceFile: string
  evidenceSha256: string
  nativeInvoked: boolean
  nativeStatus?: NativeTransformOutcome['status']
  fallbackReason?: string
  comparisonPassed: boolean
  nativeCompared: boolean
  errorPhase?: 'request' | 'native' | 'oracle'
  error?: DiagnosticError
}

/** 每条真实捕获都独立留证，兼容差异或回退不阻断后续样本。 */
async function checkRecord(record: TransformScriptCaptureRecord, transformer: Awaited<ReturnType<typeof loadScriptTransformer>>, output: string): Promise<Observation> {
  let request: string | undefined
  let native: NativeTransformOutcome | undefined
  let rawNative: CapturedValue | undefined
  let expected: CapturedStageResult | undefined
  let comparison: Comparison | undefined
  let error: DiagnosticError | undefined
  let phase: Observation['errorPhase'] = 'request'
  let nativeInvoked = false
  let statusDifference: unknown
  try {
    if (!record.options) {
      throw new Error('Captured stage omitted options')
    }
    request = serializeTransformScriptRequest({ kind: 'captured', options: record.options })
    expected = record.status === 'returned' ? readCapturedStageResult(record) : undefined
    phase = 'native'
    nativeInvoked = true
    native = transformer.transform(record.source.code, request, (raw) => {
      rawNative = serializeCaptureValue(raw)
    })
    if (native.status === 'ok') {
      phase = 'oracle'
      if (expected) {
        comparison = inspectTransform(expected, { ...native.result }, record.source.code, record.warnings, native.warnings)
      }
      else {
        statusDifference = { expected: record.status, actual: 'returned', expectedError: record.error }
      }
    }
  }
  catch (cause) {
    error = serializeDiagnosticError(cause)
  }
  const fallbackReason = error && phase !== 'oracle'
    ? `${phase}-error: ${error.message}`
    : native && native.status !== 'ok'
      ? native.status === 'unsupported' ? native.unsupportedReason : `${native.status}: ${native.diagnostics.map(entry => entry.message).join('; ')}`
      : undefined
  const evidenceFile = `record-${String(record.callIndex).padStart(4, '0')}.json`
  const evidence = `${JSON.stringify({ schemaVersion: 1, record, request, requestSha256: request && digest(request), rawNative, native, expected, comparison, statusDifference, nativeInvoked, fallbackReason, errorPhase: error && phase, error })}\n`
  await writeFile(path.join(output, evidenceFile), evidence, { flag: 'wx' })
  return {
    scenarioId: record.scenarioId,
    callIndex: record.callIndex,
    sourceSha256: record.source.sha256,
    requestSha256: request && digest(request),
    evidenceFile,
    evidenceSha256: digest(evidence),
    nativeInvoked,
    nativeStatus: native?.status,
    fallbackReason,
    nativeCompared: Boolean(comparison || statusDifference),
    comparisonPassed: comparison?.comparisonPassed === true,
    errorPhase: error && phase,
    error,
  }
}

/** 严格校验完整编译控制组，再以真实 stage 输入检验独立 Rust 转换。 */
async function main() {
  const arguments_ = process.argv.slice(2)
  const allowDifferences = arguments_.includes('--allow-differences')
  if (arguments_.filter(value => value === '--allow-differences').length > 1) {
    throw new Error('Repeated --allow-differences')
  }
  const { binding, output } = await analysisOptions(arguments_.filter(value => value !== '--allow-differences'))
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const sourceHashesBefore = await scriptTransformIdentity()
  const bindingSha256Before = digest(await readFile(binding))
  const scrub = (value: unknown) => sanitizeScriptDiagnostic(value, [repository, output, path.dirname(binding)])
  await writeFile(path.join(output, 'identity-before.json'), `${JSON.stringify({ sourceHashes: sourceHashesBefore, bindingSha256: bindingSha256Before })}\n`, { flag: 'wx' })
  const scenarios = await optimizedScenarios()
  const expected = new Map<string, string>()
  const workers: { variant: string, reportSha256: string, checks: ReturnType<typeof verifyStageReport>['checks'], loader: unknown, records: number }[] = []
  let records: TransformScriptCaptureRecord[] = []
  const observations: Observation[] = []
  let captureReportSha256: string | undefined
  let failure: unknown
  try {
    if (!requiredPages.every(id => scenarios.some(({ scenario }) => scenario.id === id))) {
      throw new Error('Required representative page scenarios are missing')
    }
    for (const variant of STAGE_VARIANTS) {
      const directory = path.join(output, variant)
      const worker = await execa(process.execPath, ['--import', 'tsx', 'scripts/nativeScriptTransform/stageWorker.ts', variant, directory], {
        cwd: repository,
        env: { WEAPP_VITE_NATIVE: '0', NODE_OPTIONS: '' },
        timeout: 120_000,
        reject: false,
      })
      await writeFile(path.join(output, `${variant}.log`), String(scrub(`${worker.stdout}\n${worker.stderr}`)), { flag: 'wx' })
      if (worker.exitCode !== 0 || worker.signal) {
        throw new Error(`${variant}: stage worker failed; log and report are preserved`)
      }
      const raw = await readFile(path.join(directory, 'report.json'), 'utf8')
      const verified = verifyStageReport(JSON.parse(raw) as unknown, variant, sourceHashesBefore, scenarios, expected)
      workers.push({ variant, reportSha256: digest(raw), checks: verified.checks, loader: verified.loader, records: verified.records.length })
      console.log(`[native-script-transform] ${variant}: ${verified.checks.length} complete checks; ${verified.records.length} stage records`)
      if (variant === 'captured-optimized-js') {
        captureReportSha256 = digest(raw)
        records = verified.records
      }
    }
    const transformer = await loadScriptTransformer(binding)
    if (transformer.sha256 !== bindingSha256Before) {
      throw new Error('Experimental binding changed before loading')
    }
    for (const record of records) {
      observations.push(await checkRecord(record, transformer, output))
    }
  }
  catch (error) {
    failure = serializeDiagnosticError(error)
  }
  let sourceHashesAfter: Record<string, string> | undefined
  let bindingSha256After: string | undefined
  const identityErrors: DiagnosticError[] = []
  try {
    sourceHashesAfter = await scriptTransformIdentity()
  }
  catch (error) {
    identityErrors.push(serializeDiagnosticError(error))
  }
  try {
    bindingSha256After = digest(await readFile(binding))
  }
  catch (error) {
    identityErrors.push(serializeDiagnosticError(error))
  }
  await writeFile(path.join(output, 'identity-after.json'), `${JSON.stringify({ sourceHashes: sourceHashesAfter, bindingSha256: bindingSha256After, errors: identityErrors })}\n`, { flag: 'wx' })
  const sourcesUnchanged = isDeepStrictEqual(sourceHashesBefore, sourceHashesAfter)
  const bindingUnchanged = bindingSha256Before === bindingSha256After
  const realPages = requiredPages.map((scenarioId) => {
    const requiredRecords = records.filter(record => record.scenarioId === scenarioId)
    const nativeSucceeded = observations.filter(record => record.scenarioId === scenarioId && record.nativeStatus === 'ok').length
    return { scenarioId, requiredRecords: requiredRecords.length, nativeSucceeded, passed: requiredRecords.length === 2 && nativeSucceeded === requiredRecords.length }
  })
  const completed = !failure && identityErrors.length === 0 && sourcesUnchanged && bindingUnchanged
    && workers.length === STAGE_VARIANTS.length && observations.length === records.length && records.length > 0
    && observations.every(record => record.nativeInvoked && record.errorPhase !== 'oracle') && realPages.every(page => page.passed)
  const nativeCompared = observations.filter(record => record.nativeCompared).length
  const nativePassed = observations.filter(record => record.comparisonPassed).length
  const fallbackCounts: Record<string, number> = {}
  for (const { fallbackReason } of observations) {
    if (fallbackReason) {
      fallbackCounts[fallbackReason] = (fallbackCounts[fallbackReason] ?? 0) + 1
    }
  }
  const fallbackCount = observations.filter(record => record.fallbackReason).length
  const comparisonPassed = completed && fallbackCount === 0 && nativeCompared === records.length && nativePassed === records.length
  const summary = {
    schemaVersion: 1,
    completed,
    comparisonPassed,
    allowDifferences,
    failure,
    identityErrors,
    sourceHashesBefore,
    sourceHashesAfter,
    sourcesUnchanged,
    bindingSha256Before,
    bindingSha256After,
    bindingUnchanged,
    captureReportSha256,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    workers,
    completeCompilerChecks: workers.reduce((count, worker) => count + worker.checks.length, 0),
    capturedRecords: records.length,
    nativeCompared,
    nativePassed,
    fallbackCount,
    fallbackCounts,
    realPages,
    observations,
    requestContract: scriptRequestContractSnapshot(),
    scope: 'Independent whole-stage Rust diagnostic on actual optimized compiler inputs; no production integration or performance result.',
    limitations: [
      'The three fresh control workers compare complete compiler outputs, maps, warnings and diagnostics byte-for-byte.',
      'Native output is checked outside the compiler; fallback counts describe rejected outcomes and do not execute or prove runtime fallback.',
      'Every fallback keeps comparisonPassed=false; allow-differences only permits completed diagnostic runs with explicit differences.',
      'Both representative real pages must return native success for every captured record before completed can be true; semantic parity is reported separately.',
      'Raw evidence retains complete captured inputs, requests, native payload descriptors, expected results and differences; public summary is sanitized.',
      'Source and binary hashes do not establish build provenance, runtime E2E, cross-platform support or end-to-end speedup.',
    ],
  }
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(scrub(summary), null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify(scrub({ completed, comparisonPassed, nativeCompared, nativePassed, fallbackCount, realPages, failure })))
  if (!completed || (!comparisonPassed && !allowDifferences)) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(serializeDiagnosticError(error))
  process.exitCode = 1
})
