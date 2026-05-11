import {
  WEVU_GENERIC_SLOT_OWNER_DATA_KEY,
  WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
  WEVU_GENERIC_SLOT_OWNER_ID_PROP,
  WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX,
  WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_KEY,
  WEVU_NATIVE_SLOT_SCOPE_DATA_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
} from '@weapp-core/constants'
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
    expect(result.properties.createdAt.type).toBeNull()
    expect(result.properties.anyValue.type).toBeNull()
    expect(result.properties.withOptionalOnly.type).toBeNull()
    expect(result.properties.withOptionalOnly.optionalTypes).toEqual([Boolean])
    expect(result.properties.demoModifiers.type).toBe(Object)
    expect(result.properties.__wvSlotOwnerId).toBeTruthy()
    expect(result.properties.__wvSlotScope).toBeTruthy()
  })

  it('allows null as an optional native input for compiled vue props', () => {
    const result = normalizeProps({
      data: () => ({}),
      __wevu_allowNullPropInput: true,
    }, {
      name: String,
      count: { type: Number, default: 2 },
      mode: [String, Number],
      anyValue: null,
    })

    expect(result.properties.name.type).toBe(String)
    expect(result.properties.name.optionalTypes).toEqual([null])
    expect(result.properties.count.type).toBe(Number)
    expect(result.properties.count.optionalTypes).toEqual([null])
    expect(result.properties.mode.type).toBe(String)
    expect(result.properties.mode.optionalTypes).toEqual([Number, null])
    expect(result.properties.anyValue.type).toBeNull()
    expect(result.properties.anyValue.optionalTypes).toBeUndefined()
  })

  it('allows null as an optional native input for explicit properties', () => {
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
    }, undefined, {
      name: String,
      count: { type: Number, value: 2 },
      anyValue: null,
    })

    expect(result.properties.name.type).toBe(String)
    expect(result.properties.name.optionalTypes).toEqual([null])
    expect(result.properties.count.type).toBe(Number)
    expect(result.properties.count.value).toBe(2)
    expect(result.properties.count.optionalTypes).toEqual([null])
    expect(result.properties.anyValue.type).toBeNull()
    expect(result.properties.anyValue.optionalTypes).toBeUndefined()
  })

  it('keeps page-style options without explicit props stable when allowNullPropInput is enabled', () => {
    const result = normalizeProps({
      data: () => ({}),
      allowNullPropInput: true,
      __wevu_isPage: true,
    })

    expect(result.properties.__wvSlotOwnerId).toBeTruthy()
    expect(result.properties.__wvSlotScope).toBeTruthy()
  })

  it('keeps scoped slot owner id as a native camelCase property', () => {
    const result = normalizeProps({ data: () => ({}) })
    expect(result.properties[WEVU_SLOT_OWNER_ID_PROP]).toBeTruthy()
  })

  it('mirrors generic owner id props into data for nested generic slot outlets', () => {
    const result = normalizeProps({ data: () => ({}) })
    const observer = result.properties[WEVU_GENERIC_SLOT_OWNER_ID_ATTR].observer
    const setData = vi.fn()

    observer.call({ setData }, 'owner-1')

    expect(setData).toHaveBeenCalledWith({
      [WEVU_SLOT_OWNER_ID_KEY]: 'owner-1',
      [WEVU_SLOT_OWNER_ID_PROP]: 'owner-1',
      [WEVU_GENERIC_SLOT_OWNER_ID_PROP]: 'owner-1',
      [WEVU_GENERIC_SLOT_OWNER_ID_ATTR]: 'owner-1',
    })
  })

  it('mirrors generic owner props into data for nested generic slot outlets', () => {
    const result = normalizeProps({ data: () => ({}) })
    const observer = result.properties[WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR].observer
    const setData = vi.fn()
    const ownerProps = ['value', 'ok']

    observer.call({ setData }, ownerProps)

    expect(setData).toHaveBeenCalledWith({
      [WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR]: ownerProps,
      [WEVU_SLOT_OWNER_KEY]: { value: 'ok' },
      [WEVU_GENERIC_SLOT_OWNER_DATA_KEY]: { value: 'ok' },
      [WEVU_SLOT_PROPS_DATA_KEY]: { value: 'ok' },
      [WEVU_GENERIC_SLOT_PROPS_DATA_KEY]: { value: 'ok' },
      [`${WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX}value`]: 'ok',
    })
  })

  it('normalizes native slot scope pairs for projected slot wxml', () => {
    const result = normalizeProps({ data: () => ({}) })
    const observer = result.properties.wvslotscope.observer
    const setData = vi.fn()

    observer.call({ setData }, ['wvslotbind0', 'ok'])

    expect(setData).toHaveBeenCalledWith({
      [WEVU_NATIVE_SLOT_SCOPE_DATA_KEY]: {
        wvslotbind0: 'ok',
      },
      wvslotbind0: 'ok',
    })
  })

  it('does not write undefined native slot bindings to top-level data', () => {
    const result = normalizeProps({ data: () => ({}) })
    const observer = result.properties.wvslotscope.observer
    const setData = vi.fn()

    observer.call({ setData }, ['wvslotbind0', undefined, 'wvslotbind1', 'ready'])

    expect(setData).toHaveBeenCalledWith({
      [WEVU_NATIVE_SLOT_SCOPE_DATA_KEY]: {
        wvslotbind0: undefined,
        wvslotbind1: 'ready',
      },
      wvslotbind1: 'ready',
    })
  })

  it('normalizes Vue inferred union arrays to native type and optionalTypes', () => {
    const result = normalizeProps({ data: () => ({}) }, {
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
