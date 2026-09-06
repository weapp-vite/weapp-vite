import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from '@/reactivity'
import { normalizeProps } from '@/runtime/define/props'
import { createScopedSlotOptions } from '@/runtime/define/scopedSlotOptions'
import { applySetupResult, shouldExposeInSnapshot } from '@/runtime/define/setupResult'

describe('runtime: define helpers', () => {
  it('exposes serializable values but hides non-plain objects', () => {
    expect(shouldExposeInSnapshot({})).toBe(true)
    expect(shouldExposeInSnapshot([1, 2])).toBe(true)
    expect(shouldExposeInSnapshot(ref(1))).toBe(true)
    expect(shouldExposeInSnapshot(reactive({}))).toBe(true)
    expect(shouldExposeInSnapshot(new Date())).toBe(false)
  })

  it('applies setup result with method binding and non-enumerable values', () => {
    const runtime: any = { state: {}, methods: {}, proxy: { marker: 'ok' } }
    const target = {}
    const custom = new (class Custom {})()
    applySetupResult(runtime, target, {
      greet() {
        return this.marker
      },
      custom,
      count: 1,
    })

    expect(runtime.methods.greet()).toBe('ok')
    expect(runtime.state.count).toBe(1)
    const descriptor = Object.getOwnPropertyDescriptor(runtime.state, 'custom')
    expect(descriptor?.enumerable).toBe(false)
  })

  it('normalizes props into mini program properties', () => {
    const statusObserver = vi.fn()
    const props = {
      name: String,
      count: { type: Number, default: 2 },
      status: { type: Number, optionalTypes: [String, Date, Object], observer: statusObserver, value: 0 },
      mode: [String, Number],
      mixedInvalid: [Date, String, Number],
      onSelect: Function,
      createdAt: Date,
      anyValue: null,
      withOptionalOnly: { optionalTypes: [Boolean] },
      demoModifiers: {},
    }
    const result = normalizeProps({ data: () => ({}) }, props)
    expect(result.properties.name.type).toBe(String)
    expect(result.properties.count.value).toBe(2)
    expect(result.properties.status.value).toBe(0)
    expect(result.properties.status.type).toBe(Number)
    expect(result.properties.status.optionalTypes).toEqual([String, Object])
    expect(result.properties.status.observer).toBe(statusObserver)
    expect(result.properties.mode.type).toBe(String)
    expect(result.properties.mode.optionalTypes).toEqual([Number])
    expect(result.properties.mixedInvalid.type).toBe(String)
    expect(result.properties.mixedInvalid.optionalTypes).toEqual([Number])
    expect(result.properties.onSelect.type).toBe(Function)
    expect(result.properties.createdAt.type).toBeNull()
    expect(result.properties.anyValue.type).toBeNull()
    expect(result.properties.withOptionalOnly.type).toBeNull()
    expect(result.properties.withOptionalOnly.optionalTypes).toEqual([Boolean])
    expect(result.properties.demoModifiers.type).toBe(Object)
    expect(result.properties.__wvSlotOwnerId).toBeTruthy()
    expect(result.properties.__wvSlotScope).toBeTruthy()
  })

  it('keeps inferred nullable transport values out of native type coercion without losing defaults or observers', () => {
    const unionObserver = vi.fn()
    const nullableObserver = vi.fn()
    const result = normalizeProps({
      data: () => ({}),
      __wevu_allowNullPropInput: true,
    }, {
      optionalShorthand: String,
      optionalWithoutRequired: { type: String },
      shorthandUnion: [String, Number],
      requiredName: { type: String, required: true },
      optionalName: { type: String, required: false },
      optionalCount: { type: Number, required: false },
      optionalEnabled: { type: Boolean, required: false },
      optionalItems: { type: Array, required: false },
      content: { type: [Number, String], required: false, observer: unionObserver },
      optionalTypesUnion: { type: Number, optionalTypes: [String], required: true },
      src: { type: String, required: false, default: '' },
      nullableLabel: { type: [String, null], required: true, observer: nullableObserver },
      unionWithDefault: { type: [String, Number], required: true, default: 'ready' },
    })

    expect(result.properties.requiredName).toEqual({ type: String })
    expect(result.properties.optionalShorthand).toEqual({ type: null, value: '' })
    expect(result.properties.optionalWithoutRequired).toEqual({ type: null, value: '' })
    expect(result.properties.shorthandUnion).toEqual({ type: null, value: '' })
    expect(result.properties.optionalName).toEqual({ type: null, value: '' })
    expect(result.properties.optionalCount).toEqual({ type: null, value: 0 })
    expect(result.properties.optionalEnabled).toEqual({ type: null, value: false })
    expect(result.properties.optionalItems).toEqual({ type: null, value: [] })
    expect(result.properties.content).toEqual({
      type: null,
      value: 0,
      observer: unionObserver,
    })
    expect(result.properties.optionalTypesUnion).toEqual({ type: null, value: 0 })
    expect(result.properties.src).toEqual({ type: null, value: '' })
    expect(result.properties.nullableLabel).toEqual({
      type: null,
      observer: nullableObserver,
    })
    expect(result.properties.unionWithDefault).toEqual({ type: null, value: 'ready' })
  })

  it('preserves explicit native property definitions when nullable transport is enabled', () => {
    const observer = vi.fn()
    const explicitProperties = {
      name: String,
      count: { type: Number, value: 2 },
      mode: { type: Number, optionalTypes: [String], observer },
      anyValue: null,
    }
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
    }, undefined, explicitProperties)

    expect(result.properties).toMatchObject(explicitProperties)
    expect(result.properties.name).toBe(String)
    expect(result.properties.count).toBe(explicitProperties.count)
    expect(result.properties.mode).toBe(explicitProperties.mode)
  })

  it('keeps explicit overrides and internal properties while widening inferred props', () => {
    const titleObserver = vi.fn()
    const ownerObserver = vi.fn()
    const explicitTitle = { type: String, value: 'native-title', observer: titleObserver }
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
    }, {
      title: { type: [Number, String], required: false },
      items: { type: null, default: () => [] },
    }, {
      title: explicitTitle,
      __wvSlotOwnerId: { type: String, value: '', observer: ownerObserver },
      __wvSlotScope: { type: null, value: null },
    })

    expect(result.properties.title).toBe(explicitTitle)
    expect(result.properties.title.observer).toBe(titleObserver)
    expect(result.properties.items.type).toBeNull()
    expect(result.properties.items.value).toEqual([])
    expect(result.properties.__wvSlotOwnerId.observer).toBe(ownerObserver)
    expect(result.properties.__wvSlotScope.type).toBeNull()
    expect(result.properties.vueSlots.type).toBeNull()
  })

  it('keeps page-style options without explicit props free from component-only internal props', () => {
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
      __wevu_isPage: true,
    })

    expect(result.properties).toEqual({})
  })

  it('keeps empty native properties free from component-only internal props during repeated normalization', () => {
    const first = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
      __wevu_isPage: true,
    })
    const second = normalizeProps(first)

    expect(second.properties).toEqual({})
  })

  it('keeps native union descriptors when nullable transport compatibility is disabled', () => {
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: false,
    }, {
      mixed: { type: [Number, String] },
      literalUnion: { type: [String, Number] },
      multiNative: { type: [String, Number, Boolean, Object, Array] },
    })

    expect(result.properties.mixed.type).toBe(Number)
    expect(result.properties.mixed.optionalTypes).toEqual([String])
    expect(result.properties.literalUnion.type).toBe(String)
    expect(result.properties.literalUnion.optionalTypes).toEqual([Number])
    expect(result.properties.multiNative.type).toBe(String)
    expect(result.properties.multiNative.optionalTypes).toEqual([Number, Boolean, Object, Array])
  })

  it('normalizes optional union edge cases into native properties', () => {
    const result = normalizeProps({ data: () => ({}) }, {
      optLiteral: { type: String, required: false },
      optDateOrString: { type: [Date, String], required: false },
      optDateOnly: { type: Date, required: false },
      optLiteralOrNumber: { type: [String, Number], required: false },
      optNullableString: { type: [String, null], required: false },
      optAllInvalid: { type: [Date, Map, Set], required: false },
      optDuplicate: {
        type: [String, String, Number, String],
        optionalTypes: [Number, Date, String, Number],
      },
    })

    expect(result.properties.optLiteral.type).toBe(String)
    expect(result.properties.optLiteral.optionalTypes).toBeUndefined()
    expect(result.properties.optDateOrString.type).toBe(String)
    expect(result.properties.optDateOrString.optionalTypes).toBeUndefined()
    expect(result.properties.optDateOnly.type).toBeNull()
    expect(result.properties.optLiteralOrNumber.type).toBe(String)
    expect(result.properties.optLiteralOrNumber.optionalTypes).toEqual([Number])
    expect(result.properties.optNullableString.type).toBe(String)
    expect(result.properties.optNullableString.optionalTypes).toBeUndefined()
    expect(result.properties.optAllInvalid.type).toBeNull()
    expect(result.properties.optAllInvalid.optionalTypes).toBeUndefined()
    expect(result.properties.optDuplicate.type).toBe(String)
    expect(result.properties.optDuplicate.optionalTypes).toEqual([Number])
  })

  it('creates scoped slot options with inline args parsing', () => {
    const options = createScopedSlotOptions({ computed: { foo: () => 1 } })
    expect((options as any).computed).toBeTruthy()
    expect((options as any).options?.virtualHost).toBe(true)

    const handler = vi.fn((msg: string, evt: any) => ({ msg, marker: evt.marker }))
    const ctx = { __wvOwnerProxy: { onTap: handler } }
    const event = {
      marker: 9,
      currentTarget: { dataset: { wvHandler: 'onTap', wvArgs: '["ok","$event"]' } },
    }

    const result = options.methods.__weapp_vite_owner.call(ctx, event)
    expect(handler).toHaveBeenCalledWith('ok', event)
    expect(result).toEqual({ msg: 'ok', marker: 9 })
  })
})
