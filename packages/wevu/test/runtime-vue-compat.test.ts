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

  it('useAttrs/useSlots return setup context fallbacks, useModel emits update event', () => {
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
    const inst: any = { setData() {}, triggerEvent, properties: { modelValue: 'init' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenCalledWith('update:modelValue', 'next', undefined)
    // slots/attrs are present and stable
    expect(inst.$wevu?.state?.attrs).toBeDefined()
    expect(inst.$wevu?.state?.slots).toBeDefined()
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
})
