import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createApp,
  defineComponent,
  getCurrentInstance,
  nextTick,
  onPageScroll,
  onShareAppMessage,
} from '@/index'

const registeredComponents: Record<string, any>[] = []
const registeredApps: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  registeredApps.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
  ;(globalThis as any).App = vi.fn((options: Record<string, any>) => {
    registeredApps.push(options)
  })
})

afterEach(() => {
  delete (globalThis as any).Component
  delete (globalThis as any).App
})

describe('runtime: features & hooks', () => {
  it('getCurrentInstance only during setup', () => {
    expect(getCurrentInstance()).toBeUndefined()
    let during: any
    defineComponent({
      setup() {
        during = getCurrentInstance()
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    componentOptions.lifetimes.attached.call({})
    expect(during).toBeDefined()
  })

  it('computed write without setter throws', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        double(this: any) {
          return this.n * 2
        },
      },
    })
    const inst = app.mount()
    expect(() => {
      ;(inst.proxy as any).double = 5
    }).toThrow()
  })

  it('object computed missing getter throws', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        bad: {
          set() {},
        } as any,
      },
    })
    expect(() => app.mount()).toThrow()
  })

  it('bindModel invalid path throws', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
    })
    const inst = app.mount()
    expect(() => inst.bindModel('')).toThrow()
  })

  it('Page onShareAppMessage priority: wevu hook overrides native when enabled', () => {
    const title = 'wevu'
    defineComponent({
      features: { enableShareAppMessage: true },
      setup() {
        onShareAppMessage(() => ({ title }))
      },
      onShareAppMessage() {
        return { title: 'native' }
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const pageInst: any = {}
    componentOptions.lifetimes.attached.call(pageInst)
    const r = componentOptions.onShareAppMessage.call(pageInst)
    expect(r).toMatchObject({ title })
  })

  it('listenPageScroll gating', async () => {
    const logs: number[] = []
    defineComponent({
      features: { listenPageScroll: true },
      setup() {
        onPageScroll((e: any) => {
          logs.push(Number(e?.scrollTop ?? -1))
        })
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const pageInst: any = {}
    componentOptions.lifetimes.attached.call(pageInst)
    componentOptions.onPageScroll.call(pageInst, { scrollTop: 10 })
    await nextTick()
    expect(logs.at(-1)).toBe(10)
  })

  it('registerWatches supports function and string descriptors', async () => {
    const calls: number[] = []
    defineComponent({
      data: () => ({ n: 0 }),
      methods: {
        inc(this: any) {
          this.n += 1
        },
      },
      watch: {
        n(this: any) {
          calls.push(this.n)
        },
      } as Record<string, (...args: any[]) => any>,
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const inst: any = { setData() {} }
    componentOptions.lifetimes.attached.call(inst)
    inst.$wevu!.methods.inc()
    await nextTick()
    expect(calls.at(-1)).toBe(1)
  })

  it('registerWatches supports string descriptors to instance method and empty path', async () => {
    const calls: number[] = []
    defineComponent({
      data: () => ({ n: 0 }),
      methods: {
        incInst(this: any) {
          calls.push(this.n + 1)
        },
      },
      watch: {
        'n': 'incInst',
        '': { handler(this: any) { calls.push(999) }, immediate: true, deep: true },
      } as any,
    } as any)
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const inst: any = { setData() {} }
    componentOptions.lifetimes.attached.call(inst)
    // 通过 runtime method 更新 setData 路径来触发 watch
    inst.$wevu!.state.n = 5
    await nextTick()
    expect(calls).toContain(6)
    expect(calls).toContain(999)
  })

  it('public proxy exposes methods/computed in ownKeys and has', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
      methods: { m(this: any) { return this.n } },
      computed: { c(this: any) { return this.n * 2 } },
    })
    const inst = app.mount()
    const keys = Object.keys(inst.proxy as any)
    expect(keys).toContain('c')
    expect('m' in (inst.proxy as any)).toBe(true)
    expect('c' in (inst.proxy as any)).toBe(true)
  })
})

describe('runtime: app plugins and globalProperties', () => {
  it('app.use function and object install; duplicate ignored; bad plugin throws', () => {
    const app = createApp({ data: () => ({}) })
    let called = 0
    function fnPlugin() {
      called++
    }
    const objPlugin = {
      install() {
        called++
      },
    }
    app.use(fnPlugin).use(fnPlugin) // duplicate
    app.use(objPlugin)
    expect(called).toBe(2)
    expect(() => app.use({} as any)).toThrow()
  })

  it('globalProperties fallback in proxy', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
      methods: {
        read(this: any) {
          return this.$foo + this.n
        },
      },
    })
    app.config.globalProperties.$foo = 2
    const inst = app.mount()
    expect(inst.methods.read()).toBe(3)
  })
})
