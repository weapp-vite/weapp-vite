import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import type { CapturedStageResult, CapturedWarning } from './captureTypes'
import { isDeepStrictEqual } from 'node:util'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { parse } from '@weapp-vite/ast/babel'
import { decodeCapturedData } from './captureRead'

const presentation = new Set(['start', 'end', 'loc', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens', 'errors'])
const tokens = new Set(['Identifier', 'NumericLiteral', 'StringLiteral', 'BooleanLiteral', 'NullLiteral', 'BigIntLiteral', 'DecimalLiteral', 'RegExpLiteral', 'DirectiveLiteral', 'TemplateElement', 'ThisExpression', 'Super'])
const placements = ['leadingComments', 'innerComments', 'trailingComments'] as const
interface Anchor { path: string, kind: string, signature: string, location: { line: number, column: number } }
interface Difference { path: string, expected: unknown, actual: unknown, expectedPresent: boolean, actualPresent: boolean }
type Finding = Record<string, unknown>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strip)
  }
  return object(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !presentation.has(key)).map(([key, child]) => [key, strip(child)]))
    : value
}

/** 记录每个原始差异，不截断、不把缺失属性与显式 undefined 混为一谈。 */
export function differences(expected: unknown, actual: unknown, path = '$', expectedPresent = true, actualPresent = true): Difference[] {
  if (expectedPresent === actualPresent && isDeepStrictEqual(expected, actual)) {
    return []
  }
  if (expectedPresent && actualPresent && ((object(expected) && object(actual)) || (Array.isArray(expected) && Array.isArray(actual)))
    && Object.getPrototypeOf(expected) === Object.getPrototypeOf(actual)) {
    const before = expected as Record<string, unknown>
    const after = actual as Record<string, unknown>
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    if (Array.isArray(expected)) {
      keys.add('length')
    }
    return [...keys].flatMap(key => differences(before[key], after[key], `${path}.${key}`, Object.hasOwn(before, key), Object.hasOwn(after, key)))
  }
  return [{ path, expected, actual, expectedPresent, actualPresent }]
}

function visit(value: unknown, callback: (node: Record<string, unknown>, path: string) => void, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((child, index) => visit(child, callback, `${path}[${index}]`))
  }
  else if (object(value)) {
    callback(value, path)
    for (const [key, child] of Object.entries(value)) {
      if (!presentation.has(key)) {
        visit(child, callback, `${path}.${key}`)
      }
    }
  }
}

export function anchors(ast: unknown) {
  const result: Anchor[] = []
  visit(ast, (node, path) => {
    if (typeof node.type === 'string' && (tokens.has(node.type) || /(?:Statement|Declaration)$/.test(node.type))
      && object(node.loc) && object(node.loc.start) && typeof node.loc.start.line === 'number' && typeof node.loc.start.column === 'number') {
      result.push({ path, kind: node.type, signature: JSON.stringify(strip(node)), location: { line: node.loc.start.line, column: node.loc.start.column } })
    }
  })
  return result
}

function commentEvidence(ast: unknown) {
  const all = object(ast) && Array.isArray(ast.comments) ? ast.comments.filter(object) : []
  const comments = all.map(comment => ({ type: comment.type, value: comment.value }))
  const annotations = all.flatMap((comment, index) => {
    const markers = typeof comment.value === 'string' ? comment.value.match(/[@#]__(?:PURE|NO_SIDE_EFFECTS)__/g) : null
    return markers ? [{ index, markers, attachments: [] as Finding[] }] : []
  })
  const indexed = new Map(annotations.map((annotation) => {
    const comment = all[annotation.index]!
    return [`${comment.start}:${comment.end}`, annotation]
  }))
  visit(ast, (node, path) => {
    if (typeof node.type !== 'string') {
      return
    }
    for (const placement of placements) {
      const attached = node[placement]
      if (Array.isArray(attached)) {
        for (const comment of attached.filter(object)) {
          indexed.get(`${comment.start}:${comment.end}`)?.attachments.push({ path, nodeType: node.type, placement })
        }
      }
    }
  })
  return { comments, annotations }
}

function stageMap(value: unknown, source: string, side: string, issues: Finding[]) {
  if (value == null) {
    return undefined
  }
  if (!object(value) || value.version !== 3 || !Array.isArray(value.sources) || value.sources.length !== 1
    || typeof value.sources[0] !== 'string' || !Array.isArray(value.sourcesContent) || value.sourcesContent.length !== 1
    || value.sourcesContent[0] !== source || typeof value.mappings !== 'string'
    || !Array.isArray(value.names) || value.names.some(name => typeof name !== 'string')) {
    issues.push({ side, reason: 'Stage map does not identify the exact shared input source', map: value })
    return undefined
  }
  try {
    return new TraceMap(value as unknown as EncodedSourceMap)
  }
  catch (error) {
    issues.push({ side, reason: 'Invalid stage map', error: String(error) })
    return undefined
  }
}

function inspectMaps(expected: CapturedStageResult, actual: CapturedStageResult, source: string, before: unknown, after: unknown) {
  const mismatches: Finding[] = []
  const expectedMap = stageMap(expected.map, source, 'expected', mismatches)
  const actualMap = stageMap(actual.map, source, 'actual', mismatches)
  const status = expected.map == null && actual.map == null ? 'absent-both' : expectedMap && actualMap ? 'present-both' : 'missing-or-invalid'
  const original = anchors(before)
  const generated = anchors(after)
  const counts = { expected: original.length, actual: generated.length, matchedMapped: 0, bothUnmapped: 0, sourceCandidateUnmapped: 0 }
  const unmappedAnchors: Finding[] = []
  if (status === 'absent-both') {
    if (!isDeepStrictEqual(expected.map, actual.map) || Object.hasOwn(expected, 'map') !== Object.hasOwn(actual, 'map')) {
      mismatches.push({ reason: 'Absent map return contracts differ', expected: expected.map, actual: actual.map, expectedPresent: Object.hasOwn(expected, 'map'), actualPresent: Object.hasOwn(actual, 'map') })
    }
    return { status, counts, mismatches, unmappedAnchors, coverageVerified: false, anchorsEqual: mismatches.length === 0 }
  }
  if (!expectedMap || !actualMap) {
    mismatches.push({ reason: 'Both independent stage maps are required for origin comparison' })
    return { status, counts, mismatches, unmappedAnchors, coverageVerified: false, anchorsEqual: false }
  }
  let input: unknown
  try {
    input = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  }
  catch {
    input = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  }
  const inputSignatures = new Set(anchors(input).map(anchor => anchor.signature))
  const sourceLines = source.split(/\r\n|\r|\n/)
  const left = new Map(original.map(anchor => [anchor.path, anchor]))
  const right = new Map(generated.map(anchor => [anchor.path, anchor]))
  for (const path of new Set([...left.keys(), ...right.keys()])) {
    const expectedAnchor = left.get(path)
    const actualAnchor = right.get(path)
    if (!expectedAnchor || !actualAnchor || expectedAnchor.kind !== actualAnchor.kind) {
      mismatches.push({ path, reason: 'AST anchor missing or changed', expected: expectedAnchor, actual: actualAnchor })
      continue
    }
    try {
      const expectedOrigin = originalPositionFor(expectedMap, expectedAnchor.location)
      const actualOrigin = originalPositionFor(actualMap, actualAnchor.location)
      for (const [side, origin] of [['expected', expectedOrigin], ['actual', actualOrigin]] as const) {
        if (origin.source !== null && (origin.line < 1 || origin.line > sourceLines.length || origin.column < 0 || origin.column > sourceLines[origin.line - 1]!.length)) {
          mismatches.push({ path, side, reason: 'Origin is outside the shared input source', origin })
        }
      }
      if (!isDeepStrictEqual(expectedOrigin, actualOrigin)) {
        mismatches.push({ path, reason: 'Independent stage origins differ', expectedOrigin, actualOrigin, expectedLocation: expectedAnchor.location, actualLocation: actualAnchor.location })
      }
      else if (expectedOrigin.source !== null) {
        counts.matchedMapped++
      }
      if (expectedOrigin.source === null || actualOrigin.source === null) {
        const sourceCandidate = inputSignatures.has(expectedAnchor.signature) || inputSignatures.has(actualAnchor.signature)
        const classification = sourceCandidate ? 'unmapped-source-candidate' : 'generated-or-injected-unmapped-candidate'
        unmappedAnchors.push({ path, kind: expectedAnchor.kind, classification, expectedOrigin, actualOrigin })
        if (expectedOrigin.source === null && actualOrigin.source === null) {
          counts.bothUnmapped++
          if (sourceCandidate) {
            counts.sourceCandidateUnmapped++
            mismatches.push({ path, reason: 'Both maps omit an anchor also present in the input; origin coverage is unverified', classification })
          }
        }
      }
    }
    catch (error) {
      mismatches.push({ path, reason: 'Cannot trace actual stage mappings', error: String(error) })
    }
  }
  const coverageVerified = mismatches.length === 0 && (counts.matchedMapped > 0 || inputSignatures.size === 0)
  if (!coverageVerified && mismatches.length === 0) {
    mismatches.push({ reason: 'No input-origin anchor was verified; matching empty coverage does not prove map equivalence' })
  }
  return { status, counts, mismatches, unmappedAnchors, coverageVerified, anchorsEqual: mismatches.length === 0 }
}

/** 共享严格结构检查和解析结果；调用者仅在私有诊断内部使用 AST。 */
export function inspectScriptStructure(expectedCode: string, actualCode: string) {
  const before = parse(expectedCode, { sourceType: 'module', attachComment: true })
  const after = parse(actualCode, { sourceType: 'module', attachComment: true })
  const astDifferences = differences(strip(before), strip(after))
  const beforeComments = commentEvidence(before)
  const afterComments = commentEvidence(after)
  const commentDifferences = differences(beforeComments.comments, afterComments.comments)
  const annotationDifferences = differences(beforeComments.annotations, afterComments.annotations)
  return {
    before,
    after,
    astEqual: astDifferences.length === 0,
    astDifferences,
    commentsEqual: commentDifferences.length === 0,
    commentDifferences,
    annotationsEqual: annotationDifferences.length === 0,
    annotationDifferences,
  }
}

/** 对真实阶段产物作严格静态对照；不运行生成代码，也不把结构一致称为 runtime 语义等价。 */
export function inspectTransform(expected: CapturedStageResult, actual: CapturedStageResult, source: string, warningsExpected: CapturedWarning[], warnings: string[]) {
  const { before, after, ...structure } = inspectScriptStructure(expected.code, actual.code)
  const { astDifferences, commentDifferences, annotationDifferences } = structure
  const metadata = (result: CapturedStageResult) => Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'code' && key !== 'map'))
  const metadataDifferences = differences(metadata(expected), metadata(actual))
  const warningDifferences = differences(
    warningsExpected.map(warning => ({ channel: warning.channel, arguments: decodeCapturedData(warning.arguments) })),
    warnings.map(warning => ({ channel: 'handler', arguments: [warning] })),
  )
  const maps = inspectMaps(expected, actual, source, before, after)
  return {
    exactCode: expected.code === actual.code,
    exactMap: isDeepStrictEqual(expected.map, actual.map),
    astEqual: astDifferences.length === 0,
    astDifferences,
    commentsEqual: commentDifferences.length === 0,
    commentDifferences,
    annotationsEqual: annotationDifferences.length === 0,
    annotationDifferences,
    metadataEqual: metadataDifferences.length === 0,
    metadataDifferences,
    warningsEqual: warningDifferences.length === 0,
    warningDifferences,
    mapStatus: maps.status,
    tokens: maps.counts,
    mapCoverageVerified: maps.coverageVerified,
    mapAnchorsEqual: maps.anchorsEqual,
    mapMismatches: maps.mismatches,
    unmappedAnchors: maps.unmappedAnchors,
    comparisonPassed: [astDifferences, commentDifferences, annotationDifferences, metadataDifferences, warningDifferences, maps.mismatches].every(items => items.length === 0),
    limitations: [
      'Only parser position/printing fields are removed from AST comparison; no expression, literal, binding or statement is rewritten or reordered.',
      'Comments retain their exact type, value and order. PURE/NO_SIDE_EFFECTS retain every parser attachment path and placement; this does not prove bundler behavior.',
      'The two actual stage maps are traced independently at equal AST paths into their shared exact input source, including mapping names. No identity or composed map is synthesized.',
      'Origin checks cover identifier/literal/this/super and statement/declaration starts, not every generated token or range. Unmapped generated/injected classifications are candidates, not proven provenance.',
      'Unmapped anchors also found structurally in the input conservatively fail coverage; other unmapped anchors remain visible. Absent maps provide no origin evidence.',
      'Warning strings returned by native are treated as handler calls with one string argument; console channels and additional arguments remain differences.',
      'No real compiler runtime was executed by this oracle. Static comparison is not proof of runtime semantic equivalence, sourcemap completeness or performance.',
      'Matching origins are pairwise evidence; an identical mapping defect in both compilers is not ruled out.',
    ],
  }
}
