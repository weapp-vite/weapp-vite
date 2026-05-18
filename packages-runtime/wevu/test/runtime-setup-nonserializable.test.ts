import { WEVU_FUNCTION_PROP_PATHS_KEY } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, getCurrentInstance, getCurrentSetupContext, ref } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: setup returns non-serializable values', () => {
  it('excludes current instance from setData snapshot', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        const count = ref(0)
        const inst = getCurrentInstance()
        function inc() {
          count.value++
        }
        return { count, inst, inc }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    // 初始快照不应包含内部实例对象
    expect(setData).toHaveBeenCalled()
    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload).toEqual(expect.objectContaining({ count: 0 }))
    expect('inst' in firstPayload).toBe(false)

    inst.inc()
    await Promise.resolve()

    const lastPayload = setData.mock.calls.at(-1)?.[0] ?? {}
    expect(lastPayload).toEqual(expect.objectContaining({ count: 1 }))
    expect('inst' in lastPayload).toBe(false)
  })

  it('excludes current setup context from setData snapshot', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        const count = ref(0)
        const ctx = getCurrentSetupContext()
        function inc() {
          count.value++
        }
        return { count, ctx, inc }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    expect(setData).toHaveBeenCalled()
    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload).toEqual(expect.objectContaining({ count: 0 }))
    expect('ctx' in firstPayload).toBe(false)

    inst.inc()
    await Promise.resolve()

    const lastPayload = setData.mock.calls.at(-1)?.[0] ?? {}
    expect(lastPayload).toEqual(expect.objectContaining({ count: 1 }))
    expect('ctx' in lastPayload).toBe(false)
  })

  it('keeps setup returned functions in state and setData when allowFunctionProps is enabled', async () => {
    defineComponent({
      allowFunctionProps: true,
      data: () => ({}),
      setup() {
        const count = ref(0)
        function inc() {
          count.value++
          return count.value
        }
        return { count, inc }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload.count).toBe(0)
    expect(firstPayload.inc).toBeTypeOf('function')
    expect(inst.inc()).toBe(1)
    await Promise.resolve()

    const mergedPayload = setData.mock.calls.map(([payload]: any[]) => payload ?? {}).reduce((acc, payload) => ({
      ...acc,
      ...payload,
    }), {})
    expect(mergedPayload.count).toBe(1)
    expect(mergedPayload.inc).toBe(firstPayload.inc)
  })

  it('keeps compiler-marked setup functions in setData by default', async () => {
    defineComponent({
      [WEVU_FUNCTION_PROP_PATHS_KEY]: ['inc'],
      data: () => ({}),
      setup() {
        const count = ref(0)
        function inc() {
          count.value++
          return count.value
        }
        function ignored() {
          return 'ignored'
        }
        return { count, inc, ignored }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload.count).toBe(0)
    expect(firstPayload.inc).toBeTypeOf('function')
    expect('ignored' in firstPayload).toBe(false)
    expect(inst.inc()).toBe(1)
  })

  it('keeps only compiler-marked setup functions when allowFunctionProps is auto', async () => {
    defineComponent({
      [WEVU_FUNCTION_PROP_PATHS_KEY]: ['inc'],
      allowFunctionProps: 'auto',
      data: () => ({}),
      setup() {
        const count = ref(0)
        function inc() {
          count.value++
          return count.value
        }
        function ignored() {
          return 'ignored'
        }
        return { count, inc, ignored }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload.count).toBe(0)
    expect(firstPayload.inc).toBeTypeOf('function')
    expect('ignored' in firstPayload).toBe(false)
    expect(inst.inc()).toBe(1)
  })

  it('filters compiler-marked setup functions when allowFunctionProps is disabled', async () => {
    defineComponent({
      [WEVU_FUNCTION_PROP_PATHS_KEY]: ['inc'],
      allowFunctionProps: false,
      data: () => ({}),
      setup() {
        function inc() {
          return 'ok'
        }
        return { inc }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect('inc' in firstPayload).toBe(false)
    expect(inst.inc()).toBe('ok')
  })

  it('keeps compiler-marked nested data functions in setData by default', async () => {
    const save = vi.fn(() => 'saved')
    defineComponent({
      [WEVU_FUNCTION_PROP_PATHS_KEY]: ['handlers.save'],
      data: () => ({
        handlers: {
          save,
          reset: vi.fn(),
        },
      }),
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload.handlers.save).toBe(save)
    expect('reset' in firstPayload.handlers).toBe(false)
    expect(firstPayload.handlers.save()).toBe('saved')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('keeps data functions in setData when allowFunctionProps is enabled', async () => {
    const callback = vi.fn(() => 'ok')
    defineComponent({
      allowFunctionProps: true,
      data: () => ({
        callback,
      }),
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const firstPayload = setData.mock.calls[0]?.[0] ?? {}
    expect(firstPayload.callback).toBe(callback)
    expect(firstPayload.callback()).toBe('ok')
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
