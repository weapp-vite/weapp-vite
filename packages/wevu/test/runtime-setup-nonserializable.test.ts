import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, getCurrentInstance, ref } from '@/index'

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

    const lastPayload = setData.mock.calls[setData.mock.calls.length - 1]?.[0] ?? {}
    expect(lastPayload).toEqual(expect.objectContaining({ count: 1 }))
    expect('inst' in lastPayload).toBe(false)
  })
})
