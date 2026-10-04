import type { TransformContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/types'
import type { WevuBindingRecordV1, WevuBindingUpdateMode } from '../../../packages-runtime/wevu-compiler/src/types/bindingManifest'
import { createRequire } from 'node:module'
import process from 'node:process'
import { Scope } from '@babel/traverse'
import { describe, expect, it } from 'vitest'
import { createBindingManifest, recordBindingExpression, recordSyntheticBindingExpression } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest'
import { INLINE_GLOBALS } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/inlineShared'
import { normalizeWxmlExpressionWithContext } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/scopedSlot'

interface BindingInput {
  expression: string
  locals: string[]
  safeCallNames: string[]
}

interface BindingAnalysis {
  dependencies: Array<{ root: string, path?: string, mode: 'exact-path' | 'top-level' }>
  snapshotFallback: boolean
}

interface ExperimentalBinding {
  analyzeBindingExpressionsNative: (inputs: BindingInput[], ignoredGlobals: string[]) => Array<BindingAnalysis | null>
}

const modulePath = process.env.WEAPP_VITE_EXPERIMENTAL_BINDING_BINDING
const binding = modulePath ? createRequire(import.meta.url)(modulePath) as ExperimentalBinding : undefined
const ignoredGlobals = [...new Set([
  ...INLINE_GLOBALS,
  ...Scope.globals,
  ...Scope.contextVariables,
  // 生产 INTERNAL_GLOBALS 使用普通对象索引，也忽略原型链上的真值成员。
  ...Object.getOwnPropertyNames(Object.prototype),
  'undefined',
  'Infinity',
  'NaN',
  'arguments',
])]

function input(expression: string, locals: string[] = [], safeCallNames: string[] = []): BindingInput {
  return { expression, locals, safeCallNames }
}

function createContext(value: BindingInput): TransformContext {
  return {
    filename: 'binding.vue',
    bindingManifest: createBindingManifest('binding.vue'),
    rewriteScopedSlot: false,
    scopeStack: [new Set(value.locals)],
    slotPropStack: [],
    forStack: [],
    templateSafeCallNames: new Set(value.safeCallNames),
  } as unknown as TransformContext
}

function production(value: BindingInput, contextual = false) {
  const context = createContext(value)
  const options = { expression: value.expression, kind: 'text' as const, outputPath: 'bindingResult' }
  if (contextual) {
    recordBindingExpression(context, options)
  }
  else {
    recordSyntheticBindingExpression(context.bindingManifest, options, value.locals)
  }
  const [record] = context.bindingManifest.bindings
  expect(context.bindingManifest.bindings).toHaveLength(1)
  expect(record!.outputPath).toBe('bindingResult')
  return {
    input: {
      ...value,
      expression: contextual ? normalizeWxmlExpressionWithContext(value.expression, context) : value.expression,
    },
    record: record!,
  }
}

function observable(analysis: BindingAnalysis | null): Pick<WevuBindingRecordV1, 'dependencies' | 'updateMode'> {
  if (!analysis) {
    return { dependencies: [], updateMode: 'snapshot-fallback' }
  }
  const dependencies = analysis.dependencies.map(dependency => ({
    root: dependency.root,
    ...(dependency.path === undefined ? {} : { path: dependency.path }),
    updateMode: (analysis.snapshotFallback ? 'snapshot-fallback' : dependency.mode) as WevuBindingUpdateMode,
  }))
  const updateMode = dependencies.some(dependency => dependency.updateMode === 'snapshot-fallback')
    ? 'snapshot-fallback'
    : dependencies.some(dependency => dependency.updateMode === 'top-level') ? 'top-level' : 'exact-path'
  return { dependencies, updateMode }
}

function expectParity(value: BindingInput, contextual = false) {
  const expected = production(value, contextual)
  const result = binding!.analyzeBindingExpressionsNative([expected.input], ignoredGlobals)
  expect(result).toHaveLength(1)
  expect(result[0]).not.toBeNull()
  expect(observable(result[0]!)).toEqual({
    dependencies: expected.record.dependencies,
    updateMode: expected.record.updateMode,
  })
  return result[0]!
}

function expectBatchParity(values: BindingInput[]) {
  const expected = values.map(value => production(value, true))
  const result = binding!.analyzeBindingExpressionsNative(expected.map(value => value.input), ignoredGlobals)
  expect(result).toHaveLength(values.length)
  expect(result.map(observable)).toEqual(expected.map(({ record }) => ({
    dependencies: record.dependencies,
    updateMode: record.updateMode,
  })))
  return result
}

const expressions = [
  'profile.name + profile.name + count + profile.age',
  'items[0].name + table["first"].label + items[1.5] + items[0x10]',
  'items[1e21] + items[1e-7] + items[0.000001] + items[1e20] + items[1e309] + items[0b10]',
  'table[key].name + table.fixed + key + rows[index].value',
  'source[nested.key][other].value',
  'items[-1] + items[true] + items[null]',
  'profile?.name + records?.[index]?.value',
  '(profile).name + ((items))[0].label',
  '(profile as Profile).name + profile!.age + (<Profile>profile).id',
  '(profile satisfies Profile).name',
  '(profile satisfies Types.Profile).name + (other satisfies Types.Nested.Entry)',
  '({ label: value, [key]: other, shorthand, [nested.key]: profile.name })',
  '(target = source, count++, --other)',
  '(target += source, holder.value = other)',
  '([target] = source)',
  '({ value: target } = source)',
  '({ target = initial, [key]: holder.value, ...rest } = source)',
  '([target = initial, holder.value, ...rest] = source)',
  '((target as Target) = source, (holder!.value as Value) = other)',
  '(typeof missing, delete profile.name, void ignored, this.title)',
  'items.map((item, index) => item.name + suffix + index)',
  '(value: Input): Output => value.name + external.label',
  '({ value: local = initial, ...rest }: Input) => local + rest.name + external',
  'function named(local = initial) { return named(local) + outer.value }',
  '(() => { before; var before; return outside })',
  '(() => { const { name: local } = source; return local + suffix })',
  '(() => { try { throw source } catch (error) { return error.message + fallback } })',
  '(() => { label: for (const item of items) { if (item) break label } return total })',
  '({ method(local: Input): Output { return local + outer }, get value() { return state.value } })',
  'async (local: Input) => await load(local, outside)',
  'function* generator(local) { yield local; yield* outside }',
  'class Holder extends Base { [key] = value; field = config.field; #private = state; method(local) { return local + outside + other.#private } }',
  '(() => { for (item of items) { use(item) } return tail })',
  'value satisfies { [key]: Types.Entry; member: Other }',
  'value satisfies (parameter: Input) => Output',
  'value satisfies [label: Item, ...rest: More[]]',
  'value satisfies { method(parameter: Input): Output; [index: Key]: Value }',
  'value satisfies { (parameter: Input): Output; new (argument: Arg): Instance }',
  'value satisfies (parameter: Input) => parameter is Output',
  'value satisfies <Item extends Constraint>(parameter: Item) => Item',
  'value satisfies { [Key in keyof Source as Rename]: Target<Key> }',
  'value satisfies (this: Context, parameter: Input) => Output',
  '(() => { const Item = outside; return value satisfies <Item extends Base>(parameter: Item) => Item })',
  '(() => { type Alias = External; return value satisfies Alias })',
  '(() => { interface Shape { field: External }; return value satisfies Shape })',
  'handler<Input>(value)',
  'format(profile.name)',
  'format?.(profile.name)',
  'service.format(profile.name)',
  'new Formatter(profile.name)',
  '[...items, tail]',
  '({ ...profile, name: label })',
  'Math.max(value, Number(other)) + Promise.resolve(result)',
  'undefined + Infinity + NaN + arguments + Array + globalThis + wx + count',
  'toString + constructor + valueOf + state',
  '42',
  '() => 1',
  'Math.random()',
  'table["😀"].name + table["中文📦"]',
]

describe.runIf(Boolean(modulePath))('experimental binding expression analysis with a real binding', () => {
  it.each(expressions)('matches synthetic manifest dependencies and update mode: %s', (expression) => {
    expectParity(input(expression))
  })

  it.each([
    input('row.name + index + suffix + table[key]', ['row', 'index', 'key']),
    input('format(profile.name)', [], ['format']),
    input('format(other(profile.name))', [], ['format']),
    input('service.format(profile.name)', [], ['format']),
    input('format?.(profile?.name)', [], ['format']),
    input('(profile as Profile).name ?? fallback'),
    input('this.profile.name + $slots.header'),
    input('(() => local.name + external.name)', ['local']),
  ])('matches normalized contextual manifest for $expression', (value) => {
    expectParity(value, true)
  })

  it('preserves ordered, deduplicated dependencies and exact versus dynamic paths', () => {
    expect(expectParity(input('profile.name + table[key].value + profile.name + profile.age'))).toEqual({
      dependencies: [
        { root: 'profile', path: 'profile.name', mode: 'exact-path' },
        { root: 'table', mode: 'top-level' },
        { root: 'key', path: 'key', mode: 'exact-path' },
        { root: 'profile', path: 'profile.age', mode: 'exact-path' },
      ],
      snapshotFallback: false,
    })
  })

  it('formats numeric paths with JavaScript number string semantics', () => {
    const result = expectParity(input('items[1e21] + items[1e-7] + items[0.000001] + items[1e20] + items[1e309] + items[0b10]'))
    expect(result.dependencies.map(dependency => dependency.path)).toEqual([
      'items.1e+21',
      'items.1e-7',
      'items.0.000001',
      'items.100000000000000000000',
      'items.Infinity',
      'items.2',
    ])
  })

  it('keeps safe direct calls distinct from nested and optional calls', () => {
    expect(expectParity(input('format(value)', [], ['format']), true).snapshotFallback).toBe(false)
    expect(expectParity(input('format(other(value))', [], ['format']), true).snapshotFallback).toBe(true)
    expect(expectParity(input('format?.(value)')).snapshotFallback).toBe(true)
  })

  it.each(['format(value)', 'format?.(value)', 'service.format(value)'])('isolates contextual normalized projections in both orders: %s', (expression) => {
    // WXML normalization 将 optional call 降为判空分支中的普通调用，再进入分析边界。
    const safeFallback = expression === 'service.format(value)'
    const variants = [
      { value: input(expression), fallback: true },
      { value: input(expression, ['format', 'service', 'value'], ['format']), fallback: safeFallback },
      { value: input(expression, ['value'], ['format']), fallback: safeFallback },
      { value: input(expression, ['format', 'service', 'value']), fallback: true },
    ]
    for (const ordered of [variants, [...variants].reverse()]) {
      const result = expectBatchParity(ordered.map(item => item.value))
      expect(result.map(item => item!.snapshotFallback)).toEqual(ordered.map(item => item.fallback))
    }
  })

  it('keeps raw optional calls in fallback across cached locals and safe-call projections', () => {
    const variants = [
      input('format?.(value)'),
      input('format?.(value)', ['value'], ['format']),
      input('format?.(value)', ['format', 'value'], ['format']),
      input('format?.(value)', ['format', 'value']),
    ]
    for (const ordered of [variants, [...variants].reverse()]) {
      // 直接测试 native 的已规范化源码输入边界，不经过 contextual WXML normalization。
      const expected = ordered.map(value => production(value))
      const result = binding!.analyzeBindingExpressionsNative(ordered, ignoredGlobals)
      expect(result).toHaveLength(ordered.length)
      expect(result.map(observable)).toEqual(expected.map(({ record }) => ({
        dependencies: record.dependencies,
        updateMode: record.updateMode,
      })))
      expect(result.map(item => item!.snapshotFallback)).toEqual([true, true, true, true])
      expect(result.filter(item => item!.dependencies.length === 0)).toHaveLength(2)
    }
  })

  it.each(['() => 1', 'Math.random()', '[...[]]'])('retains fallback facts when an expression has no dependencies: %s', (expression) => {
    const result = expectParity(input(expression))
    expect(result).toEqual({ dependencies: [], snapshotFallback: true })
    expect(observable(result).updateMode).toBe('exact-path')
  })

  it.each(['value +', 'items[', 'const value = 1'])('returns null for parse failures: %s', (expression) => {
    const expected = production(input(expression))
    const [result] = binding!.analyzeBindingExpressionsNative([expected.input], ignoredGlobals)
    expect(result).toBeNull()
    expect(observable(result!)).toEqual({ dependencies: expected.record.dependencies, updateMode: expected.record.updateMode })
  })

  it.each(['\uD800', '\uDC00'])('rejects the whole batch for a raw lone surrogate in any input field: %j', (surrogate) => {
    const malformed = [
      input(`table["${surrogate}"]`),
      input('value', [surrogate]),
      input('value', [], [surrogate]),
    ]
    for (const value of malformed) {
      expect(() => binding!.analyzeBindingExpressionsNative([
        input('profile.name'),
        value,
        input('other.name'),
      ], ignoredGlobals)).toThrow()
    }
    expect(() => binding!.analyzeBindingExpressionsNative([
      input('profile.name'),
      input('other.name'),
    ], [...ignoredGlobals, surrogate])).toThrow()
  })

  it.each(['value', 'value +'])('validates UTF-16 fields after a cached success or parse failure: %s', (expression) => {
    for (const surrogate of ['\uD800', '\uDC00']) {
      for (const malformed of [input(expression, [surrogate]), input(expression, [], [surrogate])]) {
        expect(() => binding!.analyzeBindingExpressionsNative([
          input(expression),
          malformed,
          input('other.name'),
        ], ignoredGlobals)).toThrow()
      }
    }
  })

  it.each([String.raw`table["\uD800"]`, String.raw`table["\uDC00"]`])('rejects escaped lone surrogates in property values: %s', (expression) => {
    expect(() => binding!.analyzeBindingExpressionsNative([
      input('profile.name'),
      input(expression),
      input('other.name'),
    ], ignoredGlobals)).toThrow()
  })

  it('preserves paired surrogates in source and accepts them in configuration strings', () => {
    const value = input('table["😀"].name + table["中文📦"]', ['😀'], ['📦'])
    const expected = expectParity(value)
    expect(binding!.analyzeBindingExpressionsNative([value], [...ignoredGlobals, '😀'])).toEqual([expected])
    const escaped = input(String.raw`table["\uD83D\uDE00"].name + table["中文\uD83D\uDCE6"]`)
    expect(expectParity(escaped)).toEqual(expected)
  })

  it.each([false, true])('preserves batch order, scope isolation and failed entries with reverse=%s', (reverse) => {
    const values = [
      input('format(profile.name)', [], ['format']),
      input('row.name + suffix', ['row']),
      input('value +'),
      input('row.name + suffix'),
      input('format(profile.name)'),
    ]
    const result = expectBatchParity(reverse ? [...values].reverse() : values)
    expect(result[2]).toBeNull()
    expect(binding!.analyzeBindingExpressionsNative([], ignoredGlobals)).toEqual([])
  })

  it('applies ignored globals independently across batches', () => {
    const value = input('state.value + other.value')
    const original = expectParity(value)
    for (const ignoredRoot of ['state', 'other', 'state']) {
      const expected = production(input(value.expression, [ignoredRoot]))
      const [result] = binding!.analyzeBindingExpressionsNative([value], [...ignoredGlobals, ignoredRoot])
      expect(observable(result!)).toEqual({ dependencies: expected.record.dependencies, updateMode: expected.record.updateMode })
    }
    expect(binding!.analyzeBindingExpressionsNative([value], ignoredGlobals)).toEqual([original])
  })

  it('returns independent projections for repeated expressions', () => {
    const value = input('profile.name + count')
    const expected = expectParity(value)
    const [first, second] = expectBatchParity([value, value])
    first!.dependencies[0]!.path = 'changed'
    first!.dependencies.pop()
    first!.snapshotFallback = true
    expect(second).toEqual(expected)
    expect(binding!.analyzeBindingExpressionsNative([value], ignoredGlobals)).toEqual([expected])
  })
})
