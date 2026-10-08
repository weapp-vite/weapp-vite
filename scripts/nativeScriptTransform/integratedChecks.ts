import type { OptimizedScenario } from '../optimizedCompilerAnalysis/scenarios'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import type { TransformScriptCaptureRecord } from './captureTypes'
import type { IntegratedMode, IntegratedRecord } from './integratedTypes'
import { Buffer } from 'node:buffer'
import { isDeepStrictEqual } from 'node:util'
import { expectedHookSources, object, verifyOptimizedCheck, verifyScriptCoverage } from '../optimizedCompilerAnalysis/verify'
import { decodeCapturedData } from './captureRead'
import { captureTarget } from './captureSource'
import { digest } from './identity'
import { integratedMapTarget } from './integratedMap'
import { inlineOriginOptions, inspectIntegratedOrigins, verifyInlineOriginSnapshot } from './integratedOrigins'
import { validateInlineProvenance } from './originChecks'
import { serializeTransformScriptRequest } from './request'
import { validateNativeTransformOutcome } from './transformNative'

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

/** 按控制组两轮相同的调用形状核对每次编译，不能把两轮记录都归给第一轮。 */
export function verifyIntegratedCallOwnership(indexes: unknown, records: IntegratedRecord[], captured: TransformScriptCaptureRecord[], scenarioId: string, visited: number) {
  const count = captured.filter(record => record.scenarioId === scenarioId).length / 2
  ensure(Array.isArray(indexes) && indexes.every(value => Number.isSafeInteger(value) && value >= 0)
    && Number.isSafeInteger(count) && indexes.length === count, 'Integrated per-call stage coverage differs from the captured control')
  return indexes.map((value: number, offset) => {
    const record = records[value]
    ensure(value === visited + offset && record?.scenarioId === scenarioId, 'Integrated stage record is unowned, duplicated or reordered')
    return record
  })
}

/** 校验每条实际入口记录的所有权、请求、交付结果与真实回退次数。 */
export function verifyIntegratedRecord(raw: unknown, expected: TransformScriptCaptureRecord, mode: IntegratedMode, scenario?: ScriptScenario) {
  const record = object(raw) as unknown as IntegratedRecord
  ensure(record.schemaVersion === 1 && record.callIndex === expected.callIndex && record.scenarioId === expected.scenarioId
    && ['returned', 'threw'].includes(record.status) && Array.isArray(record.evidenceErrors) && !record.evidenceErrors.length
    && record.source?.sha256 === digest(record.source.code) && record.source.utf16Length === record.source.code.length
    && record.source.utf8Bytes === Buffer.byteLength(record.source.code)
    && isDeepStrictEqual(record.source, expected.source) && isDeepStrictEqual(record.options, expected.options)
    && isDeepStrictEqual(record.bridge, expected.bridge) && Array.isArray(record.warnings), 'Integrated stage input, ownership or evidence differs')
  if (record.provenance !== undefined) {
    ensure(scenario, 'Template provenance has no owning compiler scenario')
    validateInlineProvenance(record.provenance, scenario, inlineOriginOptions(expected.options))
  }
  ensure(record.status === expected.status, 'Integrated stage changed success/error status')
  const warnings = record.warnings.map((raw) => {
    const warning = object(raw)
    ensure(['handler', 'console'].includes(String(warning.channel)) && warning.arguments, 'Invalid integrated warning evidence')
    const arguments_ = decodeCapturedData(warning.arguments as typeof record.warnings[number]['arguments'])
    ensure(Array.isArray(arguments_), 'Integrated warning arguments must preserve the complete call')
    return { channel: warning.channel, arguments: arguments_ }
  })
  if (record.status === 'returned') {
    ensure(record.result, 'Integrated stage omitted returned result')
    const result = object(decodeCapturedData(record.result))
    ensure(typeof result.code === 'string' && typeof result.transformed === 'boolean', 'Integrated stage returned malformed result')
  }
  else {
    ensure(record.error, 'Integrated stage omitted thrown error')
  }
  if (mode === 'control-js') {
    ensure(record.used === 'control-js' && record.nativeCalls === 0 && record.fallbackCalls === 0
      && record.rawNative === undefined && record.request === undefined && record.nativeStatus === undefined
      && record.nativeError === undefined && record.requestError === undefined && record.fallbackReason === undefined, 'Integrated control invoked native or fallback')
    ensure(isDeepStrictEqual(record.result, expected.result) && isDeepStrictEqual(record.warnings, expected.warnings)
      && isDeepStrictEqual(record.error, expected.error), 'Integrated control changed the stage result')
    return record
  }
  ensure(record.request === serializeTransformScriptRequest({ kind: 'captured', options: expected.options!, provenance: record.provenance })
    && record.nativeCalls === 1 && record.rawNative && !record.requestError && !record.nativeError, 'Integrated native did not execute one complete actual request')
  const outcome = validateNativeTransformOutcome(decodeCapturedData(record.rawNative), record.source.code, record.request)
  ensure(record.nativeStatus === outcome.status, 'Integrated native outcome status differs from raw evidence')
  if (outcome.status === 'ok') {
    ensure(record.used === 'native' && record.fallbackCalls === 0 && record.fallbackReason === undefined
      && record.result && isDeepStrictEqual(decodeCapturedData(record.result), outcome.result), 'Integrated native result was not delivered directly')
    ensure(isDeepStrictEqual(warnings.filter(warning => warning.channel === 'handler').map(warning => warning.arguments), outcome.warnings.map(message => [message])), 'Integrated native warnings were not delivered exactly once in order')
  }
  else {
    ensure(record.used === 'fallback' && record.fallbackCalls === 1 && typeof record.fallbackReason === 'string' && record.fallbackReason.length > 0, 'Rejected native did not execute exactly one complete JS fallback')
    ensure(isDeepStrictEqual(record.result, expected.result) && isDeepStrictEqual(record.warnings, expected.warnings)
      && isDeepStrictEqual(record.error, expected.error), 'Integrated fallback changed JS results or warnings')
  }
  return record
}

/** 完整编译诊断仍须满足输入身份、加载器、资源释放和每次调用对应关系。 */
export function verifyIntegratedReport(raw: unknown, mode: IntegratedMode, identity: Record<string, string>, bindingSha256: string, scenarios: OptimizedScenario[], captured: TransformScriptCaptureRecord[], expected: Map<string, string>) {
  const report = object(raw)
  ensure(report.schemaVersion === 1 && report.variant === mode && report.passed === true && !report.failure
    && Array.isArray(report.cleanupErrors) && report.cleanupErrors.length === 0 && report.sourcesUnchanged === true
    && isDeepStrictEqual(report.sourceHashesBefore, identity) && isDeepStrictEqual(report.sourceHashesAfter, identity)
    && isDeepStrictEqual(report.hookSources, expectedHookSources('optimized-js', identity)) && report.bindingUnchanged === true, 'Integrated worker failed, drifted or left resources active')
  const integration = object(report.integration)
  const loader = object(integration.loader)
  ensure(integration.mode === mode && !integration.loadError && loader.target === captureTarget && loader.loadCount === 1
    && [loader.upstreamSha256, loader.instrumentedSha256].every(value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)), 'Integrated loader identity is missing or incomplete')
  ensure(mode === 'native'
    ? [report.bindingSha256Before, report.bindingSha256After, integration.bindingSha256].every(value => value === bindingSha256)
    : [report.bindingSha256Before, report.bindingSha256After, integration.bindingSha256].every(value => value === undefined), 'Integrated binding identity differs')
  ensure(Array.isArray(report.checks) && report.checks.length === scenarios.length * 2
    && Array.isArray(integration.records) && integration.records.length === captured.length, 'Integrated scenario or stage coverage is incomplete')
  const records = integration.records.map((record, index) => verifyIntegratedRecord(record, captured[index]!, mode, scenarios.find(entry => entry.scenario.id === captured[index]!.scenarioId)?.scenario))
  const origins = verifyInlineOriginSnapshot(integration.origins, records)
  const mapLoader = object(integration.mapLoader)
  ensure(mapLoader.target === integratedMapTarget && mapLoader.loadCount === 1
    && [mapLoader.upstreamSha256, mapLoader.instrumentedSha256].every(value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)), 'Map composition loader identity is incomplete')
  const originChecks: { scenarioId: string, iteration: number, records: ReturnType<typeof inspectIntegratedOrigins> }[] = []
  let visited = 0
  const repeated = new Map<string, string>()
  const checks = report.checks.map((rawCheck, index) => {
    const entry = scenarios[Math.floor(index / 2)]!
    const check = verifyOptimizedCheck(rawCheck, entry, 'optimized-js', index % 2)
    const indexes = object(rawCheck).integratedCallIndexes
    const owned = verifyIntegratedCallOwnership(indexes, records, captured, entry.scenario.id, visited)
    visited += owned.length
    ensure(entry.scenario.kind !== 'script' || owned.length === 1, 'Direct script call has no integrated record')
    if (index % 2 === 0) {
      repeated.set(check.scenario, check.output)
    }
    else {
      ensure(repeated.get(check.scenario) === check.output, 'Integrated repeated complete outputs differ')
    }
    if (mode === 'control-js' || owned.every(record => record.used !== 'native')) {
      ensure(check.output === expected.get(check.scenario), 'Integrated control or fallback changed complete output/maps/warnings/errors')
    }
    originChecks.push({ scenarioId: entry.scenario.id, iteration: index % 2, records: inspectIntegratedOrigins(entry.scenario, check.output, owned) })
    return { ...check, integratedCallIndexes: indexes as number[] }
  })
  ensure(visited === records.length, 'Unowned integrated records remain')
  if (mode === 'control-js') {
    verifyScriptCoverage(checks, 'optimized-js')
  }
  const counts = {
    nativeCalls: records.reduce((sum, record) => sum + record.nativeCalls, 0),
    nativeSucceeded: records.filter(record => record.used === 'native').length,
    fallbackCalls: records.reduce((sum, record) => sum + record.fallbackCalls, 0),
  }
  ensure(Object.entries(counts).every(([key, value]) => report[key] === value), 'Integrated worker counters disagree with raw records')
  const realPages = ['sfc-wevu', 'sfc-retail'].map((scenarioId) => {
    const owned = records.filter(record => record.scenarioId === scenarioId)
    const nativeSucceeded = owned.filter(record => record.used === 'native').length
    ensure(owned.every((record) => {
      const options = inlineOriginOptions(record.options)
      return Array.isArray(options.inlineExpressions) && options.inlineExpressions.length > 0
        && record.provenance?.occurrences.length === options.inlineExpressions.length
    }), 'Representative page inline callee provenance is incomplete')
    ensure(owned.length === 2 && (mode !== 'native' || nativeSucceeded === 2), 'Representative page did not use complete native transformation twice')
    return { scenarioId, requiredRecords: owned.length, nativeSucceeded }
  })
  const mapComposition = object(integration.mapComposition)
  const selectiveCalls = originChecks.reduce((sum, check) => sum + check.records.filter(record => !record.mapDisabled).length, 0)
  ensure(Number.isSafeInteger(mapComposition.calls) && Number(mapComposition.calls) >= selectiveCalls && mapComposition.selectiveCalls === selectiveCalls, 'Selective source map composition counts differ')
  return { checks, records, loader, mapLoader, origins, mapComposition, originChecks, realPages, ...counts }
}
