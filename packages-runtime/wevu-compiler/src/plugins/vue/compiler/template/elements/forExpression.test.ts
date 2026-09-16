import type { TemplateCompileResult } from '../types'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildClassStyleComputedCode } from '../../../transform/classStyleComputed'
import { compileVueTemplateToWxml } from '../../template'

function evaluateRuntimeBindings(
  compiled: TemplateCompileResult,
  state: Record<string, unknown>,
) {
  const generated = buildClassStyleComputedCode(compiled.classStyleBindings ?? [], {
    normalizeClassName: '__wevuNormalizeClass',
    normalizeStyleName: '__wevuNormalizeStyle',
    unrefName: '__wevuUnref',
  })
  expect(generated).toBeTruthy()
  const computed = runInNewContext(`(${generated})`, {
    __wevuUnref: (value: unknown) => value,
    console,
  }) as Record<string, (this: Record<string, unknown>) => unknown>
  const context: Record<string, unknown> = {
    $state: state,
    __wevuProps: {},
    ...state,
  }
  for (const binding of compiled.classStyleBindings ?? []) {
    context[binding.name] = computed[binding.name]?.call(context)
  }
  return context
}

function evaluateResolver(
  expression: string,
  context: Record<string, unknown>,
  scope: Record<string, unknown>,
) {
  const resolver = runInNewContext(`(${expression})`) as (
    ctx: Record<string, unknown>,
    indexes: Record<string, unknown>,
  ) => unknown
  return resolver(context, scope)
}

describe('v-for item patterns', () => {
  it('applies defaults only to undefined and excludes bound object-rest keys', () => {
    const compiled = compileVueTemplateToWxml(`
<view
  v-for="({ id, label: title = 'fallback', ...rest }, index) in items"
  :key="id"
  @tap="capture(id, title, rest, index)"
>
  {{ id }}|{{ title }}|{{ rest.extra }}|{{ rest.id }}|{{ rest.label }}
</view>
    `.trim(), '/project/src/pages/issue-1011/index.vue')
    const items = [
      { id: 'missing', label: undefined, extra: 'A' },
      { id: 'null', label: null, extra: 'B' },
      { id: 'zero', label: 0, extra: 'C' },
      { id: 'false', label: false, extra: 'D' },
    ]

    expect(compiled.diagnostics).toEqual([])
    const context = evaluateRuntimeBindings(compiled, { items })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    const projected = context[bindingName ?? ''] as Array<Record<string, unknown>>
    expect(JSON.parse(JSON.stringify(projected))).toEqual([
      { id: 'missing', title: 'fallback', rest: { extra: 'A' } },
      { id: 'null', title: null, rest: { extra: 'B' } },
      { id: 'zero', title: 0, rest: { extra: 'C' } },
      { id: 'false', title: false, rest: { extra: 'D' } },
    ])

    const resolvers = Object.fromEntries(
      compiled.inlineExpressions?.[0]?.scopeResolvers?.map(resolver => [resolver.key, resolver.expression]) ?? [],
    ) as Record<string, string>
    for (const [index, expected] of projected.entries()) {
      const scope = { __wv_i0: index }
      expect(evaluateResolver(resolvers.title!, context, scope)).toBe(expected.title)
      expect(JSON.parse(JSON.stringify(evaluateResolver(resolvers.rest!, context, scope)))).toEqual(expected.rest)
    }
  })

  it('preserves numeric items before applying defaults and resolving event scopes', () => {
    const compiled = compileVueTemplateToWxml(
      '<view v-for="(value = \'fallback\', index) in count" @tap="capture(value, index)">{{ value }}</view>',
      'src/pages/issue-1011/numeric.vue',
    )
    const context = evaluateRuntimeBindings(compiled, { count: 2 })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    expect(context[bindingName ?? '']).toEqual([{ value: 0 }, { value: 1 }])

    const resolver = compiled.inlineExpressions?.[0]?.scopeResolvers?.find(item => item.key === 'value')
    if (!resolver) {
      throw new Error('未生成数字循环项解析器。')
    }
    expect(evaluateResolver(resolver.expression, context, { __wv_i0: 0 })).toBe(0)
    expect(evaluateResolver(resolver.expression, context, { __wv_i0: 1 })).toBe(1)
  })

  it('keeps outer aliases visible to nested defaults in interpolation and event resolvers', () => {
    const compiled = compileVueTemplateToWxml(`
<view v-for="({ sectionName, rows }, sectionIndex) in sections" :key="sectionIndex">
  <button
    v-for="({ id, label = sectionName, ...rest }, rowIndex) in rows"
    :key="id"
    @tap="capture(sectionName, label, rest, rowIndex)"
  >
    {{ sectionName }}|{{ label }}|{{ rest.extra }}
  </button>
</view>
    `.trim(), '/project/src/pages/issue-1011/nested.vue')
    const sections = [{
      sectionName: 'outer-fallback',
      rows: [{ id: 'nested', label: undefined, extra: 'kept' }],
    }]

    expect(compiled.diagnostics).toEqual([])
    const context = evaluateRuntimeBindings(compiled, { sections })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    const projectedBySection = context[bindingName ?? ''] as Array<Array<Record<string, unknown>>>
    expect(JSON.parse(JSON.stringify(projectedBySection))).toEqual([[
      { id: 'nested', label: 'outer-fallback', rest: { extra: 'kept' } },
    ]])

    const resolvers = Object.fromEntries(
      compiled.inlineExpressions?.[0]?.scopeResolvers?.map(resolver => [resolver.key, resolver.expression]) ?? [],
    ) as Record<string, string>
    const scope = { __wv_i0: 0, __wv_i1: 0 }
    expect(evaluateResolver(resolvers.sectionName!, context, scope)).toBe('outer-fallback')
    expect(evaluateResolver(resolvers.label!, context, scope)).toBe('outer-fallback')
    expect(JSON.parse(JSON.stringify(evaluateResolver(resolvers.rest!, context, scope)))).toEqual({ extra: 'kept' })
  })

  it('projects array rest before WXML rendering and keeps event scope on the same values', () => {
    const compiled = compileVueTemplateToWxml(
      '<view v-for="([head, ...tail], index) in rows" @tap="capture(head, tail, index)">{{ head }}|{{ tail[0] }}|{{ tail[1] }}</view>',
      '/project/src/pages/issue-1011/array-rest.vue',
    )
    const rows = [['head', 'a', 'b']]

    expect(compiled.diagnostics).toEqual([])
    expect(compiled.classStyleBindings).toHaveLength(1)
    expect(compiled.code).not.toContain('.slice(')
    expect(compiled.code).toContain('{{__wv_item_0.head}}|{{__wv_item_0.tail[0]}}|{{__wv_item_0.tail[1]}}')
    const context = evaluateRuntimeBindings(compiled, { rows })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    const projected = context[bindingName ?? ''] as Array<{ head: string, tail: string[] }>
    expect(JSON.parse(JSON.stringify(projected))).toEqual([
      { head: 'head', tail: ['a', 'b'] },
    ])

    const resolvers = Object.fromEntries(
      compiled.inlineExpressions?.[0]?.scopeResolvers?.map(resolver => [resolver.key, resolver.expression]) ?? [],
    ) as Record<string, string>
    const scope = { __wv_i0: 0 }
    expect(evaluateResolver(resolvers.head!, context, scope)).toBe(projected[0]?.head)
    expect(evaluateResolver(resolvers.tail!, context, scope)).toBe(projected[0]?.tail)
  })

  it('keeps simple array destructuring on the allocation-free WXML path', () => {
    const compiled = compileVueTemplateToWxml(
      '<view v-for="([head, second], index) in rows" @tap="capture(head, second, index)">{{ head }}|{{ second }}</view>',
      '/project/src/pages/issue-1011/simple-array.vue',
    )

    expect(compiled.diagnostics).toEqual([])
    expect(compiled.classStyleBindings).toBeUndefined()
    expect(compiled.code).toContain('{{__wv_item_0[0]}}|{{__wv_item_0[1]}}')
  })

  it.each([
    { kind: 'array', alias: '__wv_for_pattern_source_0' },
    { kind: 'array', alias: '__wv_for_pattern_item_0' },
    { kind: 'array', alias: '__wv_for_pattern_index_0' },
    { kind: 'object', alias: '__wv_for_pattern_source_0' },
    { kind: 'object', alias: '__wv_for_pattern_result_0' },
    { kind: 'object', alias: '__wv_for_pattern_keys_0' },
    { kind: 'object', alias: '__wv_for_pattern_loop_index_0' },
    { kind: 'object', alias: '__wv_for_pattern_key_0' },
    { kind: 'object', alias: '__wv_for_pattern_item_0' },
  ])('keeps generated $kind projection locals hygienic against outer alias $alias', ({ kind, alias }) => {
    const compiled = compileVueTemplateToWxml(`
<view v-for="${alias} in parents">
  <button
    v-for="({ label = ${alias}.fallback, ...rest }, position) in ${alias}.rows"
    @tap="capture(label, rest)"
  >
    {{ label }}|{{ rest.keep }}
  </button>
</view>
    `.trim(), '/project/src/pages/issue-1011/hygiene.vue')
    const rows = kind === 'array'
      ? [{ label: undefined, keep: 'kept' }]
      : { entry: { label: undefined, keep: 'kept' } }
    const parents = [{ fallback: `outer-${kind}`, rows }]

    expect(compiled.diagnostics).toEqual([])
    const context = evaluateRuntimeBindings(compiled, { parents })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    const projectedByParent = context[bindingName ?? ''] as unknown[]
    const firstProjection = projectedByParent[0]
    const projected = kind === 'array'
      ? (Array.isArray(firstProjection) ? firstProjection[0] : undefined)
      : (firstProjection && typeof firstProjection === 'object'
          ? (firstProjection as Record<string, unknown>).entry
          : undefined)
    expect(JSON.parse(JSON.stringify(projected))).toEqual({
      label: `outer-${kind}`,
      rest: { keep: 'kept' },
    })

    const resolvers = Object.fromEntries(
      compiled.inlineExpressions?.[0]?.scopeResolvers?.map(resolver => [resolver.key, resolver.expression]) ?? [],
    ) as Record<string, string>
    const scope = { __wv_i0: 0, __wv_i1: kind === 'array' ? 0 : 'entry' }
    expect(evaluateResolver(resolvers.label!, context, scope)).toBe(`outer-${kind}`)
    expect(JSON.parse(JSON.stringify(evaluateResolver(resolvers.rest!, context, scope)))).toEqual({ keep: 'kept' })
  })

  it('preserves every own enumerable object-source key in the projected loop', () => {
    const compiled = compileVueTemplateToWxml(
      '<view v-for="({ label = \'fallback\', ...rest }, sourceKey) in records" @tap="capture(label, rest, sourceKey)">{{ label }}|{{ rest.keep }}</view>',
      'src/pages/issue-1011/object-keys.vue',
    )
    const records: Record<string, { label?: string, keep: string }> = {
      safe: { label: 'safe-label', keep: 'safe-keep' },
    }
    Object.defineProperty(records, '__proto__', {
      configurable: true,
      enumerable: true,
      value: { label: 'proto-label', keep: 'proto-keep' },
      writable: true,
    })

    expect(compiled.diagnostics).toEqual([])
    const context = evaluateRuntimeBindings(compiled, { records })
    const bindingName = compiled.classStyleBindings?.[0]?.name
    const projected = context[bindingName ?? ''] as Record<string, Record<string, unknown>>
    expect(Object.keys(projected)).toEqual(['safe', '__proto__'])
    expect(Object.prototype.hasOwnProperty.call(projected, '__proto__')).toBe(true)
    const protoEntry = Object.getOwnPropertyDescriptor(projected, '__proto__')?.value
    expect(JSON.parse(JSON.stringify(protoEntry))).toEqual({
      label: 'proto-label',
      rest: { keep: 'proto-keep' },
    })

    const resolvers = Object.fromEntries(
      compiled.inlineExpressions?.[0]?.scopeResolvers?.map(resolver => [resolver.key, resolver.expression]) ?? [],
    ) as Record<string, string>
    const scope = { __wv_i0: '__proto__' }
    expect(evaluateResolver(resolvers.label!, context, scope)).toBe('proto-label')
    expect(JSON.parse(JSON.stringify(evaluateResolver(resolvers.rest!, context, scope)))).toEqual({ keep: 'proto-keep' })
  })

  it.each([
    {
      source: '<view v-for="({ id, ...rest }, key, index) in records">{{ rest }}</view>',
      expression: '({ id, ...rest }, key, index) in records',
    },
    {
      source: '<view v-for="([head, ...tail], key, index) in rows">{{ tail }}</view>',
      expression: '([head, ...tail], key, index) in rows',
    },
    {
      source: '<view v-for="({ value = \'fallback\', ...rest }, [position]) in rows">{{ value }}</view>',
      expression: '({ value = \'fallback\', ...rest }, [position]) in rows',
    },
    {
      source: '<view v-for="({ value = \'fallback\', ...rest }, { position }) in rows">{{ value }}</view>',
      expression: '({ value = \'fallback\', ...rest }, { position }) in rows',
    },
    {
      source: '<view v-for="({ value = \'fallback\', ...rest }, key, index, extra) in rows">{{ value }}</view>',
      expression: '({ value = \'fallback\', ...rest }, key, index, extra) in rows',
    },
    {
      source: '<view v-for="...values in records">{{ values }}</view>',
      expression: '...values in records',
    },
  ])('rejects unsupported pattern boundary: $expression', ({ source, expression }) => {
    const compiled = compileVueTemplateToWxml(source, 'src/pages/issue-1011/unsupported.vue')
    const diagnostic = compiled.diagnostics[0]

    expect(diagnostic).toEqual(expect.objectContaining({
      code: 'WV2001',
      severity: 'error',
      source: 'template',
    }))
    expect(source.slice(diagnostic?.loc?.start.offset, diagnostic?.loc?.end.offset)).toBe(expression)
    expect(compiled.code).not.toContain('wx:for')
    expect(compiled.code).not.toContain('{{rest}}')
    expect(compiled.code).not.toContain('{{values}}')
  })
})
