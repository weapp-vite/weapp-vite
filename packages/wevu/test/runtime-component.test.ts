import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defineComponent,
  onAttached,
  onDetached,
  onError,
  onHide,
  onMoved,
  onReady,
  onResize,
  onRouteDone,
  onShow,
  onTabItemTap,
  resetWevuDefaults,
  setWevuDefaults,
} from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  resetWevuDefaults()
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
afterEach(() => {
  delete (globalThis as any).Component
  resetWevuDefaults()
})

describe('runtime: component lifetimes/pageLifetimes mapping', () => {
  it('attached/ready/moved/error/detached + pageLifetimes show/hide/resize/routeDone + onTabItemTap', () => {
    const logs: string[] = []
    defineComponent({
      data: () => ({}),
      onTabItemTap() {},
      setup() {
        onAttached(() => logs.push('attached'))
        onDetached(() => logs.push('detached'))
        onReady(() => logs.push('ready'))
        onShow(() => logs.push('show'))
        onHide(() => logs.push('hide'))
        onMoved(() => logs.push('moved'))
        onResize(() => logs.push('resize'))
        onRouteDone(() => logs.push('routeDone'))
        onError(() => logs.push('error'))
        onTabItemTap(() => logs.push('tab'))
      },
      methods: {},
      lifetimes: {},
      pageLifetimes: {},
    })
    expect(registeredComponents).toHaveLength(1)
    const opts = registeredComponents[0]
    const inst: any = { setData() {} }
    // 生命周期：attach（挂载 runtime）
    opts.lifetimes.attached.call(inst)
    // 生命周期：ready（就绪）
    opts.lifetimes.ready.call(inst)
    // 生命周期：moved / error（移动/错误）
    opts.lifetimes.moved.call(inst)
    opts.lifetimes.error.call(inst, new Error('boom'))
    // 页面 show/hide
    opts.pageLifetimes.show.call(inst)
    opts.pageLifetimes.hide.call(inst)
    opts.pageLifetimes.resize.call(inst)
    opts.pageLifetimes.routeDone.call(inst)
    // tab
    if (typeof opts.onTabItemTap === 'function') {
      opts.onTabItemTap.call(inst, { index: 0, pagePath: '', text: '' })
    }
    // 生命周期：detach（卸载/清理）
    opts.lifetimes.detached.call(inst)
    expect(logs).toEqual(['attached', 'ready', 'moved', 'error', 'show', 'hide', 'resize', 'routeDone', 'tab', 'detached'])
  })

  it('enables multipleSlots by default for components', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.multipleSlots).toBe(true)
  })

  it('respects user options.multipleSlots override', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
      options: {
        multipleSlots: false,
        virtualHost: true,
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.multipleSlots).toBe(false)
    expect(opts.options?.virtualHost).toBe(true)
  })

  it('applies global component options defaults', () => {
    setWevuDefaults({
      component: {
        options: {
          styleIsolation: 'apply-shared',
        },
      },
    })
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.styleIsolation).toBe('apply-shared')
  })

  it('lets user options override global defaults', () => {
    setWevuDefaults({
      component: {
        options: {
          styleIsolation: 'apply-shared',
          multipleSlots: false,
        },
      },
    })
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
      options: {
        styleIsolation: 'isolated',
        virtualHost: true,
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.styleIsolation).toBe('isolated')
    expect(opts.options?.multipleSlots).toBe(false)
    expect(opts.options?.virtualHost).toBe(true)
  })

  it('auto exports ctx.expose result by default', () => {
    defineComponent({
      data: () => ({}),
      setup(_props, ctx) {
        ctx.expose({ a: 1 })
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(typeof opts.export).toBe('function')

    const inst: any = { setData() {} }
    opts.lifetimes.attached.call(inst)

    const exported = opts.export.call(inst)
    expect(exported).toEqual({ a: 1 })
  })

  it('merges ctx.expose result with user export() when both provided', () => {
    defineComponent({
      data: () => ({}),
      export() {
        return { b: 2, a: 0 }
      },
      setup(_props, ctx) {
        ctx.expose({ a: 1 })
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(typeof opts.export).toBe('function')

    const inst: any = { setData() {} }
    opts.lifetimes.attached.call(inst)

    const exported = opts.export.call(inst)
    expect(exported).toEqual({ a: 0, b: 2 })
  })

  it('runs setup in attached by default', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {
          count: 1,
        }
      },
    })
    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.created.call(inst)
    await Promise.resolve()
    expect(setData).not.toHaveBeenCalled()

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()
    expect(setData).toHaveBeenCalled()
    expect(setData.mock.calls[0]?.[0]).toMatchObject({ count: 1 })
  })

  it('runs setup in created when setupLifecycle is set and defers setData until attached', async () => {
    defineComponent({
      data: () => ({}),
      setupLifecycle: 'created',
      setup() {
        return {
          count: 1,
        }
      },
    })
    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.created.call(inst)
    await Promise.resolve()
    expect(setData).not.toHaveBeenCalled()

    opts.lifetimes.attached.call(inst)
    await Promise.resolve()
    expect(setData).toHaveBeenCalled()
    expect(setData.mock.calls[0]?.[0]).toMatchObject({ count: 1 })
  })

  it('drops __typeProps before registering component options', () => {
    defineComponent({
      __typeProps: {} as { label: string },
      data: () => ({}),
      setup() {
        return {}
      },
    })

    const opts = registeredComponents[0]
    expect(Object.prototype.hasOwnProperty.call(opts, '__typeProps')).toBe(false)
  })

  it('supports calling native triggerEvent from runtime methods this binding', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire(detail: Record<string, any>) {
          this.triggerEvent('change', detail)
        },
      },
      setup() {
        return {
          fireFromSetup(detail: Record<string, any>) {
            this.triggerEvent('change-setup', detail)
          },
        }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    opts.methods.fire.call(inst, { source: 'methods' })
    inst.fireFromSetup({ source: 'setup' })

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'change', { source: 'methods' })
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'change-setup', { source: 'setup' })
  })

  it('supports native triggerEvent when host instance is a proxy with custom has trap', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire() {
          this.triggerEvent('change', { source: 'proxy-host' })
        },
      },
    })

    const opts = registeredComponents[0]
    const rawInst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }
    const proxyInst = new Proxy(rawInst, {
      has() {
        return false
      },
    })

    opts.lifetimes.created.call(proxyInst)
    opts.lifetimes.attached.call(proxyInst)
    opts.methods.fire.call(proxyInst)

    expect(triggerEvent).toHaveBeenCalledWith('change', { source: 'proxy-host' })
  })

  it('syncs native instance before runtime method call when invocation this changes', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire() {
          this.triggerEvent('change', { source: 'invocation-this' })
        },
      },
    })

    const opts = registeredComponents[0]
    const mountedInst: any = {
      setData() {},
      properties: {},
    }

    opts.lifetimes.created.call(mountedInst)
    opts.lifetimes.attached.call(mountedInst)

    const callInst: any = {
      ...mountedInst,
      triggerEvent,
    }

    opts.methods.fire.call(callInst)

    expect(triggerEvent).toHaveBeenCalledWith('change', { source: 'invocation-this' })
  })

  it('avoids syncing runtime bridge methods as native instance', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire() {
          this.triggerEvent('change', { source: 'bridge-filter' })
        },
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const runtimeProxy = inst.__wevu?.proxy
    expect(runtimeProxy).toBeTruthy()

    const bridgeInst: any = {
      __wevu: inst.__wevu,
      triggerEvent: runtimeProxy.triggerEvent,
      createSelectorQuery: runtimeProxy.createSelectorQuery,
      setData: runtimeProxy.setData,
    }

    expect(() => opts.methods.fire.call(bridgeInst)).not.toThrow()
    expect(triggerEvent).toHaveBeenCalledWith('change', { source: 'bridge-filter' })
  })

  it('resolves runtime when method this is runtime proxy', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire() {
          this.triggerEvent('change', { source: 'runtime-proxy' })
        },
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const runtimeProxy = inst.__wevu?.proxy
    expect(runtimeProxy).toBeTruthy()

    opts.methods.fire.call(runtimeProxy)

    expect(triggerEvent).toHaveBeenCalledWith('change', { source: 'runtime-proxy' })
  })

  it('falls back to runtime.instance when native instance ref is unavailable', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      data: () => ({}),
      methods: {
        fire() {
          this.triggerEvent('change', { source: 'runtime-instance-fallback' })
        },
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    delete inst.__wevu.state.__wevuNativeInstance
    opts.methods.fire.call(inst.__wevu.proxy)

    expect(triggerEvent).toHaveBeenCalledWith('change', { source: 'runtime-instance-fallback' })
  })
})
