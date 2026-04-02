import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from '@/index'

const registeredComponents: Record<string, any>[] = []

async function flushJobs() {
  await nextTick()
  await nextTick()
}

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: setup method used by computed binding', () => {
  it('re-evaluates computed value after setup methods are injected', async () => {
    defineComponent({
      data: () => ({}),
      computed: {
        __wv_bind_0(this: any) {
          const getter = this.getCase
          return typeof getter === 'function' ? getter() : undefined
        },
      },
      setup() {
        const getCase = () => '123'
        return {
          getCase,
        }
      },
    })

    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.attached.call(inst)
    await flushJobs()

    expect(inst.$wevu.proxy.__wv_bind_0).toBe('123')
    const hasExpectedPayload = setData.mock.calls
      .map(call => call?.[0] ?? {})
      .some(payload => payload.__wv_bind_0 === '123')
    expect(hasExpectedPayload).toBe(true)
  })
})
