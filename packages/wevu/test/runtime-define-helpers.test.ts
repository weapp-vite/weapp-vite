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
    const props = {
      name: String,
      count: { type: Number, default: 2 },
      status: { value: 'ok' },
      demoModifiers: {},
    }
    const result = normalizeProps({ data: () => ({}) }, props)
    expect(result.properties.name.type).toBe(String)
    expect(result.properties.count.value).toBe(2)
    expect(result.properties.status.value).toBe('ok')
    expect(result.properties.demoModifiers.type).toBe(Object)
    expect(result.properties.__wvSlotOwnerId).toBeTruthy()
    expect(result.properties.__wvSlotScope).toBeTruthy()
  })

  it('creates scoped slot options with inline args parsing', () => {
    const options = createScopedSlotOptions({ computed: { foo: () => 1 } })
    expect(options.computed).toBeTruthy()

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
