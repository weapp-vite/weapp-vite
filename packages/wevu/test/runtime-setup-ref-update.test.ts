import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: setup returned ref triggers setData', () => {
  it('updates snapshot when ref.value changes', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        const active = ref(true)
        function toggleActive() {
          active.value = !active.value
        }
        return {
          active,
          toggleActive,
        }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    // mount
    opts.lifetimes.attached.call(inst)

    // initial sync
    await Promise.resolve()

    const beforeCalls = setData.mock.calls.length
    inst.toggleActive()
    await Promise.resolve()

    expect(setData.mock.calls.length).toBeGreaterThan(beforeCalls)
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ active: false }))
  })
})
