import { describe, expect, it } from 'vitest'
import { createApp } from '@/index'

function createMockAdapter() {
  const calls: Record<string, any>[] = []
  return {
    calls,
    adapter: {
      setData(payload: Record<string, any>) {
        calls.push(payload)
      },
    },
  }
}

describe('runtime: bindModel with custom event and computed setter', async () => {
  it('bindModel updates computed with setter via custom event', async () => {
    const { adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        d: {
          get(this: any) {
            return this.n * 2
          },
          set(this: any, v: number) {
            this.n = v
          },
        },
      },
    })
    const inst = app.mount(adapter)
    const binding = inst.bindModel<number>('d')
    const model = binding.model({ event: 'change' })
    // call handler
    model.onChange?.({ detail: { value: 7 } })
    expect(inst.state.n).toBe(7)
  })
})
