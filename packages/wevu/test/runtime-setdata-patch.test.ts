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

  it('does not emit computed when unrelated state changes', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1, b: 1 }),
      computed: {
        d(this: any) {
          return this.a * 2
        },
      },
      setData: { strategy: 'patch', includeComputed: true },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.b = 2
    await nextTick()
    expect(calls.at(-1)).toEqual({ b: 2 })
  })

  it('computedCompare=deep uses depth/key limits to avoid heavy recursion', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1, b: 1 }),
      computed: {
        d(this: any) {
          return { nested: { value: this.a } }
        },
      },
      setData: {
        strategy: 'patch',
        includeComputed: true,
        computedCompare: 'deep',
        computedCompareMaxDepth: 0,
      },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.a = 2
    await nextTick()
    // depth=0 会直接判定不相等，从而下发 computed（不递归比较）
    expect(calls.at(-1)).toHaveProperty('d')
  })

  it('debug receives fallback reason when patch downgrades to diff', async () => {
    const debugCalls: any[] = []
    const { adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1 }),
      setData: {
        strategy: 'patch',
        includeComputed: false,
        maxPatchKeys: 0,
        debug: (info) => {
          debugCalls.push(info)
        },
      },
    })
    const inst = app.mount(adapter)
    inst.state.a = 2
    await nextTick()
    expect(debugCalls.some(i => i.reason === 'maxPatchKeys')).toBe(true)
  })

  it('falls back to top-level patches for shared references without full diff', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })
    const shared: any = { x: 1 }

    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: shared, b: shared, big }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    getterCalls = 0

    inst.state.a.x = 2
    await nextTick()
    expect(getterCalls).toBe(0)
    expect(calls.at(-1)).toEqual({ a: { x: 2 }, b: { x: 2 } })
  })

  it('merges sibling paths into parent when threshold met', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1, b: 2, c: 3 } }),
      setData: { strategy: 'patch', includeComputed: false, mergeSiblingThreshold: 2 },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.nested.a = 10
    inst.state.nested.b = 20
    await nextTick()
    expect(calls.at(-1)).toEqual({ nested: { a: 10, b: 20, c: 3 } })
  })

  it('skips sibling merge when it would inflate payload too much', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1, b: 2, c: 'x'.repeat(2000) } }),
      setData: {
        strategy: 'patch',
        includeComputed: false,
        mergeSiblingThreshold: 2,
        mergeSiblingMaxInflationRatio: 1,
      },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.nested.a = 10
    inst.state.nested.b = 20
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.a': 10, 'nested.b': 20 })
  })

  it('does not merge siblings when deletion exists', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1, b: 2, c: 3 } as any }),
      setData: { strategy: 'patch', includeComputed: false, mergeSiblingThreshold: 2 },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    delete inst.state.nested.a
    inst.state.nested.b = 20
    await nextTick()
    expect(calls.at(-1)).toEqual({ 'nested.a': null, 'nested.b': 20 })
  })

  it('falls back to diff when maxPatchKeys is exceeded', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })

    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1, b: 1, big }),
      setData: { strategy: 'patch', includeComputed: false, maxPatchKeys: 0 },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    getterCalls = 0

    inst.state.a = 2
    await nextTick()
    // diff 回退会收集全量快照，因此会读取 big.hidden 触发 getter
    expect(getterCalls).toBeGreaterThan(0)
  })

  it('stays in patch mode when within maxPatchKeys', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })

    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1, big }),
      setData: { strategy: 'patch', includeComputed: false, maxPatchKeys: 10 },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)
    getterCalls = 0

    inst.state.a = 2
    await nextTick()
    // patch 只序列化变更路径，不应读取 big.hidden
    expect(getterCalls).toBe(0)
    expect(calls.at(-1)).toEqual({ a: 2 })
  })

  it('collapses descendant keys when parent key exists', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ nested: { a: 1 } }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls).toHaveLength(1)

    inst.state.nested = { a: 10 } as any
    inst.state.nested.a = 11
    await nextTick()
    expect(calls.at(-1)).toEqual({ nested: { a: 11 } })
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
