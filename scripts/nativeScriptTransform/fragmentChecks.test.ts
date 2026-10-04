import type { SourceMapSegment } from '@jridgewell/sourcemap-codec'
import type { InlineProvenance } from './origins/types'
import { createHash } from 'node:crypto'
import { encode } from '@jridgewell/sourcemap-codec'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { validateInlineProvenance, verifyInlineOriginMap } from './originChecks'

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function position(content: string, offset: number) {
  const lines = content.slice(0, offset).split(/\r\n|[\r\n\u2028\u2029]/)
  return { line: lines.length - 1, column: lines.at(-1)!.length }
}

function fixture(args = ['\'/one\'', '2', 'true', 'null'], printed = args) {
  const prefix = '<script>const 中文 = "😀";</script>\r\n<template><button @tap="'
  const input = `jump(${args.join(', ')})`
  const source = `${prefix}${input}" /></template>`
  const scenario = { kind: 'sfc', filename: 'pages/fragments.vue', source }
  const sourceId = `source:${hash([scenario.filename, source])}`
  const expression = { start: prefix.length, end: prefix.length + input.length, text: input }
  const callee = { start: prefix.length, end: prefix.length + 4, name: 'jump' }
  const provenance: InlineProvenance = {
    schemaVersion: 1,
    coordinateEncoding: 'utf16',
    sources: [{ id: sourceId, filename: scenario.filename, content: source }],
    occurrences: [{
      id: `occurrence:${hash([sourceId, 'i0', expression.start, expression.end, callee.start, callee.end, callee.name])}`,
      kind: 'inline-handler-callee',
      sourceId,
      inlineId: 'i0',
      expression,
      callee,
      fragments: [],
    }],
  }
  const occurrence = provenance.occurrences[0]!
  const asset = { id: 'i0', expression: `_ctx.jump(${args.join(',')})`, parameterNames: { context: '_ctx', scope: '_scope', event: '_event' } }
  const options = { inlineExpressions: [asset] }
  const outputPrefix = `export default { methods: { ${WEVU_INLINE_MAP_KEY}: { i0: { fn: (_ctx, _scope, _event) => _ctx.jump(`
  const code = `${outputPrefix}${printed.join(', ')} ) } } } };`
  const calleePosition = position(source, callee.start)
  const segments: SourceMapSegment[] = [[outputPrefix.length - 'jump('.length, 0, calleePosition.line, calleePosition.column, 0]]
  let originalStart = prefix.length + 'jump('.length
  let assetStart = '_ctx.jump('.length
  let outputStart = outputPrefix.length
  for (const [index, text] of args.entries()) {
    occurrence.fragments!.push({
      kind: 'inline-handler-argument-literal',
      role: 'copied',
      source: { start: originalStart, end: originalStart + text.length, text },
      generated: { start: assetStart, end: assetStart + text.length, text },
    })
    const original = position(source, originalStart)
    segments.push([outputStart, 0, original.line, original.column])
    originalStart += text.length + 2
    assetStart += text.length + 1
    outputStart += printed[index]!.length + 2
  }
  const map = { version: 3, names: ['jump'], sources: [scenario.filename], sourcesContent: [source], mappings: encode([segments]) }
  return { scenario, provenance, options, occurrence, code, map, segments }
}

describe('independent primitive argument provenance', () => {
  it('checks source and actual emitted AST tokens despite printer whitespace and quotes', () => {
    const { scenario, provenance, options, code, map } = fixture(['\'😀\'', '2', 'true', 'null'], ['"😀"', '2', 'true', 'null'])
    expect(validateInlineProvenance(provenance, scenario, options)).toEqual(provenance)
    expect(verifyInlineOriginMap(provenance, options, code, map)).toEqual({ checked: 1, fragmentsChecked: 4 })
  })

  it.each(['missing', 'duplicate', 'reordered', 'source-range', 'generated-range', 'source-text', 'generated-text', 'kind', 'role', 'empty', 'fractional', 'surrogate'])('rejects %s fragment evidence', (mutation) => {
    const { scenario, provenance, options, occurrence, code, map } = fixture(['\'😀\'', '2', 'true', 'null'])
    const fragments = occurrence.fragments!
    const first = fragments[0]!
    if (mutation === 'missing') {
      fragments.pop()
    }
    if (mutation === 'duplicate') {
      fragments[1] = structuredClone(first)
    }
    if (mutation === 'reordered') {
      fragments.reverse()
    }
    if (mutation === 'source-range') {
      first.source.start++
    }
    if (mutation === 'generated-range') {
      first.generated.start++
    }
    if (mutation === 'source-text') {
      first.source.text = '\'other\''
    }
    if (mutation === 'generated-text') {
      first.generated.text = '\'other\''
    }
    if (mutation === 'kind') {
      Object.assign(first, { kind: 'inline-handler-argument-member-property' })
    }
    if (mutation === 'role') {
      Object.assign(first, { role: 'guessed' })
    }
    if (mutation === 'empty') {
      occurrence.fragments = []
    }
    if (mutation === 'fractional') {
      first.source.start += 0.5
    }
    if (mutation === 'surrogate') {
      first.source.start += 2
      first.source.end = first.source.start + 1
      first.source.text = '\uDE00'
    }
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow(/fragment/)
    expect(() => verifyInlineOriginMap(provenance, options, code, map)).toThrow(/fragment/)
  })

  it.each(['glb', 'unmapped', 'duplicate', 'source', 'column'])('rejects %s argument map anchors while the callee anchor stays correct', (mutation) => {
    const { provenance, options, code, map, segments } = fixture()
    const literal = segments[1]!
    if (mutation === 'glb') {
      literal[0]--
    }
    if (mutation === 'unmapped') {
      segments[1] = [literal[0]]
    }
    if (mutation === 'duplicate') {
      segments.splice(1, 0, literal)
    }
    if (mutation === 'source') {
      map.sources.push('other.vue')
      map.sourcesContent.push('other')
      literal[1] = 1
    }
    if (mutation === 'column') {
      literal[3]!++
    }
    map.mappings = encode([segments])
    expect(() => verifyInlineOriginMap(provenance, options, code, map)).toThrow(/fragment/)
  })

  it('does not exchange two identically spelled arguments', () => {
    const { scenario, provenance, options, occurrence } = fixture(['1', '1'])
    occurrence.fragments!.reverse()
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('argument token')
  })

  it.each(['item.path', '...values', 'value as string', '-1', '() => 1', '$event'])('rejects fragment claims for complex argument %s', (argument) => {
    const { scenario, provenance, options } = fixture(['1', argument])
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('unsupported fragment argument')
  })
})
