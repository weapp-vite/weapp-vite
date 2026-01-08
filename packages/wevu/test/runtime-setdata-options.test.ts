import { afterEach, describe, expect, it } from 'vitest'
import { createApp, nextTick, resetWevuDefaults, setWevuDefaults } from '@/index'

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

describe('runtime: setData snapshot options', () => {
  afterEach(() => {
    resetWevuDefaults()
  })

  it('pick only emits selected keys', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ a: 1, b: 2 }),
      setData: { pick: ['a'] },
    })
    const inst = app.mount(adapter)
    expect(calls.at(-1)).toEqual({ a: 1 })

    inst.state.b = 3
    await nextTick()
    // b 被 pick 排除，因此 diff 为空，不应触发 setData
    expect(calls.at(-1)).toEqual({ a: 1 })
  })

  it('includeComputed=false excludes computed values', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        d(this: any) {
          return this.n * 2
        },
      },
      setData: { includeComputed: false },
    })
    const inst = app.mount(adapter)
    expect(calls.at(-1)).toEqual({ n: 1 })

    inst.state.n = 2
    await nextTick()
    expect(calls.at(-1)).toEqual({ n: 2 })
  })

  it('respects global setData defaults', async () => {
    setWevuDefaults({
      app: {
        setData: {
          includeComputed: false,
        },
      },
    })
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        d(this: any) {
          return this.n * 2
        },
      },
    })
    app.mount(adapter)
    expect(calls.at(-1)).toEqual({ n: 1 })
  })

  it('allows per-app setData override of defaults', async () => {
    setWevuDefaults({
      app: {
        setData: {
          includeComputed: false,
        },
      },
    })
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        d(this: any) {
          return this.n * 2
        },
      },
      setData: {
        includeComputed: true,
      },
    })
    app.mount(adapter)
    expect(calls.at(-1)).toEqual({ n: 1, d: 2 })
  })
})

describe('runtime: toPlain lenient serialization', () => {
  it('serializes Date/Map/Set/RegExp/Error/ArrayBuffer', () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        when: new Date(0),
        map: new Map([['a', 1]]),
        set: new Set([1, 2]),
        re: /x/gi,
        err: new Error('boom'),
        buf: new ArrayBuffer(3),
      }),
    })
    app.mount(adapter)

    const first = calls[0]
    expect(first.when).toBe(0)
    expect(first.map).toEqual([['a', 1]])
    expect(first.set).toEqual([1, 2])
    expect(first.re).toBe('/x/gi')
    expect(first.err).toEqual({ name: 'Error', message: 'boom' })
    expect(first.buf).toBe(3)
  })
})
