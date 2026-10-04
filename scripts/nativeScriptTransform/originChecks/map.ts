import type * as t from '@babel/types'
import type { EncodedSourceMap } from '@jridgewell/trace-mapping'
import type { InlineProvenance } from '../origins/types'
import { isDeepStrictEqual } from 'node:util'
import { parse } from '@babel/parser'
import { decodedMappings, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { primitiveArguments, validateFragments } from './fragments'
import { assets, ensure, object, semantics } from './shared'

function field(node: t.Node, name: string): t.Expression {
  ensure(node.type === 'ObjectExpression', `metadata ${name} owner is not an object`)
  ensure(node.properties.every(prop => prop.type !== 'SpreadElement'
    && (!(prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') || !prop.computed)), `metadata ${name} contains an uncertain override`)
  const properties = node.properties.filter(prop => (prop.type === 'ObjectProperty' || prop.type === 'ObjectMethod') && !prop.computed
    && (prop.key.type === 'Identifier' ? prop.key.name === name : prop.key.type === 'StringLiteral' && prop.key.value === name))
  ensure(properties.length === 1 && properties[0]!.type === 'ObjectProperty', `metadata ${name} property is missing or duplicated`)
  return properties[0]!.value as t.Expression
}

function metadata(code: string) {
  const program = parse(code, { sourceType: 'module', plugins: ['typescript'] }).program
  const exports = program.body.filter(statement => statement.type === 'ExportDefaultDeclaration')
  ensure(exports.length === 1, 'metadata default export is ambiguous')
  const declaration = exports[0]!.declaration
  let options: t.Node = declaration
  if (declaration.type === 'Identifier') {
    const declarations = program.body.flatMap(statement => statement.type === 'VariableDeclaration' ? statement.declarations : [])
      .filter(item => item.id.type === 'Identifier' && item.id.name === declaration.name)
    ensure(declarations.length === 1 && declarations[0]!.init, 'metadata default export owner is ambiguous')
    options = declarations[0]!.init!
  }
  return field(field(options, 'methods'), WEVU_INLINE_MAP_KEY)
}

function position(content: string, offset: number) {
  const lines = content.slice(0, offset).split(/\r\n|[\r\n\u2028\u2029]/)
  return { line: lines.length - 1, column: lines.at(-1)!.length }
}

function verifyFragmentMap(
  occurrence: InlineProvenance['occurrences'][number],
  asset: ReturnType<typeof assets>[number],
  fn: t.ArrowFunctionExpression,
  map: TraceMap,
  mappings: ReturnType<typeof decodedMappings>,
  owner: { filename: string, content: string },
) {
  if (occurrence.fragments === undefined) {
    return 0
  }
  const checked = validateFragments(occurrence.fragments, occurrence.expression, asset, owner.content)
  const emitted = primitiveArguments(fn.body)
  ensure(emitted.length === checked.length, 'emitted fragment argument coverage differs')
  for (const { fragment, index } of checked) {
    const token = emitted[index]!
    ensure(token.loc, 'generated fragment token has no location')
    const generated = token.loc.start
    const segments = (mappings[generated.line - 1] ?? []).filter(segment => segment[0] === generated.column)
    ensure(segments.length === 1 && segments[0]!.length >= 4, 'fragment needs one explicit mapped anchor')
    const segment = segments[0]!
    ensure(map.sources[segment[1]!] === owner.filename && map.resolvedSources[segment[1]!] === owner.filename
      && map.sourcesContent?.[segment[1]!] === owner.content, 'fragment map source owner differs')
    const original = position(owner.content, fragment.source.start)
    ensure(segment[2] === original.line && segment[3] === original.column, 'fragment exact source anchor differs')
    const consumed = originalPositionFor(map, { line: generated.line, column: generated.column })
    ensure(consumed.source === owner.filename && consumed.line === original.line + 1 && consumed.column === original.column, 'fragment consumer lookup differs from exact anchor')
  }
  return checked.length
}

/** 沿实际 metadata AST 路径取输出 token，要求同列显式映射，不接受 GLB 继承作为来源证据。 */
export function verifyInlineOriginMap(provenance: InlineProvenance, actualOptionsDecoded: unknown, code: string, rawMap: unknown) {
  const mapValue = typeof rawMap === 'string' ? JSON.parse(rawMap) as unknown : rawMap
  const raw = object(mapValue)
  ensure(raw.version === 3 && Array.isArray(raw.sources) && Array.isArray(raw.sourcesContent)
    && Array.isArray(raw.names) && typeof raw.mappings === 'string', 'invalid map shape')
  const map = new TraceMap(raw as unknown as EncodedSourceMap)
  const mappings = decodedMappings(map)
  const inlineMap = metadata(code)
  const actualAssets = assets(actualOptionsDecoded)
  let fragmentsChecked = 0
  for (const occurrence of provenance.occurrences) {
    const asset = actualAssets.find(item => item.id === occurrence.inlineId)
    ensure(asset?.callee?.name === occurrence.callee.name, 'map asset does not own the requested callee')
    const fn = field(field(inlineMap, occurrence.inlineId), 'fn')
    ensure(fn.type === 'ArrowFunctionExpression' && !fn.async && fn.params.length === 3
      && fn.params.every((param, index) => param.type === 'Identifier'
        && param.name === [asset.parameterNames.context, asset.parameterNames.scope, asset.parameterNames.event][index])
      && isDeepStrictEqual(semantics(fn.body), semantics(asset.node)), 'emitted metadata function differs from actual asset')
    const callee = fn.body.type === 'CallExpression' ? fn.body.callee : undefined
    ensure(callee?.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier'
      && callee.property.name === occurrence.callee.name && callee.property.loc, 'emitted metadata callee path differs')
    const token = callee.property
    const generated = token.loc!.start
    ensure(code.slice(token.start!, token.end!) === occurrence.callee.name, 'generated callee token spelling differs')
    const segments = (mappings[generated.line - 1] ?? []).filter(segment => segment[0] === generated.column)
    ensure(segments.length === 1 && segments[0]!.length >= 4, 'callee needs one explicit mapped anchor')
    const segment = segments[0]!
    const owner = provenance.sources.find(source => source.id === occurrence.sourceId)
    ensure(owner && map.sources[segment[1]!] === owner.filename && map.resolvedSources[segment[1]!] === owner.filename
      && map.sourcesContent?.[segment[1]!] === owner.content, 'callee map source owner differs')
    const original = position(owner.content, occurrence.callee.start)
    ensure(segment[2] === original.line && segment[3] === original.column
      && (segment.length < 5 || map.names[segment[4]!] === occurrence.callee.name), 'callee exact source anchor differs')
    const consumed = originalPositionFor(map, { line: generated.line, column: generated.column })
    ensure(consumed.source === owner.filename && consumed.line === original.line + 1 && consumed.column === original.column
      && consumed.name === (segment.length < 5 ? null : occurrence.callee.name), 'consumer lookup differs from exact callee anchor')
    fragmentsChecked += verifyFragmentMap(occurrence, asset, fn, map, mappings, owner)
  }
  return { checked: provenance.occurrences.length, fragmentsChecked }
}
