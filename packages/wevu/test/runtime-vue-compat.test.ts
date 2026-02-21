import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, mergeModels, useAttrs, useBindModel, useModel, useSlots } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
describe('runtime: vue compat helpers', () => {
  it('mergeModels merges arrays and objects', () => {
    expect(mergeModels([1, 2], [2, 3])).toEqual([1, 2, 3])
    expect(mergeModels({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    expect(mergeModels(null as any, { a: 1 })).toEqual({ a: 1 })
  })

  it('useAttrs/useSlots/useModel throw when called outside setup', () => {
    expect(() => useAttrs()).toThrow()
    expect(() => useSlots()).toThrow()
    expect(() => useModel({}, 'modelValue')).toThrow()
  })

  it('useAttrs/useSlots expose setup context values, useModel emits update event', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      props: {
        modelValue: { type: String },
        modelModifiers: {},
      } as any,
      setup(props) {
        const attrs = useAttrs()
        const slots = useSlots()
        const model = useModel<string>(props as any, 'modelValue')

        model.value = 'next'
        return { attrs, slots, model }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {
        modelValue: 'init',
        extra: 'alpha',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenCalledWith('update:modelValue', 'next', undefined)
    expect(inst.$wevu?.state?.attrs).toMatchObject({ extra: 'alpha' })
    expect(inst.$wevu?.state?.attrs?.modelValue).toBeUndefined()
    expect(inst.$wevu?.state?.slots).toEqual({})
    expect(Object.getPrototypeOf(inst.$wevu?.state?.slots)).toBeNull()
    expect(Object.isFrozen(inst.$wevu?.state?.slots)).toBe(true)

    inst.properties.extra = 'beta'
    opts.observers['**'].call(inst)
    expect(inst.$wevu?.state?.attrs).toMatchObject({ extra: 'beta' })
  })

  it('useBindModel applies default event for value+change bindings', () => {
    defineComponent({
      data: () => ({ enabled: false }),
      setup() {
        const bindModel = useBindModel({ event: 'change' })
        const enabledModel = bindModel.model<boolean>('enabled')
        return { enabledModel }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData() {}, properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const model = inst.$wevu?.state?.enabledModel
    model.onChange({ detail: { value: true } })

    expect(inst.$wevu?.state?.enabled).toBe(true)
  })

  it('ctx.emit supports Vue style variadic args and normalizes triggerEvent payload', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      setup(_props, ctx) {
        ctx.emit('single', 1)
        ctx.emit('single-with-options', 1, { bubbles: true })
        ctx.emit('multi', 1, 2)
        ctx.emit('multi-with-options', 1, 2, { composed: true })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'single', 1, undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'single-with-options', 1, { bubbles: true })
    expect(triggerEvent).toHaveBeenNthCalledWith(3, 'multi', [1, 2], undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(4, 'multi-with-options', [1, 2], { composed: true })
  })
})
