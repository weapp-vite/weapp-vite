import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, toRaw } from '@/reactivity'
import { createBindModel } from '@/runtime/bindModel'
import { toPlain } from '@/runtime/diff'
import {
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onUpdated,
  setCurrentInstance,
  setCurrentSetupContext,
} from '@/runtime/hooks'
import { parseModelEventValue } from '@/runtime/internal'
import { markNoSetData } from '@/runtime/noSetData'
import { inject, injectGlobal, provide, provideGlobal } from '@/runtime/provide'
import { mergeModels, useAttrs, useModel, useSlots } from '@/runtime/vueCompat'

afterEach(() => {
  setCurrentInstance(undefined)
  setCurrentSetupContext(undefined)
})

describe('runtime diff/toPlain coverage', () => {
  it('serializes primitives and special values', () => {
    const safe = 10n
    const big = BigInt(Number.MAX_SAFE_INTEGER) + 2n

    expect(toPlain(safe)).toBe(10)
    expect(toPlain(big)).toBe(big.toString())
    expect(toPlain(Symbol('x'))).toBe('Symbol(x)')
    expect(toPlain(() => {})).toBeUndefined()
    expect(toPlain(3)).toBe(3)

    const noSet = markNoSetData({ a: 1 })
    expect(toPlain(noSet)).toBeUndefined()

    const circular: any = { a: 1 }
    circular.self = circular
    const plain = toPlain(circular)
    expect(plain.self).toBe(plain)

    const view = new Uint8Array([1, 2])
    expect(toPlain(view)).toEqual([1, 2])
    const dataView = new DataView(new ArrayBuffer(2))
    expect(toPlain(dataView)).toEqual([0, 0])
  })

  it('uses cache and respects depth', () => {
    const cache = new WeakMap<object, { version: number, value: any }>()
    const state = reactive({ nested: { a: 1 } })

    const first = toPlain(state, new WeakMap(), { cache })
    const second = toPlain(state, new WeakMap(), { cache })
    expect(second).toBe(first)

    const depthLimited = toPlain(state, new WeakMap(), { maxDepth: 0 })
    expect(depthLimited).toBe(toRaw(state))
  })
})

describe('provide/inject', () => {
  it('supports instance and global injection', () => {
    const instance: any = {}
    setCurrentInstance(instance)
    provide('token', 'value')
    expect(inject('token')).toBe('value')

    setCurrentInstance(undefined)
    provide('global', 123)
    expect(inject('global')).toBe(123)
    expect(inject('missing', 'fallback')).toBe('fallback')
    expect(() => inject('absent')).toThrow('wevu.inject')
  })

  it('supports explicit global API', () => {
    provideGlobal('key', 'ok')
    expect(injectGlobal('key')).toBe('ok')
    expect(injectGlobal('unknown', 'fallback')).toBe('fallback')
    expect(() => injectGlobal('missing')).toThrow('injectGlobal()')
  })
})

describe('internal helpers and vue compat', () => {
  it('parses model event values', () => {
    expect(parseModelEventValue({ detail: { value: 1 } })).toBe(1)
    expect(parseModelEventValue({ target: { value: 2 } })).toBe(2)
    expect(parseModelEventValue('raw')).toBe('raw')
  })

  it('useAttrs/useSlots/useModel require setup context', () => {
    expect(() => useAttrs()).toThrow('useAttrs()')
    expect(() => useSlots()).toThrow('useSlots()')
    expect(() => useModel({ value: 1 }, 'value')).toThrow('useModel()')

    const emit = vi.fn()
    setCurrentSetupContext({ emit, attrs: { a: 1 }, slots: { default: 'slot' } })

    expect(useAttrs()).toEqual({ a: 1 })
    expect(useSlots()).toEqual({ default: 'slot' })

    const model = useModel({ value: 5 }, 'value')
    model.value = 7
    expect(emit).toHaveBeenCalledWith('update:value', 7)
  })

  it('mergeModels supports arrays and objects', () => {
    expect(mergeModels(null as any, [1, 2])).toEqual([1, 2])
    expect(mergeModels([1], [1, 2, 2])).toEqual([1, 2])
    expect(mergeModels({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    expect(mergeModels(1 as any, 2 as any)).toBe(2)
  })
})

describe('bindModel helpers', () => {
  it('handles nested paths, refs, computed, and model payloads', () => {
    const state: any = {
      count: 1,
      nested: {},
      refVal: ref(1),
    }
    const publicInstance: any = {
      count: 1,
      nested: state.nested,
      refVal: state.refVal,
    }
    const computedRefs = {
      total: computed(() => state.count * 2),
    }
    const computedSetters = {
      total: vi.fn(),
    }

    const bindModel = createBindModel(publicInstance, state, computedRefs as any, computedSetters)

    expect(() => bindModel('')).toThrow('bindModel requires a non-empty path')

    bindModel('nested.value').update(3)
    expect(state.nested.value).toBe(3)

    bindModel('refVal').update(4)
    expect(state.refVal.value).toBe(4)

    bindModel('total').update(10)
    expect(computedSetters.total).toHaveBeenCalledWith(10)

    const payload = bindModel('count', {
      event: 'change',
      valueProp: 'checked',
      formatter: value => value + 1,
      parser: (event: any) => event.detail.value,
    }).model()

    expect(payload.checked).toBe(2)
    expect(payload.onChange).toBeTypeOf('function')

    payload.onChange({ detail: { value: 8 } })
    expect(state.count).toBe(8)
  })
})

describe('hook aliases', () => {
  it('registers vue-compatible lifecycle aliases', () => {
    const instance: any = { __wevuHooks: {} }
    setCurrentInstance(instance)

    const beforeMount = vi.fn()
    const beforeUnmount = vi.fn()

    onMounted(() => {})
    onUpdated(() => {})
    onBeforeUpdate(() => {})
    onActivated(() => {})
    onDeactivated(() => {})
    onBeforeMount(beforeMount)
    onBeforeUnmount(beforeUnmount)
    onErrorCaptured(() => {})

    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(beforeUnmount).toHaveBeenCalledTimes(1)
  })
})
