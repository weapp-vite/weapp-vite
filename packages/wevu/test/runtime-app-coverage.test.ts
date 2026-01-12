import { describe, expect, it, vi } from 'vitest'
import { createApp } from '@/runtime/app'
import { nextTick } from '@/scheduler'

function createAdapter() {
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

describe('runtime app - public instance and computed', () => {
  it('exposes computed, methods, and descriptors', () => {
    const { adapter } = createAdapter()
    const app = createApp({
      data: () => ({ count: 1 }),
      computed: {
        double(this: any) {
          return this.count * 2
        },
        writable: {
          get(this: any) {
            return this.count
          },
          set(this: any, value: number) {
            this.count = value
          },
        },
      },
      methods: {
        inc(this: any) {
          this.count += 1
        },
      },
    })

    const inst = app.mount(adapter)
    const proxy: any = inst.proxy

    expect(proxy.$state).toBe(inst.state)
    expect(proxy.$computed.double).toBe(2)
    expect(proxy.double).toBe(2)
    expect('double' in proxy).toBe(true)
    expect('missing' in proxy).toBe(false)

    const computedDesc = Object.getOwnPropertyDescriptor(proxy, 'double')
    expect(computedDesc?.enumerable).toBe(true)

    const methodDesc = Object.getOwnPropertyDescriptor(proxy, 'inc')
    expect(methodDesc?.enumerable).toBe(false)

    const keys = Object.keys(proxy)
    expect(keys).toContain('double')

    const allKeys = Reflect.ownKeys(proxy)
    expect(allKeys).toContain('inc')

    proxy.writable = 5
    expect(inst.state.count).toBe(5)

    expect(() => {
      proxy.double = 3
    }).toThrow('计算属性')

    inst.unmount()
  })

  it('throws when computed getter missing', () => {
    const app = createApp({
      data: () => ({ count: 1 }),
      computed: {
        bad: {} as any,
      },
    })

    expect(() => app.mount({ setData() {} })).toThrow('需要提供 getter')
  })
})

describe('runtime app - patch and debug branches', () => {
  it('falls back on maxPatchKeys and handles debug errors', async () => {
    const calls: Record<string, any>[] = []
    const debug = vi.fn(() => {
      throw new Error('debug failure')
    })

    const app = createApp({
      data: () => ({ a: { b: 1 } }),
      setData: {
        strategy: 'patch',
        maxPatchKeys: 0,
        debug,
        debugWhen: 'always',
      },
    })

    const inst = app.mount({
      setData(payload) {
        calls.push(payload)
      },
    })

    inst.state.a.b = 2
    await nextTick()

    expect(calls.length).toBeGreaterThan(0)
    inst.unmount()
  })

  it('skips debug based on sample rate', async () => {
    const calls: Record<string, any>[] = []
    const debug = vi.fn()
    const originalRandom = Math.random
    Math.random = () => 1

    const app = createApp({
      data: () => ({ a: 1 }),
      setData: {
        strategy: 'patch',
        debug,
        debugWhen: 'always',
        debugSampleRate: 0.5,
      },
    })

    const inst = app.mount({
      setData(payload) {
        calls.push(payload)
      },
    })

    inst.state.a = 2
    await nextTick()

    expect(debug).not.toHaveBeenCalled()
    Math.random = originalRandom
    inst.unmount()
  })
})

describe('runtime app - merge sibling and payload sizing', () => {
  it('merges sibling patches and skips stable computed', async () => {
    const { calls, adapter } = createAdapter()

    const app = createApp({
      data: () => ({
        nested: { a: 1, b: 2 },
        flag: false,
      }),
      computed: {
        stable(this: any) {
          return this.flag ? { a: 1 } : { a: 1 }
        },
      },
      setData: {
        strategy: 'patch',
        mergeSiblingThreshold: 2,
        mergeSiblingMaxInflationRatio: 100,
        mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
        computedCompare: 'shallow',
      },
    })

    const inst = app.mount(adapter)
    calls.length = 0

    inst.state.nested.a = 3
    inst.state.nested.b = 4
    inst.state.flag = true
    await nextTick()

    const payload = calls.at(-1) || {}
    expect(payload.nested).toBeDefined()
    expect(payload.stable).toBeUndefined()
    inst.unmount()
  })

  it('falls back on maxPayloadBytes', async () => {
    const { calls, adapter } = createAdapter()

    const app = createApp({
      data: () => ({ big: 'x'.repeat(50) }),
      setData: {
        strategy: 'patch',
        maxPayloadBytes: 10,
      },
    })

    const inst = app.mount(adapter)
    calls.length = 0

    inst.state.big = 'y'.repeat(50)
    await nextTick()

    expect(calls.length).toBeGreaterThan(0)
    inst.unmount()
  })
})

describe('runtime app - plugins and watch helpers', () => {
  it('supports plugin installation and watch cleanup', () => {
    const app = createApp({ data: () => ({ count: 1 }) })

    const plugin = vi.fn()
    const pluginObj = { install: vi.fn() }

    app.use(plugin)
    app.use(plugin)
    app.use(pluginObj)

    expect(plugin).toHaveBeenCalledTimes(1)
    expect(pluginObj.install).toHaveBeenCalledTimes(1)

    expect(() => app.use({} as any)).toThrow('install method')

    const inst = app.mount({ setData() {} })
    const stop = inst.watch(() => inst.state.count, () => {})
    stop()

    inst.unmount()
    inst.unmount()
  })
})
