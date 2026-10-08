import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import { isDeepStrictEqual } from 'node:util'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { parse } from '@weapp-vite/ast/babel'
import { composeSourceMaps, isEncodedSourceMapLike } from '../../packages-runtime/wevu-compiler/src/utils/sourcemap'

const presentationFields = new Set(['start', 'end', 'loc', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens', 'errors'])
const tokenNodeTypes = new Set(['Identifier', 'NumericLiteral', 'StringLiteral', 'BooleanLiteral', 'NullLiteral', 'BigIntLiteral', 'DecimalLiteral', 'RegExpLiteral', 'DirectiveLiteral', 'TemplateElement', 'ThisExpression', 'Super'])
const commentPlacements = ['leadingComments', 'innerComments', 'trailingComments'] as const
interface Location { line: number, column: number }
interface TokenAnchor { path: string, kind: string, name?: string, location: Location }
interface AnnotationAttachment { path: string, nodeType: string, placement: typeof commentPlacements[number] }
interface Annotation { markers: string[], attachments: AnnotationAttachment[] }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize)
  }
  if (!record(value)) {
    return value
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => !presentationFields.has(key)).map(([key, item]) => [key, normalize(item)]))
}

function anchors(value: unknown, path = '$', output: TokenAnchor[] = []): TokenAnchor[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => anchors(item, `${path}[${index}]`, output))
  }
  else if (record(value)) {
    if (typeof value.type === 'string'
      && (tokenNodeTypes.has(value.type) || value.type.endsWith('Statement') || value.type.endsWith('Declaration'))
      && record(value.loc) && record(value.loc.start)) {
      output.push({ path, kind: value.type, ...(typeof value.name === 'string' ? { name: value.name } : {}), location: value.loc.start as unknown as Location })
    }
    for (const [key, item] of Object.entries(value)) {
      if (!presentationFields.has(key)) {
        anchors(item, `${path}.${key}`, output)
      }
    }
  }
  return output
}

function comments(ast: unknown) {
  if (!record(ast) || !Array.isArray(ast.comments)) {
    return []
  }
  return ast.comments.filter(record).map(comment => String(comment.value).trim().replaceAll(/\s+/g, ' '))
}

/** 保留 annotation 的全部语法归属；不把 parser attachment 变化猜测成等价的 bundler 行为。 */
function annotations(ast: unknown): Annotation[] {
  if (!record(ast) || !Array.isArray(ast.comments)) {
    return []
  }
  const indexed = new Map<string, Annotation>()
  for (const comment of ast.comments.filter(record)) {
    const markers = String(comment.value).match(/[@#]__(?:PURE|NO_SIDE_EFFECTS)__/g)
    if (markers) {
      indexed.set(`${comment.start}:${comment.end}`, { markers, attachments: [] })
    }
  }
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
    }
    else if (record(value)) {
      if (typeof value.type === 'string') {
        for (const placement of commentPlacements) {
          const attached = value[placement]
          if (Array.isArray(attached)) {
            for (const comment of attached.filter(record)) {
              indexed.get(`${comment.start}:${comment.end}`)?.attachments.push({ path, nodeType: value.type, placement })
            }
          }
        }
      }
      for (const [key, item] of Object.entries(value)) {
        if (!presentationFields.has(key)) {
          visit(item, `${path}.${key}`)
        }
      }
    }
  }
  visit(ast, '$')
  return [...indexed.values()]
}

function parseJavaScript(source: string) {
  return parse(source, { sourceType: 'module', attachComment: true })
}

/** 字节差异始终保留；只把位置/打印信息从结构对照中移除，不折叠布尔值或改写表达式。 */
export function inspectRoundTrip(input: string, code: string, sourceMap: unknown, filename: string, upstreamMap?: unknown) {
  const before = parseJavaScript(input)
  const after = parseJavaScript(code)
  const astEqual = isDeepStrictEqual(normalize(before), normalize(after))
  const beforeComments = comments(before)
  const afterComments = comments(after)
  const commentsEqual = isDeepStrictEqual(beforeComments, afterComments)
  const beforeAnnotations = annotations(before)
  const afterAnnotations = annotations(after)
  const annotationsEqual = isDeepStrictEqual(beforeAnnotations, afterAnnotations)
  if (!record(sourceMap) || sourceMap.version !== 3 || !Array.isArray(sourceMap.sources)
    || sourceMap.sources.length !== 1 || sourceMap.sources[0] !== filename
    || !Array.isArray(sourceMap.sourcesContent) || sourceMap.sourcesContent.length !== 1 || sourceMap.sourcesContent[0] !== input
    || typeof sourceMap.mappings !== 'string' || !Array.isArray(sourceMap.names)) {
    throw new Error('Native printer map must identify its exact original JS source')
  }
  const map = new TraceMap(sourceMap as unknown as EncodedSourceMap)
  if (upstreamMap != null && !isEncodedSourceMapLike(upstreamMap)) {
    throw new TypeError('Invalid upstream stage map')
  }
  const upstream = upstreamMap == null ? undefined : new TraceMap(upstreamMap as EncodedSourceMap)
  const composedMap = upstreamMap == null ? undefined : composeSourceMaps(sourceMap as unknown as Parameters<typeof composeSourceMaps>[0], upstreamMap)
  const combined = composedMap ? new TraceMap(composedMap as EncodedSourceMap) : undefined
  const original = new Map(anchors(before).map(anchor => [anchor.path, anchor]))
  const generated = anchors(after)
  const mismatches: unknown[] = []
  const identifiers = {
    original: [...original.values()].filter(anchor => anchor.kind === 'Identifier').length,
    generated: generated.filter(anchor => anchor.kind === 'Identifier').length,
    matched: 0,
    composed: 0,
    upstreamUnmapped: 0,
  }
  const tokens = { original: original.size, generated: generated.length, matched: 0, composed: 0, upstreamUnmapped: 0 }
  for (const anchor of generated) {
    const expected = original.get(anchor.path)
    if (!expected || expected.kind !== anchor.kind || expected.name !== anchor.name) {
      mismatches.push({ path: anchor.path, reason: 'AST token anchor changed', actual: anchor.kind, expected: expected?.kind, actualName: anchor.name, expectedName: expected?.name })
      continue
    }
    const traced = originalPositionFor(map, anchor.location)
    if (traced.source !== filename || traced.line !== expected.location.line || traced.column !== expected.location.column) {
      mismatches.push({ path: anchor.path, reason: 'Original token position differs', generated: anchor.location, traced, expected: expected.location })
      continue
    }
    tokens.matched++
    if (anchor.kind === 'Identifier') {
      identifiers.matched++
    }
    if (upstream && combined) {
      const expectedOrigin = originalPositionFor(upstream, expected.location)
      const actualOrigin = originalPositionFor(combined, anchor.location)
      if (expectedOrigin.source !== actualOrigin.source || expectedOrigin.line !== actualOrigin.line || expectedOrigin.column !== actualOrigin.column) {
        mismatches.push({ path: anchor.path, reason: 'Composed source origin differs', expectedOrigin, actualOrigin })
        continue
      }
      tokens.composed++
      if (anchor.kind === 'Identifier') {
        identifiers.composed++
      }
      if (expectedOrigin.source === null) {
        tokens.upstreamUnmapped++
        if (anchor.kind === 'Identifier') {
          identifiers.upstreamUnmapped++
        }
      }
    }
  }
  if (generated.length !== original.size) {
    mismatches.push({ reason: 'Token anchor count differs', generated: generated.length, original: original.size })
  }
  return {
    exactCode: code === input,
    astEqual,
    commentsEqual,
    annotationsEqual,
    commentCount: { original: beforeComments.length, generated: afterComments.length },
    commentDifferences: commentsEqual ? undefined : { original: beforeComments, generated: afterComments },
    annotationCount: { original: beforeAnnotations.length, generated: afterAnnotations.length },
    annotationDifferences: annotationsEqual ? undefined : { original: beforeAnnotations, generated: afterAnnotations },
    identifiers,
    tokens,
    mapMismatches: mismatches,
    comparisonPassed: astEqual && commentsEqual && annotationsEqual && mismatches.length === 0,
    limitations: [
      'Location-free AST equality is structural evidence, not a proof of every observable JavaScript behavior, including Function.prototype.toString.',
      'Comments are compared in order after whitespace normalization; PURE and NO_SIDE_EFFECTS also retain every parser attachment path and placement. Other tool-specific annotations are not interpreted.',
      'Mapping checks cover identifier, literal, this/super and statement/declaration starts, including UTF-16 positions, not every token/end position, breakpoint policy or mapping name. Empty/comment-only programs have no token anchors.',
      'Actual composed maps are queried through the existing stage map; they do not establish correct origins for newly synthesized template metadata expressions.',
      'This prints already transformed JS. It does not implement Vue/Wevu rewrites or measure complete compiler performance.',
    ],
  }
}
