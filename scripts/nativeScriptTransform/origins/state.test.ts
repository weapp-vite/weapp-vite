import { describe, expect, it } from 'vitest'
import { parseBabelExpressionFile } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/parse'
import { generatedCall, originAsset, originFixture, withFixture } from './fixtures'
import { InlineOriginState } from './state'

describe('immutable inline handler origin sidecar', () => {
  it('uses the existing wrapped parser coordinates and preserves original objects and return values', () => {
    const state = new InlineOriginState()
    const fixture = originFixture(['  jump(\'/pages/中文🙂\')  '])
    const directive = fixture.directives[0]!
    const input = directive.exp!.content!.trim()
    const parsed = parseBabelExpressionFile(input)!
    const asset = originAsset('i0', 'jump')
    const result = Object.freeze({ code: 'original complete compiler result' })
    const options = Object.freeze({ inlineExpressions: Object.freeze([asset]) })
    const received = withFixture(state, fixture, () => state.directive(directive, fixture.context, input, () => {
      state.parsed(input, fixture.context, parsed)
      const expression = parsed.expression
      if (expression.type === 'CallExpression') {
        expression.callee.start = 900
        expression.callee.end = 901
      }
      state.registered(asset, fixture.context, generatedCall('jump'))
      return result
    }))
    expect(received).toBe(result)
    expect(options.inlineExpressions[0]).toBe(asset)
    const request = state.requestFor(options)!
    const start = fixture.template.loc.start.offset + directive.exp!.loc!.start.offset + 2
    expect(request).toMatchObject({ schemaVersion: 1, coordinateEncoding: 'utf16', sources: [{ filename: fixture.filename, content: fixture.source }], occurrences: [{ inlineId: 'i0', expression: { start, end: start + input.length, text: input }, callee: { start, end: start + 4, name: 'jump' } }] })
    expect(request.sources[0]!.content.slice(start, start + 4)).toBe('jump')
    request.sources[0]!.content = 'changed detached copy'
    request.occurrences[0]!.callee.start = -1
    expect(state.requestFor(options)!.sources[0]!.content).toBe(fixture.source)
    expect(state.snapshot()).toMatchObject({ sourceCount: 1, occurrenceCount: 1, unsupported: [], templateCalls: 1, directiveCalls: 1, parsedCalls: 1, registeredCalls: 1 })
  })

  it('keeps identical text at different occurrences separate without renumbering real inline ids', () => {
    const state = new InlineOriginState()
    const fixture = originFixture(['jump(1)', 'jump(1)'])
    const assets = [originAsset('i2', 'jump'), originAsset('ic', 'jump')]
    withFixture(state, fixture, () => fixture.directives.forEach((directive, index) => {
      const input = directive.exp!.content!
      state.directive(directive, fixture.context, input, () => {
        state.parsed(input, fixture.context, parseBabelExpressionFile(input))
        state.registered(assets[index]!, fixture.context, generatedCall('jump'))
      })
    }))
    const request = state.requestFor({ inlineExpressions: assets })!
    expect(request.occurrences.map(entry => entry.inlineId)).toEqual(['i2', 'ic'])
    expect(new Set(request.occurrences.map(entry => entry.id)).size).toBe(2)
    expect(request.sources).toHaveLength(1)
    expect(request.occurrences[0]!.expression.start).toBeLessThan(request.occurrences[1]!.expression.start)
    expect(state.requestFor({ inlineExpressions: [assets[0], { ...assets[1] }] })!.occurrences.map(entry => entry.inlineId)).toEqual(['i2'])
    expect(state.snapshot().unsupported).toContainEqual({ stage: 'request', reason: 'inline-asset-has-no-proven-owner', inlineId: 'ic' })
  })

  it('maps only the original identifier when the event bridge adds a call and event argument', () => {
    const state = new InlineOriginState()
    const fixture = originFixture([' showPopup '])
    const asset = originAsset('ia', 'showPopup')
    withFixture(state, fixture, () => state.directive(fixture.directives[0]!, fixture.context, 'showPopup($event)', () => {
      state.parsed('showPopup($event)', fixture.context, parseBabelExpressionFile('showPopup($event)'))
      state.registered(asset, fixture.context, generatedCall('showPopup'))
    }))
    const occurrence = state.requestFor({ inlineExpressions: [asset] })!.occurrences[0]!
    expect(occurrence.expression.text).toBe('showPopup')
    expect(occurrence.callee).toEqual({ start: occurrence.expression.start, end: occurrence.expression.end, name: 'showPopup' })
  })

  it('records copied primitive argument fragments only when generated tokens retain exact source text', () => {
    const state = new InlineOriginState()
    const fixture = originFixture([`jump('/one', 2, true, null)`])
    const directive = fixture.directives[0]!
    const input = directive.exp!.content!
    const asset = { ...originAsset('i0', 'jump'), expression: `_ctx.jump('/one',2,true,null)` }
    const parsed = parseBabelExpressionFile(input)!
    withFixture(state, fixture, () => state.directive(directive, fixture.context, input, () => {
      state.parsed(input, fixture.context, parsed)
      const generated = parsed.expression
      if (generated.type !== 'CallExpression' || generated.callee.type !== 'Identifier') {
        throw new Error('test fixture must parse as a direct call')
      }
      generated.callee = {
        type: 'MemberExpression',
        computed: false,
        object: { type: 'Identifier', name: '_ctx' },
        property: generated.callee,
      }
      // 同一 AST 原地改写后 start/end 不能改写已经观察到的来源摘要；loc 仍供实际生成器读取。
      for (const argument of generated.arguments) {
        argument.start = 0
        argument.end = 1
      }
      state.registered(asset, fixture.context, generated)
    }))

    const occurrence = state.requestFor({ inlineExpressions: [asset] })!.occurrences[0]!
    expect(occurrence.fragments?.map(fragment => ({
      kind: fragment.kind,
      role: fragment.role,
      generated: fragment.generated.text,
      source: fragment.source.text,
    }))).toEqual([
      { kind: 'inline-handler-argument-literal', role: 'copied', generated: `'/one'`, source: `'/one'` },
      { kind: 'inline-handler-argument-literal', role: 'copied', generated: '2', source: '2' },
      { kind: 'inline-handler-argument-literal', role: 'copied', generated: 'true', source: 'true' },
      { kind: 'inline-handler-argument-literal', role: 'copied', generated: 'null', source: 'null' },
    ])
    for (const fragment of occurrence.fragments ?? []) {
      expect(asset.expression.slice(fragment.generated.start, fragment.generated.end)).toBe(fragment.generated.text)
      expect(fixture.source.slice(fragment.source.start, fragment.source.end)).toBe(fragment.source.text)
    }
  })

  it.each([
    { label: 'changed literal spelling', original: `jump('/one')`, generated: `_ctx.jump('/two')` },
    { label: 'changed quote spelling', original: `jump("/one")`, generated: `_ctx.jump('/one')` },
    { label: 'unicode escape rewrite', original: `jump('\\u{1F600}')`, generated: `_ctx.jump('😀')` },
    { label: 'member property outside Phase A', original: 'jump(options.path)', generated: '_ctx.jump(_scope.options.path)' },
    { label: 'mixed primitive and complex arguments', original: 'jump(1, options.path)', generated: '_ctx.jump(1,_scope.options.path)' },
    { label: 'spread argument', original: 'jump(...values)', generated: '_ctx.jump(...values)' },
    { label: 'typescript wrapper', original: 'jump(value as string)', generated: '_ctx.jump(value)' },
    { label: 'literal wrapped in a type assertion', original: 'jump(1 as number)', generated: '_ctx.jump(1)' },
  ])('omits fragments and keeps the asset usable for $label', ({ original, generated: generatedSource }) => {
    const state = new InlineOriginState()
    const fixture = originFixture([original])
    const directive = fixture.directives[0]!
    const asset = { ...originAsset('i0', 'jump'), expression: generatedSource }
    const generated = parseBabelExpressionFile(generatedSource)!.expression
    withFixture(state, fixture, () => state.directive(directive, fixture.context, original, () => {
      state.parsed(original, fixture.context, parseBabelExpressionFile(original))
      state.registered(asset, fixture.context, generated)
    }))

    const occurrence = state.requestFor({ inlineExpressions: [asset] })!.occurrences[0]!
    expect(occurrence.fragments).toBeUndefined()
  })

  it.each(['obj.jump()', 'jump?.()', '(jump())', 'jump() as unknown', '(() => jump())()'])('records unsupported original callee syntax without changing the result: %s', (input) => {
    const state = new InlineOriginState()
    const fixture = originFixture([input])
    const asset = originAsset('i0', 'jump')
    expect(withFixture(state, fixture, () => state.directive(fixture.directives[0]!, fixture.context, input, () => {
      state.parsed(input, fixture.context, parseBabelExpressionFile(input))
      state.registered(asset, fixture.context, generatedCall('jump'))
      return 'untouched'
    }))).toBe('untouched')
    expect(state.requestFor({ inlineExpressions: [asset] })).toBeUndefined()
    expect(state.snapshot().unsupported[0]).toMatchObject({ stage: 'asset', reason: 'unsupported-original-direct-callee', inlineId: 'i0' })
  })

  it('refuses entity-decoded expressions, changed output callees and unowned contexts', () => {
    for (const variant of ['entity', 'generated', 'unowned'] as const) {
      const state = new InlineOriginState()
      const fixture = originFixture([variant === 'entity' ? 'jump(&quot;x&quot;)' : 'jump(1)'])
      const directive = fixture.directives[0]!
      if (variant === 'entity') {
        directive.exp!.content = 'jump("x")'
      }
      const input = directive.exp!.content!
      const asset = originAsset('i0', 'jump')
      const execute = () => {
        state.parsed(input, fixture.context, parseBabelExpressionFile(input))
        state.registered(asset, fixture.context, generatedCall('jump', variant === 'generated' ? 'wrongCtx' : '_ctx'))
      }
      withFixture(state, fixture, () => variant === 'unowned' ? execute() : state.directive(directive, fixture.context, input, execute))
      expect(state.requestFor({ inlineExpressions: [asset] })).toBeUndefined()
      expect(state.snapshot().unsupported[0]!.reason).toBe({ entity: 'directive-expression-slice-mismatch', generated: 'generated-root-callee-not-owned-context-member', unowned: 'missing-directive-owner' }[variant])
    }
  })

  it('refuses external or normalized owners when the exact original slice cannot be established', () => {
    for (const variant of ['external', 'normalized'] as const) {
      const state = new InlineOriginState()
      const fixture = originFixture(['jump(1)'])
      if (variant === 'external') {
        fixture.template.src = './external.html'
      }
      else {
        fixture.source = fixture.source.replace(/\n/g, '\r\n')
      }
      expect(withFixture(state, fixture, () => 42)).toBe(42)
      expect(state.snapshot().unsupported).toEqual([{ stage: 'template', filename: fixture.filename, reason: variant === 'external' ? 'external-template-owner-unconfirmed' : 'template-owner-slice-mismatch' }])
    }
  })

  it('rejects mutated or duplicated assets and clears active owners when the original call throws', () => {
    const state = new InlineOriginState()
    const fixture = originFixture(['jump(1)'])
    const asset = { ...originAsset('i0', 'jump') }
    const thrown = new Error('original failure')
    expect(() => withFixture(state, fixture, () => state.directive(fixture.directives[0]!, fixture.context, 'jump(1)', () => {
      state.parsed('jump(1)', fixture.context, parseBabelExpressionFile('jump(1)'))
      state.registered(asset, fixture.context, generatedCall('jump'))
      expect(() => state.dispose()).toThrow('during')
      throw thrown
    }))).toThrow(thrown)
    expect(state.requestFor({ inlineExpressions: [asset, asset] })).toBeUndefined()
    asset.expression = '_ctx.other(1)'
    expect(state.requestFor({ inlineExpressions: [asset] })).toBeUndefined()
    expect(state.snapshot().unsupported.map(entry => entry.reason)).toEqual(['duplicate-inline-id', 'inline-asset-changed-after-registration'])
    state.dispose()
    state.dispose()
    expect(() => state.requestFor({})).toThrow('active diagnostic owner')
  })

  it('does not lend a failed directive parse to a later unowned asset registration', () => {
    const state = new InlineOriginState()
    const fixture = originFixture(['jump(1)'])
    expect(() => withFixture(state, fixture, () => state.directive(fixture.directives[0]!, fixture.context, 'jump(1)', () => {
      state.parsed('jump(1)', fixture.context, parseBabelExpressionFile('jump(1)'))
      throw new Error('rewrite failed before registration')
    }))).toThrow('rewrite failed before registration')
    const asset = originAsset('i0', 'jump')
    state.registered(asset, fixture.context, generatedCall('jump'))
    expect(state.requestFor({ inlineExpressions: [asset] })).toBeUndefined()
    expect(state.snapshot().unsupported[0]).toMatchObject({ stage: 'asset', reason: 'missing-original-parse-observation' })
  })

  it('refuses duplicate ids even when one of their asset objects is unowned', () => {
    const state = new InlineOriginState()
    const fixture = originFixture(['jump(1)'])
    const asset = originAsset('i0', 'jump')
    withFixture(state, fixture, () => state.directive(fixture.directives[0]!, fixture.context, 'jump(1)', () => {
      state.parsed('jump(1)', fixture.context, parseBabelExpressionFile('jump(1)'))
      state.registered(asset, fixture.context, generatedCall('jump'))
    }))
    expect(state.requestFor({ inlineExpressions: [{ ...asset }, asset] })).toBeUndefined()
    expect(state.snapshot().unsupported.map(entry => entry.reason)).toEqual(['inline-asset-has-no-proven-owner', 'duplicate-inline-id'])
  })
})
