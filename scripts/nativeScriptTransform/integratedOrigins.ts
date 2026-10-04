import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import type { CapturedValue } from './captureTypes'
import type { IntegratedRecord } from './integratedTypes'
import { isDeepStrictEqual } from 'node:util'
import { object } from '../optimizedCompilerAnalysis/verify'
import { decodeCapturedData } from './captureRead'
import { verifyInlineOriginMap } from './originChecks'
import { inlineOriginTargets } from './origins/source'

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

/** 只读取校验所需的纯数据字段，不把 callback、AST 或 transfer token 恢复为执行对象。 */
export function inlineOriginOptions(options: CapturedValue | undefined) {
  if (options?.kind !== 'object') {
    return {}
  }
  return Object.fromEntries(options.properties.flatMap(property =>
    property.key === 'inlineExpressions' || property.key === 'sourceMap'
      ? [[property.key, decodeCapturedData(property.value)]]
      : [],
  ))
}

/** 快照仅补充真实 hook 的所有权记录；每条请求仍由独立 parser 校验。 */
export function verifyInlineOriginSnapshot(raw: unknown, records: IntegratedRecord[]) {
  const snapshot = object(raw)
  ensure(Array.isArray(snapshot.loaders) && snapshot.loaders.length === inlineOriginTargets.length, 'Origin loader coverage is incomplete')
  snapshot.loaders.forEach((raw, index) => {
    const loader = object(raw)
    ensure(loader.target === inlineOriginTargets[index]!.target && loader.loadCount === 1
      && [loader.upstreamSha256, loader.instrumentedSha256].every(value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)), 'Origin loader identity is incomplete')
  })
  ensure(Array.isArray(snapshot.sources) && Array.isArray(snapshot.occurrences) && Array.isArray(snapshot.unsupported)
    && snapshot.sourceCount === snapshot.sources.length && snapshot.occurrenceCount === snapshot.occurrences.length
    && snapshot.requestCalls === records.length, 'Origin snapshot counters differ')
  const sources = new Map(snapshot.sources.map(raw => [object(raw).id, raw]))
  const occurrences = new Map(snapshot.occurrences.map(raw => [object(raw).id, raw]))
  ensure(sources.size === snapshot.sources.length && occurrences.size === snapshot.occurrences.length, 'Origin snapshot identities are duplicated')
  for (const record of records) {
    for (const source of record.provenance?.sources ?? []) {
      ensure(isDeepStrictEqual(sources.get(source.id), source), 'Request origin source differs from the captured owner')
    }
    for (const occurrence of record.provenance?.occurrences ?? []) {
      ensure(isDeepStrictEqual(occurrences.get(occurrence.id), occurrence), 'Request origin occurrence differs from the captured asset')
    }
  }
  return Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'sources' && key !== 'occurrences'))
}

/** 在阶段和最终产物的实际 callee 与参数 token 上分别消费来源；严格旧 map 比较另行保留。 */
export function inspectIntegratedOrigins(scenario: ScriptScenario, output: string, records: IntegratedRecord[]) {
  const delivered = records.filter(record => record.used === 'native' && record.provenance)
  if (!delivered.length) {
    return []
  }
  ensure(scenario.kind === 'sfc', 'Template origins were delivered outside their owning SFC')
  const value = object(object(JSON.parse(output) as unknown).value)
  return delivered.map((record) => {
    const options = inlineOriginOptions(record.options)
    if (options.sourceMap === false) {
      return { callIndex: record.callIndex, occurrenceCount: record.provenance!.occurrences.length, mapDisabled: true, stageChecked: 0, finalChecked: 0, stageFragmentsChecked: 0, finalFragmentsChecked: 0 }
    }
    const stage = object(decodeCapturedData(record.result!))
    ensure(typeof stage.code === 'string' && typeof value.script === 'string', 'Origin check requires the actual complete script')
    const first = verifyInlineOriginMap(record.provenance!, options, stage.code, stage.map)
    const final = verifyInlineOriginMap(record.provenance!, options, value.script, value.scriptMap)
    return { callIndex: record.callIndex, occurrenceCount: record.provenance!.occurrences.length, mapDisabled: false, stageChecked: first.checked, finalChecked: final.checked, stageFragmentsChecked: first.fragmentsChecked, finalFragmentsChecked: final.fragmentsChecked }
  })
}
