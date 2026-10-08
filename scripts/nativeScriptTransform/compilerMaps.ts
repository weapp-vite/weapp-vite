import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import { isDeepStrictEqual } from 'node:util'
import { decodedMappings, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { anchors } from './transformOracle'

type Finding = Record<string, unknown>
interface ScriptEvidence { code: string, map?: unknown, hasMap: boolean, ast: unknown }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function lines(value: string) {
  return value.split(/\r\n|[\r\n\u2028\u2029]/)
}

/** 验证实际 map 的源身份及所有已编码分段，不从 AST 结构推断正向来源。 */
function readMap(value: unknown, source: ScriptScenario, code: string, side: string, findings: Finding[]) {
  if (!object(value) || value.version !== 3 || typeof value.mappings !== 'string'
    || !Array.isArray(value.names) || value.names.some(name => typeof name !== 'string')
    || !Array.isArray(value.sources) || value.sources.some(name => typeof name !== 'string')
    || !Array.isArray(value.sourcesContent) || value.sourcesContent.length !== value.sources.length
    || (value.sourceRoot !== undefined && typeof value.sourceRoot !== 'string')) {
    findings.push({ side, reason: 'Invalid final script map contract', map: value })
    return undefined
  }
  if (value.sources.length !== 1) {
    findings.push({ side, reason: 'Multiple or missing final sources are unverified; no cross-source provenance contract is available', sources: value.sources })
    return undefined
  }
  try {
    const map = new TraceMap(value as unknown as EncodedSourceMap)
    const filename = source.filename.replaceAll('\\', '/')
    if (map.resolvedSources[0]?.replaceAll('\\', '/') !== filename || value.sourcesContent[0] !== source.source) {
      findings.push({ side, reason: 'Final script map does not identify the exact scenario source', sources: value.sources, resolvedSources: map.resolvedSources, sourceContentEqual: value.sourcesContent[0] === source.source })
      return undefined
    }
    const originalLines = lines(source.source)
    const generatedLines = lines(code)
    const segments = decodedMappings(map)
    for (const [line, entries] of segments.entries()) {
      let previousColumn = -1
      for (const [index, segment] of entries.entries()) {
        const location = { line: line + 1, column: segment[0] }
        const invalid = ![1, 4, 5].includes(segment.length) || segment.some(value => !Number.isSafeInteger(value) || value < 0)
          || segment[0] < previousColumn || line >= generatedLines.length || segment[0] > generatedLines[line]!.length
        previousColumn = segment[0]
        if (invalid) {
          findings.push({ side, reason: 'Invalid generated map segment', index, location, segment })
        }
        if (segment.length >= 4) {
          const [, sourceId, originalLine, originalColumn, name] = segment
          if (sourceId !== 0 || originalLine === undefined || originalColumn === undefined || originalLine < 0
            || originalLine >= originalLines.length || originalColumn < 0 || originalColumn > originalLines[originalLine]!.length
            || (name !== undefined && (name < 0 || name >= value.names.length))) {
            findings.push({ side, reason: 'Map segment origin or name is outside the exact scenario source', index, location, segment })
          }
        }
      }
    }
    return map
  }
  catch (error) {
    findings.push({ side, reason: 'Cannot decode final script map', error: String(error) })
    return undefined
  }
}

/** 独立查询两份最终 map；缺失来源保持未核验，不构造替代或虚拟 identity map。 */
export function inspectCompilerMaps(expected: ScriptEvidence, actual: ScriptEvidence, scenario: ScriptScenario) {
  const mismatches: Finding[] = []
  const unmappedAnchors: Finding[] = []
  const before = anchors(expected.ast)
  const after = anchors(actual.ast)
  const counts = { expected: before.length, actual: after.length, matchedMapped: 0, bothUnmapped: 0, oneSidedUnmapped: 0 }
  const exactMap = expected.hasMap === actual.hasMap && isDeepStrictEqual(expected.map, actual.map)
  const absent = expected.map == null && actual.map == null
  const disabled = scenario.kind !== 'reserved-props' && scenario.options.sourceMap === false
  if (absent && disabled) {
    if (!exactMap) {
      mismatches.push({ reason: 'Disabled map return contracts differ', expected: expected.map, actual: actual.map, expectedPresent: expected.hasMap, actualPresent: actual.hasMap })
    }
    return { status: 'disabled-both', exactMap, coverageVerified: false, anchorsEqual: exactMap, counts, mismatches, unmappedAnchors }
  }
  const expectedMap = readMap(expected.map, scenario, expected.code, 'expected', mismatches)
  const actualMap = readMap(actual.map, scenario, actual.code, 'actual', mismatches)
  if (!expectedMap || !actualMap) {
    mismatches.push({ reason: 'Both independent final maps must identify the exact scenario source before origin comparison' })
    return { status: 'missing-or-unverified', exactMap, coverageVerified: false, anchorsEqual: false, counts, mismatches, unmappedAnchors }
  }
  const left = new Map(before.map(anchor => [anchor.path, anchor]))
  const right = new Map(after.map(anchor => [anchor.path, anchor]))
  for (const path of new Set([...left.keys(), ...right.keys()])) {
    const expectedAnchor = left.get(path)
    const actualAnchor = right.get(path)
    if (!expectedAnchor || !actualAnchor || expectedAnchor.kind !== actualAnchor.kind) {
      mismatches.push({ path, reason: 'Final AST anchor missing or changed', expected: expectedAnchor, actual: actualAnchor })
      continue
    }
    try {
      const expectedOrigin = originalPositionFor(expectedMap, expectedAnchor.location)
      const actualOrigin = originalPositionFor(actualMap, actualAnchor.location)
      if (!isDeepStrictEqual(expectedOrigin, actualOrigin)) {
        mismatches.push({ path, reason: 'Independent final origins differ', expectedOrigin, actualOrigin, expectedLocation: expectedAnchor.location, actualLocation: actualAnchor.location })
      }
      else if (expectedOrigin.source !== null) {
        counts.matchedMapped++
      }
      if (expectedOrigin.source === null || actualOrigin.source === null) {
        unmappedAnchors.push({ path, kind: expectedAnchor.kind, classification: 'unverified-origin', expectedOrigin, actualOrigin })
        if (expectedOrigin.source === null && actualOrigin.source === null) {
          counts.bothUnmapped++
          mismatches.push({ path, reason: 'Both final maps omit this anchor; generated-region ownership is unverified' })
        }
        else {
          counts.oneSidedUnmapped++
        }
      }
    }
    catch (error) {
      mismatches.push({ path, reason: 'Cannot trace final script mappings', error: String(error) })
    }
  }
  if (counts.matchedMapped === 0) {
    mismatches.push({ reason: 'No final source origin was verified; matching empty maps do not establish coverage' })
  }
  return { status: 'present-both', exactMap, coverageVerified: mismatches.length === 0, anchorsEqual: mismatches.length === 0, counts, mismatches, unmappedAnchors }
}
