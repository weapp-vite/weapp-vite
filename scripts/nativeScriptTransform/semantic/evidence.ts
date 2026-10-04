import type { ScriptScenario } from '../../scriptAnalysisBaseline/types'
import type { CapturedStageResult, TransformScriptCaptureRecord } from '../captureTypes'
import type { IntegratedCheck, IntegratedRecord } from '../integratedTypes'
import type { CompilerArtifacts } from './artifacts'
import { isDeepStrictEqual } from 'node:util'
import { optimizedScenarios } from '../../optimizedCompilerAnalysis/scenarios'
import { object } from '../../optimizedCompilerAnalysis/verify'
import { decodeCapturedData, readCapturedStageResult } from '../captureRead'
import { inspectCompilerOutputs } from '../compilerOracle'
import { digest } from '../identity'
import { verifyIntegratedReport } from '../integratedChecks'
import { STAGE_VARIANTS, verifyStageReport } from '../stageChecks'
import { inspectTransform } from '../transformOracle'
import { ensure } from './artifacts'

export const SEMANTIC_PAGES = ['sfc-wevu', 'sfc-retail'] as const
export interface SemanticPair {
  scenarioId: typeof SEMANTIC_PAGES[number]
  iteration: number
  inputSha256: string
  callIndex: number
  stageSourceSha256: string
  requestSha256: string
  expectedCode: string
  nativeCode: string
  expectedCodeSha256: string
  nativeCodeSha256: string
  compilerEvidence: { filename: string, sha256: string }
}

/** 每个真实页面必须实际使用 native，且交付的完整脚本必须就是其阶段输出。 */
export function semanticPair(scenario: ScriptScenario, check: Pick<IntegratedCheck, 'scenario' | 'iteration' | 'inputSha256' | 'integratedCallIndexes' | 'output'>, records: IntegratedRecord[], captured: TransformScriptCaptureRecord[], expected: string): Omit<SemanticPair, 'compilerEvidence'> {
  ensure(scenario.kind === 'sfc' && SEMANTIC_PAGES.includes(scenario.id as SemanticPair['scenarioId']), 'Unknown executable page scenario')
  ensure(check.scenario === scenario.id && [0, 1].includes(check.iteration) && check.integratedCallIndexes.length === 1, 'Executable page ownership is incomplete')
  ensure(check.inputSha256 === digest(JSON.stringify(scenario)), 'Executable page input differs from the compiler scenario')
  const callIndex = check.integratedCallIndexes[0]!
  const record = records[callIndex]
  const control = captured[callIndex]
  ensure(record && control && record.scenarioId === scenario.id && control.scenarioId === scenario.id
    && record.callIndex === callIndex && control.callIndex === callIndex && record.used === 'native' && record.status === 'returned'
    && record.nativeCalls === 1 && record.fallbackCalls === 0 && record.result && record.request, 'Executable page was not delivered by native')
  const original = object(JSON.parse(expected) as unknown)
  const actual = object(JSON.parse(check.output) as unknown)
  ensure(!original.error && !actual.error, 'Executable page has a compiler error')
  const before = object(original.value)
  const after = object(actual.value)
  const stage = object(decodeCapturedData(record.result))
  ensure(typeof before.script === 'string' && typeof after.script === 'string' && before.script.length > 0 && after.script.length > 0, 'Executable page has no complete script')
  ensure(stage.code === after.script && readCapturedStageResult(control).code === before.script, 'Stage code differs from the actual final compiler script')
  return {
    scenarioId: scenario.id as SemanticPair['scenarioId'],
    iteration: check.iteration,
    inputSha256: check.inputSha256,
    callIndex,
    stageSourceSha256: record.source.sha256,
    requestSha256: digest(record.request),
    expectedCode: before.script,
    nativeCode: after.script,
    expectedCodeSha256: digest(before.script),
    nativeCodeSha256: digest(after.script),
  }
}

/** 重放完整控制及严格来源门禁后才允许执行；编译诊断成功不等于兼容通过。 */
export async function readSemanticCompilerEvidence(artifacts: CompilerArtifacts, identity: Record<string, string>, bindingSha256: string, exitCode: number) {
  const summary = object(await artifacts.read('summary.json'))
  const before = object(await artifacts.read('identity-before.json'))
  const after = object(await artifacts.read('identity-after.json'))
  ensure(summary.schemaVersion === 1 && summary.completed === true && typeof summary.comparisonPassed === 'boolean' && summary.allowDifferences === false
    && !summary.failure && isDeepStrictEqual(summary.identityErrors, []) && summary.sourcesUnchanged === true && summary.bindingUnchanged === true
    && [before.sourceHashes, after.sourceHashes, summary.sourceHashesBefore, summary.sourceHashesAfter].every(value => isDeepStrictEqual(value, identity))
    && [before.bindingSha256, after.bindingSha256, summary.bindingSha256Before, summary.bindingSha256After].every(value => value === bindingSha256)
    && isDeepStrictEqual(after.identityErrors, []), 'Compiler evidence failed or has a different source/binary identity')
  ensure(exitCode === (summary.comparisonPassed ? 0 : 1), 'Compiler exit status does not describe strict compatibility')
  const scenarios = await optimizedScenarios()
  const expected = new Map<string, string>()
  let captured: TransformScriptCaptureRecord[] = []
  ensure(Array.isArray(summary.controlWorkers) && summary.controlWorkers.length === 3
    && Array.isArray(summary.integratedWorkers) && summary.integratedWorkers.length === 2, 'Compiler worker summaries are incomplete')
  for (const [index, variant] of STAGE_VARIANTS.entries()) {
    const filename = `${variant}/report.json`
    const verified = verifyStageReport(await artifacts.read(filename), variant, identity, scenarios, expected)
    const recorded = object(summary.controlWorkers[index])
    ensure(recorded.variant === variant && recorded.reportSha256 === artifacts.hashes[filename], 'Control worker report differs from its summary')
    if (variant === 'captured-optimized-js') {
      captured = verified.records
    }
  }
  let control: ReturnType<typeof verifyIntegratedReport> | undefined
  let native: ReturnType<typeof verifyIntegratedReport> | undefined
  for (const [index, mode] of (['control-js', 'native'] as const).entries()) {
    const filename = `integrated-${mode}/report.json`
    const verified = verifyIntegratedReport(await artifacts.read(filename), mode, identity, bindingSha256, scenarios, captured, expected)
    const recorded = object(summary.integratedWorkers[index])
    ensure(recorded.mode === mode && recorded.reportSha256 === artifacts.hashes[filename], 'Integrated worker report differs from its summary')
    ensure(isDeepStrictEqual(recorded.origins, verified.origins) && isDeepStrictEqual(recorded.originChecks, verified.originChecks)
      && isDeepStrictEqual(recorded.mapComposition, verified.mapComposition), 'Origin summary differs from independent replay')
    if (mode === 'native') {
      ensure(control && isDeepStrictEqual(verified.records.map(record => record.provenance), control.records.map(record => record.provenance)), 'Native provenance differs from the JS control')
      native = verified
    }
    else {
      control = verified
    }
  }
  ensure(native && summary.completeControlByteChecks === scenarios.length * 8
    && summary.nativeCalls === native.nativeCalls && summary.nativeSucceeded === native.nativeSucceeded && summary.fallbackCalls === native.fallbackCalls, 'Compiler counters differ from the actual worker records')
  ensure(Array.isArray(summary.completeCompilerComparisons) && summary.completeCompilerComparisons.length === native.checks.length
    && Array.isArray(summary.stageComparisons) && summary.stageComparisons.length === native.nativeSucceeded, 'Compiler artifact coverage is incomplete')
  const pairs: SemanticPair[] = []
  let allPassed = native.fallbackCalls === 0
  for (const [index, check] of native.checks.entries()) {
    const scenario = scenarios[Math.floor(index / 2)]!.scenario
    const filename = `compiler-${String(index).padStart(4, '0')}.json`
    const evidence = object(await artifacts.read(filename))
    const recorded = object(summary.completeCompilerComparisons[index])
    const owned = check.integratedCallIndexes.map(index => native.records[index]!)
    ensure(recorded.filename === filename && recorded.sha256 === artifacts.hashes[filename]
      && recorded.scenarioId === scenario.id && recorded.iteration === check.iteration
      && recorded.nativeCalls === owned.filter(record => record.used === 'native').length
      && recorded.fallbackCalls === owned.reduce((sum, record) => sum + record.fallbackCalls, 0)
      && isDeepStrictEqual(evidence.scenario, scenario) && isDeepStrictEqual(evidence.actual, JSON.parse(JSON.stringify(check)))
      && evidence.expected === expected.get(scenario.id), 'Complete compiler artifact differs from the actual execution')
    const comparison = inspectCompilerOutputs(expected.get(scenario.id)!, check.output, scenario)
    ensure(isDeepStrictEqual(JSON.parse(JSON.stringify(comparison)), evidence.comparison)
      && recorded.comparisonPassed === comparison.comparisonPassed && recorded.exactOutput === comparison.exactOutput, 'Complete compiler comparison was changed')
    allPassed &&= comparison.comparisonPassed
    if (SEMANTIC_PAGES.includes(scenario.id as SemanticPair['scenarioId'])) {
      pairs.push({ ...semanticPair(scenario, check, native.records, captured, expected.get(scenario.id)!), compilerEvidence: { filename, sha256: artifacts.hashes[filename]! } })
    }
  }
  for (const [index, record] of native.records.filter(record => record.used === 'native').entries()) {
    const filename = `stage-${String(record.callIndex).padStart(4, '0')}.json`
    const evidence = object(await artifacts.read(filename))
    const recorded = object(summary.stageComparisons[index])
    const control = captured[record.callIndex]!
    ensure(recorded.filename === filename && recorded.sha256 === artifacts.hashes[filename]
      && recorded.scenarioId === record.scenarioId && recorded.callIndex === record.callIndex
      && isDeepStrictEqual(evidence.control, control) && isDeepStrictEqual(evidence.integrated, record), 'Stage artifact differs from its actual delivered output')
    const raw = object(decodeCapturedData(record.rawNative!))
    const comparison = inspectTransform(readCapturedStageResult(control), decodeCapturedData(record.result!) as CapturedStageResult, record.source.code, control.warnings, raw.warnings as string[])
    ensure(isDeepStrictEqual(JSON.parse(JSON.stringify(comparison)), evidence.comparison)
      && recorded.comparisonPassed === comparison.comparisonPassed, 'Stage comparison was changed')
    allPassed &&= comparison.comparisonPassed
  }
  ensure(summary.comparisonPassed === allPassed && pairs.length === SEMANTIC_PAGES.length * 2
    && SEMANTIC_PAGES.every(id => isDeepStrictEqual(pairs.filter(pair => pair.scenarioId === id).map(pair => pair.iteration), [0, 1])), 'Compiler compatibility or executable page coverage differs')
  return { pairs, compilerComparisonPassed: allPassed, completeControlByteChecks: summary.completeControlByteChecks as number, fullCompilerCalls: native.checks.length, stageComparisons: native.nativeSucceeded, compilerSummarySha256: artifacts.hashes['summary.json']! }
}
