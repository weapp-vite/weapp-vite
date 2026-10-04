import type { InlineOriginOccurrence, InlineProvenance } from './origins/types'
import { createHash } from 'node:crypto'
import { encode } from '@jridgewell/sourcemap-codec'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { validateInlineProvenance, verifyInlineOriginMap } from './originChecks'

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function identity(occurrence: InlineOriginOccurrence) {
  const { sourceId, inlineId, expression, callee } = occurrence
  occurrence.id = `occurrence:${hash([sourceId, inlineId, expression.start, expression.end, callee.start, callee.end, callee.name])}`
}

function fixture(expressions = ['jump(\'/one\')'], names = expressions.map(() => 'jump')) {
  const source = `<script setup>const 标签 = '😀'</script>\r\n<template>\r\n${expressions.map(exp => `<button @tap="${exp}" />`).join('\r\n')}\r\n</template>`
  const scenario = { kind: 'sfc', filename: 'src/pages/source.vue', source }
  const sourceId = `source:${hash([scenario.filename, source])}`
  let from = 0
  const provenance: InlineProvenance = {
    schemaVersion: 1,
    coordinateEncoding: 'utf16',
    sources: [{ id: sourceId, filename: scenario.filename, content: source }],
    occurrences: expressions.map((raw, index) => {
      const text = raw.trim()
      const offset = source.indexOf(`@tap="${raw}"`, from) + '@tap="'.length
      from = offset + raw.length
      const start = offset + raw.length - raw.trimStart().length
      const item: InlineOriginOccurrence = {
        id: '',
        kind: 'inline-handler-callee',
        sourceId,
        inlineId: `i${index.toString(36)}`,
        expression: { start, end: start + text.length, text },
        callee: { start, end: start + names[index]!.length, name: names[index]! },
      }
      identity(item)
      return item
    }),
  }
  const options = {
    inlineExpressions: expressions.map((raw, index) => ({
      id: `i${index.toString(36)}`,
      expression: `_ctx.${raw.trim()}${raw.trim() === names[index] ? '(_event)' : ''}`,
      parameterNames: { context: '_ctx', scope: '_scope', event: '_event' },
    })),
  }
  return { scenario, provenance, options }
}

describe('independent inline source ownership', () => {
  it('accepts omitted provenance without inventing coverage', () => {
    expect(validateInlineProvenance(undefined, { kind: 'script', filename: 'entry.ts', source: '' }, {})).toBeUndefined()
  })

  it('owns trimmed direct calls and synthetic simple-handler bridges at original UTF-16 coordinates', () => {
    const { scenario, provenance, options } = fixture(['  jump(\'/one\')  ', 'jump', '标签(\'😀\')'], ['jump', 'jump', '标签'])
    expect(validateInlineProvenance(provenance, scenario, options)).toEqual(provenance)
    expect(provenance.occurrences[1]!.expression.text).toBe('jump')
  })

  it('preserves repeated text as separate occurrences in real registration order', () => {
    const { scenario, provenance, options } = fixture(['jump()', 'jump()'])
    expect(validateInlineProvenance(provenance, scenario, options)).toEqual(provenance)
    const [first, second] = provenance.occurrences
    ;[first!.inlineId, second!.inlineId] = [second!.inlineId, first!.inlineId]
    provenance.occurrences.forEach(identity)
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('registration order')
  })

  it('certifies the callee independently of already rewritten loop arguments', () => {
    const { scenario, provenance, options } = fixture(['jump(category.path)'])
    options.inlineExpressions[0]!.expression = '_ctx.jump(_scope.category.path)'
    expect(validateInlineProvenance(provenance, scenario, options)).toEqual(provenance)
  })

  it('rejects UTF-8 byte offsets presented as UTF-16 source coordinates', () => {
    const { scenario, provenance, options } = fixture(['标签(\'😀\')'], ['标签'])
    const occurrence = provenance.occurrences[0]!
    const bytes = new TextEncoder().encode(scenario.source.slice(0, occurrence.callee.start)).length
    occurrence.callee.end += bytes - occurrence.callee.start
    occurrence.callee.start = bytes
    identity(occurrence)
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('span')
  })

  it.each(['omitted', 'reordered', 'duplicate'])('rejects %s same-name evidence', (change) => {
    const { scenario, provenance, options } = fixture(['jump()', 'jump()'])
    if (change === 'omitted') {
      provenance.occurrences.pop()
    }
    else if (change === 'reordered') {
      provenance.occurrences.reverse()
    }
    else {
      provenance.occurrences.push(provenance.occurrences[0]!)
    }
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow(/coverage|reordered|duplicate/)
  })

  it.each(['content', 'filename', 'hash', 'coordinate', 'script', 'null'])('rejects malformed or foreign %s owners', (change) => {
    const { scenario, provenance, options } = fixture()
    if (change === 'content') {
      provenance.sources[0]!.content += ' '
    }
    if (change === 'filename') {
      provenance.sources[0]!.filename = 'src/pages/other.vue'
    }
    if (change === 'hash') {
      provenance.sources[0]!.id = 'source:wrong'
    }
    if (change === 'coordinate') {
      Object.assign(provenance, { coordinateEncoding: 'utf8' })
    }
    if (change === 'script') {
      scenario.kind = 'script'
    }
    expect(() => validateInlineProvenance(change === 'null' ? null : provenance, scenario, options)).toThrow()
  })

  it('rejects a same-named argument token substituted for the direct callee', () => {
    const { scenario, provenance, options } = fixture(['jump(jump)'])
    const occurrence = provenance.occurrences[0]!
    occurrence.callee.start += 5
    occurrence.callee.end += 5
    identity(occurrence)
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('exact template directive callee')
  })

  it('does not borrow a same-named string from a non-event attribute', () => {
    const { scenario, provenance, options } = fixture()
    scenario.source = scenario.source.replace('@tap=', 'title=')
    const source = provenance.sources[0]!
    source.content = scenario.source
    source.id = `source:${hash([source.filename, source.content])}`
    const occurrence = provenance.occurrences[0]!
    occurrence.sourceId = source.id
    occurrence.expression.start++
    occurrence.expression.end++
    occurrence.callee.start++
    occurrence.callee.end++
    identity(occurrence)
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('exact template directive callee')
  })

  it('fails closed on entity decoding and normalization that changes raw source offsets', () => {
    const entity = fixture(['jump(&quot;x&quot;)'])
    entity.options.inlineExpressions[0]!.expression = '_ctx.jump("x")'
    expect(() => validateInlineProvenance(entity.provenance, entity.scenario, entity.options)).toThrow('exact template directive callee')
    const crlf = fixture()
    const occurrence = crlf.provenance.occurrences[0]!
    occurrence.expression.start -= 2
    occurrence.expression.end -= 2
    occurrence.callee.start -= 2
    occurrence.callee.end -= 2
    identity(occurrence)
    expect(() => validateInlineProvenance(crlf.provenance, crlf.scenario, crlf.options)).toThrow('span')
  })

  it.each(['renamed', 'wrong-context', 'computed', 'optional', 'order', 'missing'])('rejects actual asset %s callee drift', (change) => {
    const { scenario, provenance, options } = fixture()
    const asset = options.inlineExpressions[0]!
    if (change === 'renamed') {
      asset.expression = '_ctx.other()'
    }
    if (change === 'wrong-context') {
      asset.expression = '_scope.jump()'
    }
    if (change === 'computed') {
      asset.expression = '_ctx["jump"]()'
    }
    if (change === 'optional') {
      asset.expression = '_ctx.jump?.()'
    }
    if (change === 'order') {
      asset.id = 'i1'
    }
    if (change === 'missing') {
      options.inlineExpressions = []
    }
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow()
  })

  it('allows slot subtrees without direct handlers because they do not affect their relative order', () => {
    const { scenario, provenance, options } = fixture(['jump()'])
    scenario.source = scenario.source.replace('</template>', '<slot /><template #goods-price><text>price</text></template></template>')
    const source = provenance.sources[0]!
    source.content = scenario.source
    source.id = `source:${hash([source.filename, source.content])}`
    provenance.occurrences[0]!.sourceId = source.id
    identity(provenance.occurrences[0]!)
    expect(validateInlineProvenance(provenance, scenario, options)).toEqual(provenance)
  })

  it.each(['<template #goods-price>', '<slot>'])('rejects same-text slot handlers that can change source ordinals under %s', (opening) => {
    const { scenario, provenance, options } = fixture(['jump()'])
    const closing = opening.startsWith('<template') ? '</template>' : '</slot>'
    scenario.source = scenario.source.replace('</template>', `${opening}<button @tap="jump()" />${closing}</template>`)
    const source = provenance.sources[0]!
    source.content = scenario.source
    source.id = `source:${hash([source.filename, source.content])}`
    provenance.occurrences[0]!.sourceId = source.id
    identity(provenance.occurrences[0]!)
    expect(() => validateInlineProvenance(provenance, scenario, options)).toThrow('slot handler traversal')
  })
})

function mappedFixture() {
  const value = fixture()
  const code = `const options = { methods: { ${WEVU_INLINE_MAP_KEY}: { i0: { fn: (_ctx, _scope, _event) => ${value.options.inlineExpressions[0]!.expression} } } } }; export default options;`
  const generatedColumn = code.indexOf('.jump') + 1
  const occurrence = value.provenance.occurrences[0]!
  const original = value.scenario.source.slice(0, occurrence.callee.start).split(/\r\n|[\r\n\u2028\u2029]/)
  const segment: [number, number, number, number, number] = [generatedColumn, 0, original.length - 1, original.at(-1)!.length, 0]
  const map = {
    version: 3,
    names: ['jump'],
    sources: [value.scenario.filename],
    sourcesContent: [value.scenario.source],
    mappings: encode([[segment]]),
  }
  return { ...value, code, segment, map }
}

describe('independent inline output anchors', () => {
  it('follows metadata ownership and checks an exact mapped token', () => {
    const { provenance, options, code, map } = mappedFixture()
    expect(verifyInlineOriginMap(provenance, options, code, map)).toEqual({ checked: 1 })
  })

  it('consumes independent generated CRLF lines and UTF-16 columns', () => {
    const { provenance, options, code, map, segment } = mappedFixture()
    const prefix = 'const label = "😀"; '
    segment[0] += prefix.length
    map.mappings = encode([[], [segment]])
    expect(verifyInlineOriginMap(provenance, options, `// header\r\n${prefix}${code}`, map)).toEqual({ checked: 1 })
  })

  it.each(['glb-only', 'unmapped', 'duplicate', 'source', 'content', 'line', 'column', 'name'])('rejects %s map evidence', (change) => {
    const { provenance, options, code, map, segment } = mappedFixture()
    if (change === 'glb-only') {
      segment[0]--
    }
    if (change === 'source') {
      map.sources[0] = 'different.vue'
    }
    if (change === 'content') {
      map.sourcesContent[0] += ' '
    }
    if (change === 'line') {
      segment[2]++
    }
    if (change === 'column') {
      segment[3]++
    }
    if (change === 'name') {
      map.names[0] = 'another'
    }
    map.mappings = encode([change === 'unmapped' ? [[segment[0]]] : change === 'duplicate' ? [segment, segment] : [segment]])
    expect(() => verifyInlineOriginMap(provenance, options, code, map)).toThrow()
  })

  it('does not accept a correctly mapped decoy outside the metadata path', () => {
    const { provenance, options, code, map } = mappedFixture()
    const changed = code.replace(`methods: { ${WEVU_INLINE_MAP_KEY}`, `decoy: { ${WEVU_INLINE_MAP_KEY}`)
    expect(() => verifyInlineOriginMap(provenance, options, changed, map)).toThrow('methods')
  })

  it('rejects sourceRoot redirects despite the same raw source and segment', () => {
    const { provenance, options, code, map } = mappedFixture()
    expect(() => verifyInlineOriginMap(provenance, options, code, { ...map, sourceRoot: 'another-root/' })).toThrow('source owner')
  })

  it('rejects metadata spreads that can override an otherwise correctly mapped token', () => {
    const { provenance, options, code, map } = mappedFixture()
    expect(() => verifyInlineOriginMap(provenance, options, code.replace('methods: {', 'methods: { ...other,'), map)).toThrow('uncertain override')
  })

  it('rejects a method declaration overriding the certified fn property', () => {
    const { provenance, options, code, map } = mappedFixture()
    expect(() => verifyInlineOriginMap(provenance, options, code.replace('i0: { fn:', 'i0: { fn() {}, fn:'), map)).toThrow('duplicated')
  })

  it('checks the complete emitted asset function and its parameter bindings', () => {
    const { provenance, options, code, map } = mappedFixture()
    expect(() => verifyInlineOriginMap(provenance, options, code.replace('\'/one\'', '\'/two\''), map)).toThrow('function differs')
    expect(() => verifyInlineOriginMap(provenance, options, code.replace('(_ctx,', '(_other,'), map)).toThrow('function differs')
  })
})
