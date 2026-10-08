import type { OptimizedScenario } from '../optimizedCompilerAnalysis/scenarios'
import type { TransformScriptCaptureRecord } from './captureTypes'
import { Buffer } from 'node:buffer'
import { isDeepStrictEqual } from 'node:util'
import { expectedHookSources, object, verifyOptimizedCheck, verifyScriptCoverage } from '../optimizedCompilerAnalysis/verify'
import { readCapturedStageResult } from './captureRead'
import { captureTarget } from './captureSource'
import { digest } from './identity'

export const STAGE_VARIANTS = ['baseline', 'optimized-js', 'captured-optimized-js'] as const
export type StageVariant = typeof STAGE_VARIANTS[number]

/** 先验证无观察器的完整 oracle，再允许使用带观察器的输入记录。 */
export function verifyStageReport(raw: unknown, variant: StageVariant, sourceHashes: Record<string, string>, scenarios: OptimizedScenario[], expected: Map<string, string>) {
  const report = object(raw)
  const compilerVariant = variant === 'baseline' ? 'baseline' : 'optimized-js'
  if (report.schemaVersion !== 1 || report.variant !== variant || report.passed !== true || report.failure
    || report.sourcesUnchanged !== true || !isDeepStrictEqual(report.sourceHashes, sourceHashes)
    || !isDeepStrictEqual(report.hookSources, expectedHookSources(compilerVariant, sourceHashes))
    || !Array.isArray(report.cleanupErrors) || report.cleanupErrors.length || !Array.isArray(report.checks) || report.checks.length !== scenarios.length * 2) {
    throw new Error(`${variant}: incomplete worker, identity or cleanup`)
  }
  const checks = report.checks.map((check, index) => verifyOptimizedCheck(check, scenarios[Math.floor(index / 2)]!, compilerVariant, index % 2))
  for (const check of checks) {
    const previous = expected.get(check.scenario)
    if (previous === undefined && variant === 'baseline') {
      expected.set(check.scenario, check.output)
    }
    else if (previous !== check.output) {
      throw new Error(`${variant}/${check.scenario}: observer changed full output/maps/warnings/diagnostics`)
    }
  }
  verifyScriptCoverage(checks, compilerVariant)
  const records: TransformScriptCaptureRecord[] = []
  let loader: unknown
  if (variant === 'captured-optimized-js') {
    const capture = object(report.capture)
    const identity = object(capture.loader)
    if (!Array.isArray(capture.records) || !capture.records.length || identity.loadCount !== 1 || identity.target !== captureTarget
      || ![identity.upstreamSha256, identity.instrumentedSha256].every(value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value))) {
      throw new Error('Missing actual capture loader or stage records')
    }
    loader = identity
    for (const [index, rawRecord] of capture.records.entries()) {
      const record = rawRecord as TransformScriptCaptureRecord
      const scenario = scenarios.find(entry => entry.scenario.id === record.scenarioId)?.scenario
      if (!scenario || record.schemaVersion !== 1 || record.callIndex !== index || !['returned', 'threw'].includes(record.status)
        || !Array.isArray(record.captureFailures) || record.captureFailures.length || !record.options
        || !record.source || record.source.sha256 !== digest(record.source.code)
        || record.source.utf16Length !== record.source.code.length || record.source.utf8Bytes !== Buffer.byteLength(record.source.code)
        || !Array.isArray(record.warnings) || !record.bridge || !Number.isSafeInteger(record.bridge.expressionCount) || record.bridge.expressionCount < 0
        || !Number.isSafeInteger(record.bridge.generatedUtf16Chars) || record.bridge.generatedUtf16Chars < 0
        || (record.status === 'threw' && (!record.error || !scenario.expectError))) {
        throw new Error('Invalid captured stage identity or outcome')
      }
      if (record.status === 'returned') {
        if (!['hit', 'miss'].includes(record.fastSetup)) {
          throw new Error('Successful stage has no fastSetup observation')
        }
        readCapturedStageResult(record)
      }
      records.push(record)
    }
    const visited: number[] = []
    const repeated = new Map<string, unknown>()
    for (const [index, rawCheck] of report.checks.entries()) {
      const check = object(rawCheck)
      const indexes = check.capturedCallIndexes
      const scenario = scenarios[Math.floor(index / 2)]!.scenario
      if (!Array.isArray(indexes) || !indexes.every(value => Number.isSafeInteger(value) && value >= 0)
        || (scenario.kind === 'script' && indexes.length !== 1)
        || (['sfc-wevu', 'sfc-retail'].includes(scenario.id) && indexes.length !== 1)) {
        throw new Error('Missing per-call capture ownership or required stage coverage')
      }
      const owned = indexes.map((index: number) => {
        const record = records[index]
        if (!record || record.scenarioId !== scenario.id || index !== visited.length) {
          throw new Error('Captured records are missing, duplicated or owned by another call')
        }
        visited.push(index)
        const { callIndex: _, ...value } = record
        return value
      })
      if (index % 2 === 0) {
        repeated.set(scenario.id, owned)
      }
      else if (!isDeepStrictEqual(repeated.get(scenario.id), owned)) {
        throw new Error('Repeated stage requests/results/warnings changed under capture')
      }
    }
    if (visited.length !== records.length) {
      throw new Error('Unowned captured records remain')
    }
    if (!records.some(record => record.bridge.expressionCount > 0) || !records.some(record => record.fastSetup === 'miss')) {
      throw new Error('Capture omitted metadata expressions or the full transform path')
    }
  }
  else if (report.capture !== undefined) {
    throw new Error('Control variant unexpectedly captured transformScript')
  }
  return { records, loader, checks: checks.map(({ output, ...check }) => ({ ...check, outputSha256: digest(output) })) }
}
