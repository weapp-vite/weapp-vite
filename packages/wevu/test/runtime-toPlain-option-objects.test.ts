import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, isRef, ref } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: toPlain does not unwrap plain objects with "value" key', () => {
  it('isRef is strict and ignores plain objects', () => {
    expect(isRef({ value: 1 })).toBe(false)
    expect(isRef({ label: 'a', value: 0 })).toBe(false)
    expect(isRef(ref(1))).toBe(true)
  })

  it('keeps option objects when syncing setData', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        const todos = ref(['a', 'b', 'c'])
        const todoOptions = computed(() =>
          todos.value.map((label, index) => ({
            label,
            value: index,
          })),
        )
        return {
          todoOptions,
        }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()

    const mergedPayload = Object.assign({}, ...setData.mock.calls.map(call => call[0]))
    expect(mergedPayload.todoOptions).toEqual([
      { label: 'a', value: 0 },
      { label: 'b', value: 1 },
      { label: 'c', value: 2 },
    ])
  })
})
