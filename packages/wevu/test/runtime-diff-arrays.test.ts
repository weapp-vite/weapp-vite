import { describe, expect, it } from 'vitest'
import { createApp, nextTick } from '@/index'

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

describe('runtime: diff arrays/objects', () => {
  it('array change replaces entire array path', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ arr: [1, 2, 3] as number[] }),
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    inst.state.arr = [1, 2]
    await nextTick()
    expect(calls.at(-1)).toEqual({ arr: [1, 2] })
  })

  it('nested object change updates only changed path', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1, b: 2 } }),
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    inst.state.nested.a = 3
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.a': 3 })
  })

  it('nested new key adds path', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1 } as any }),
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    inst.state.nested.b = 2
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.b': 2 })
  })
})
