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

describe('runtime: setData patch strategy', () => {
  it('emits leaf path for nested mutations', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1, b: 2 } }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.nested.a = 3
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.a': 3 })
  })

  it('treats array mutations as whole-array replace', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ arr: [1, 2, 3] }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.arr.push(4)
    await nextTick()
    expect(calls.at(-1)).toEqual({ arr: [1, 2, 3, 4] })
  })

  it('mutating object inside array replaces whole array', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ arr: [{ a: 1 }] }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.arr[0].a = 2
    await nextTick()
    expect(calls.at(-1)).toEqual({ arr: [{ a: 2 }] })
  })

  it('emits null for deleted keys', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { x: 1 } as any }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    delete inst.state.nested.x
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.x': null })
  })
})
