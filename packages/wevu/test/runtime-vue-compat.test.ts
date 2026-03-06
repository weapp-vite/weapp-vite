import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, mergeModels, useAttrs, useBindModel, useDisposables, useIntersectionObserver, useModel, useNativeInstance, usePageRouter, useRouter, useSlots, useUpdatePerformanceListener } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  delete (globalThis as any).wx
  delete (globalThis as any).my
  delete (globalThis as any).tt
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
describe('runtime: vue compat helpers', () => {
  it('mergeModels merges arrays and objects', () => {
    expect(mergeModels([1, 2], [2, 3])).toEqual([1, 2, 3])
    expect(mergeModels({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    expect(mergeModels(null as any, { a: 1 })).toEqual({ a: 1 })
  })

  it('useAttrs/useSlots/useModel/useNativeInstance/useIntersectionObserver/useRouter/usePageRouter/useUpdatePerformanceListener/useDisposables throw when called outside setup', () => {
    expect(() => useAttrs()).toThrow()
    expect(() => useSlots()).toThrow()
    expect(() => useModel({}, 'modelValue')).toThrow()
    expect(() => useNativeInstance()).toThrow()
    expect(() => useIntersectionObserver()).toThrow()
    expect(() => useRouter()).toThrow()
    expect(() => usePageRouter()).toThrow()
    expect(() => useUpdatePerformanceListener(() => {})).toThrow()
    expect(() => useDisposables()).toThrow()
  })

  it('useAttrs/useSlots expose setup context values, useModel emits update event', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      props: {
        modelValue: { type: String },
        modelModifiers: {},
      } as any,
      setup(props) {
        const attrs = useAttrs()
        const slots = useSlots()
        const model = useModel<string>(props as any, 'modelValue')

        model.value = 'next'
        return { attrs, slots, model }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {
        modelValue: 'init',
        extra: 'alpha',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenCalledWith('update:modelValue', 'next', undefined)
    expect(inst.$wevu?.state?.attrs).toMatchObject({ extra: 'alpha' })
    expect(inst.$wevu?.state?.attrs?.modelValue).toBeUndefined()
    expect(inst.$wevu?.state?.slots).toEqual({})
    expect(Object.getPrototypeOf(inst.$wevu?.state?.slots)).toBeNull()
    expect(Object.isFrozen(inst.$wevu?.state?.slots)).toBe(true)

    inst.properties.extra = 'beta'
    opts.observers['**'].call(inst)
    expect(inst.$wevu?.state?.attrs).toMatchObject({ extra: 'beta' })
  })

  it('useModel supports tuple destructuring, modifiers, and get/set transforms', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      props: {
        modelValue: { type: String },
        modelModifiers: { type: Object, value: { trim: true } },
      } as any,
      setup(props) {
        const [model, modifiers] = useModel<string, 'trim'>(props as any, 'modelValue')
        const [formatted] = useModel<string, 'trim', string, string>(
          props as any,
          'modelValue',
          {
            get(value, mods) {
              if (mods.trim) {
                return (value ?? '').trim()
              }
              return value ?? ''
            },
            set(value, mods) {
              return mods.trim ? value.trim() : value
            },
          },
        )

        expect(modifiers.trim).toBe(true)
        expect(model.value).toBe(' init ')
        expect(formatted.value).toBe('init')

        formatted.value = '  next value  '
        return { model, formatted, modifiers }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent,
      properties: {
        modelValue: ' init ',
        modelModifiers: { trim: true },
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenCalledWith('update:modelValue', 'next value', undefined)
    expect(inst.$wevu?.state?.modifiers?.trim).toBe(true)
  })

  it('useBindModel applies default event for value+change bindings', () => {
    defineComponent({
      data: () => ({ enabled: false }),
      setup() {
        const bindModel = useBindModel({ event: 'change' })
        const enabledModel = bindModel.model<boolean>('enabled')
        return { enabledModel }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData() {}, properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const model = inst.$wevu?.state?.enabledModel
    model.onChange({ detail: { value: true } })

    expect(inst.$wevu?.state?.enabled).toBe(true)
  })

  it('ctx.emit supports Vue style variadic args and normalizes triggerEvent payload', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      setup(_props, ctx) {
        ctx.emit('single', 1)
        ctx.emit('single-with-options', 1, { bubbles: true })
        ctx.emit('multi', 1, 2)
        ctx.emit('multi-with-options', 1, 2, { composed: true })
        return {}
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

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'single', 1, undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'single-with-options', 1, { bubbles: true })
    expect(triggerEvent).toHaveBeenNthCalledWith(3, 'multi', [1, 2], undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(4, 'multi-with-options', [1, 2], { composed: true })
  })

  it('ctx.instance and useNativeInstance expose native methods in setup', () => {
    const triggerEvent = vi.fn()
    const setData = vi.fn()
    const createSelectorQuery = vi.fn(() => ({ in: vi.fn() }))
    const observer = { disconnect: vi.fn() }
    const createIntersectionObserver = vi.fn(() => observer)

    defineComponent({
      setup(_props, ctx) {
        const native = useNativeInstance()
        expect(native).toBe(ctx.instance)

        ctx.instance.triggerEvent('ctx-instance', { from: 'ctx' })
        native.triggerEvent('use-native-instance', { from: 'helper' })
        expect(ctx.instance.createSelectorQuery()).toBeTruthy()
        expect(native.createSelectorQuery()).toBeTruthy()
        expect(ctx.instance.createIntersectionObserver({ thresholds: [0] })).toBe(observer)
        expect(native.createIntersectionObserver({ thresholds: [0] })).toBe(observer)
        ctx.instance.setData({ fromSetupInstance: true })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData,
      triggerEvent,
      createSelectorQuery,
      createIntersectionObserver,
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'ctx-instance', { from: 'ctx' })
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'use-native-instance', { from: 'helper' })
    expect(createSelectorQuery).toHaveBeenCalledTimes(2)
    expect(createIntersectionObserver).toHaveBeenCalledTimes(2)
    expect(setData.mock.calls.some(call => call?.[0]?.fromSetupInstance === true)).toBe(true)
  })

  it('useRouter/usePageRouter prefer native router and pageRouter', () => {
    const componentRouter = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      navigateBack: vi.fn(),
    }
    const pageRouter = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      navigateBack: vi.fn(),
    }

    defineComponent({
      setup() {
        const router = useRouter()
        const hostPageRouter = usePageRouter()
        expect(router).toBe(componentRouter)
        expect(hostPageRouter).toBe(pageRouter)
        router.navigateTo({ url: './from-component' })
        hostPageRouter.navigateTo({ url: './from-page' })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
      router: componentRouter,
      pageRouter,
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(componentRouter.navigateTo).toHaveBeenCalledWith({ url: './from-component' })
    expect(pageRouter.navigateTo).toHaveBeenCalledWith({ url: './from-page' })
  })

  it('useRouter/usePageRouter fallback to global route methods when instance router is unavailable', () => {
    const wxNavigateTo = vi.fn()
    const wxRedirectTo = vi.fn()
    const wxSwitchTab = vi.fn()
    const wxReLaunch = vi.fn()
    const wxNavigateBack = vi.fn()
    ;(globalThis as any).wx = {
      switchTab: wxSwitchTab,
      reLaunch: wxReLaunch,
      redirectTo: wxRedirectTo,
      navigateTo: wxNavigateTo,
      navigateBack: wxNavigateBack,
    }

    defineComponent({
      setup() {
        const router = useRouter()
        const pageRouter = usePageRouter()
        router.navigateTo({ url: '/pages/a/index' })
        pageRouter.redirectTo({ url: '/pages/b/index' })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(wxNavigateTo).toHaveBeenCalledWith({ url: '/pages/a/index' })
    expect(wxRedirectTo).toHaveBeenCalledWith({ url: '/pages/b/index' })
  })

  it('useRouter/usePageRouter fallback to complementary instance accessor before global fallback', () => {
    const pageRouterOnly = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      navigateBack: vi.fn(),
    }
    const componentRouterOnly = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      navigateBack: vi.fn(),
    }

    defineComponent({
      setup() {
        expect(useRouter()).toBe(pageRouterOnly)
        expect(usePageRouter()).toBe(pageRouterOnly)
        return {}
      },
    })

    defineComponent({
      setup() {
        expect(useRouter()).toBe(componentRouterOnly)
        expect(usePageRouter()).toBe(componentRouterOnly)
        return {}
      },
    })

    const pageRouterOnlyOptions = registeredComponents[0]
    const componentRouterOnlyOptions = registeredComponents[1]
    const pageRouterOnlyInstance: any = {
      setData() {},
      properties: {},
      pageRouter: pageRouterOnly,
    }
    const componentRouterOnlyInstance: any = {
      setData() {},
      properties: {},
      router: componentRouterOnly,
    }

    pageRouterOnlyOptions.lifetimes.created.call(pageRouterOnlyInstance)
    pageRouterOnlyOptions.lifetimes.attached.call(pageRouterOnlyInstance)
    componentRouterOnlyOptions.lifetimes.created.call(componentRouterOnlyInstance)
    componentRouterOnlyOptions.lifetimes.attached.call(componentRouterOnlyInstance)
  })

  it('useRouter/usePageRouter fallback to my route methods when wx is unavailable', () => {
    const myContexts: any[] = []
    const myGlobal = {
      switchTab: vi.fn(function (this: any, option: any) {
        myContexts.push(this)
        return option
      }),
      reLaunch: vi.fn(function (this: any, option: any) {
        myContexts.push(this)
        return option
      }),
      redirectTo: vi.fn(function (this: any, option: any) {
        myContexts.push(this)
        return option
      }),
      navigateTo: vi.fn(function (this: any, option: any) {
        myContexts.push(this)
        return option
      }),
      navigateBack: vi.fn(function (this: any, option: any) {
        myContexts.push(this)
        return option
      }),
    }
    ;(globalThis as any).my = myGlobal

    defineComponent({
      setup() {
        const router = useRouter()
        const pageRouter = usePageRouter()
        router.navigateTo({ url: '/pages/fallback-my/index' })
        pageRouter.navigateBack({ delta: 1 })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(myGlobal.navigateTo).toHaveBeenCalledWith({ url: '/pages/fallback-my/index' })
    expect(myGlobal.navigateBack).toHaveBeenCalledWith({ delta: 1 })
    expect(myContexts).toHaveLength(2)
    expect(myContexts.every(context => context === myGlobal)).toBe(true)
  })

  it('useRouter/usePageRouter fallback to tt route methods when wx/my are unavailable', () => {
    const ttContexts: any[] = []
    const ttGlobal = {
      switchTab: vi.fn(function (this: any, option: any) {
        ttContexts.push(this)
        return option
      }),
      reLaunch: vi.fn(function (this: any, option: any) {
        ttContexts.push(this)
        return option
      }),
      redirectTo: vi.fn(function (this: any, option: any) {
        ttContexts.push(this)
        return option
      }),
      navigateTo: vi.fn(function (this: any, option: any) {
        ttContexts.push(this)
        return option
      }),
      navigateBack: vi.fn(function (this: any, option: any) {
        ttContexts.push(this)
        return option
      }),
    }
    ;(globalThis as any).tt = ttGlobal

    defineComponent({
      setup() {
        const router = useRouter()
        const pageRouter = usePageRouter()
        router.reLaunch({ url: '/pages/fallback-tt/index' })
        pageRouter.redirectTo({ url: '/pages/fallback-tt/detail' })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(ttGlobal.reLaunch).toHaveBeenCalledWith({ url: '/pages/fallback-tt/index' })
    expect(ttGlobal.redirectTo).toHaveBeenCalledWith({ url: '/pages/fallback-tt/detail' })
    expect(ttContexts).toHaveLength(2)
    expect(ttContexts.every(context => context === ttGlobal)).toBe(true)
  })

  it('useRouter/usePageRouter throw when runtime global route methods are incomplete', () => {
    ;(globalThis as any).wx = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      // navigateBack 缺失，视为不支持完整 Router 能力
    }

    defineComponent({
      setup() {
        expect(() => useRouter()).toThrow('当前运行环境不支持 Router')
        expect(() => usePageRouter()).toThrow('当前运行环境不支持 Router')
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
  })

  it('useRouter/usePageRouter throw when Router and fallback route methods are both unavailable', () => {
    defineComponent({
      setup() {
        expect(() => useRouter()).toThrow('当前运行环境不支持 Router')
        expect(() => usePageRouter()).toThrow('当前运行环境不支持 Router')
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
  })

  it('useIntersectionObserver auto disconnects on teardown', () => {
    const disconnect = vi.fn()
    const observer = {
      disconnect,
      observe: vi.fn(),
      relativeToViewport: vi.fn(),
    }
    const createIntersectionObserver = vi.fn(() => observer)

    defineComponent({
      setup() {
        const io = useIntersectionObserver({ thresholds: [0, 1] })
        expect(io).toBe(observer)
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      createIntersectionObserver,
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    opts.lifetimes.detached.call(inst)
    opts.lifetimes.detached.call(inst)

    expect(createIntersectionObserver).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('useIntersectionObserver falls back to global createIntersectionObserver', () => {
    const disconnect = vi.fn()
    const observer = { disconnect }
    const wxCreateIntersectionObserver = vi.fn(() => observer)
    ;(globalThis as any).wx = {
      createIntersectionObserver: wxCreateIntersectionObserver,
    }

    defineComponent({
      setup() {
        const io = useIntersectionObserver()
        expect(io).toBe(observer)
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.detached.call(inst)

    expect(wxCreateIntersectionObserver).toHaveBeenCalledWith(inst, {})
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('useUpdatePerformanceListener registers and auto clears on teardown', () => {
    const listener = vi.fn()
    const setUpdatePerformanceListener = vi.fn()

    defineComponent({
      setup() {
        const stop = useUpdatePerformanceListener(listener)
        expect(typeof stop).toBe('function')
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      setUpdatePerformanceListener,
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.detached.call(inst)
    opts.lifetimes.detached.call(inst)

    expect(setUpdatePerformanceListener).toHaveBeenCalledTimes(2)
    expect(setUpdatePerformanceListener).toHaveBeenNthCalledWith(1, listener)
    expect(setUpdatePerformanceListener).toHaveBeenNthCalledWith(2, undefined)
  })

  it('useUpdatePerformanceListener throws when native API is unavailable', () => {
    defineComponent({
      setup() {
        expect(() => useUpdatePerformanceListener(() => {})).toThrow('当前实例不支持 setUpdatePerformanceListener')
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
  })

  it('useDisposables auto runs registered cleanups on teardown', () => {
    const disposeFn = vi.fn()
    const stopFn = vi.fn()
    const abortFn = vi.fn()
    let bagRef: ReturnType<typeof useDisposables> | undefined

    defineComponent({
      setup() {
        const bag = useDisposables()
        bagRef = bag
        bag.add(disposeFn)
        bag.add({ stop: stopFn })
        const removeAbort = bag.add({ abort: abortFn })
        removeAbort()
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.detached.call(inst)
    opts.lifetimes.detached.call(inst)
    bagRef?.dispose()

    expect(disposeFn).toHaveBeenCalledTimes(1)
    expect(stopFn).toHaveBeenCalledTimes(1)
    expect(abortFn).toHaveBeenCalledTimes(0)
  })

  it('useDisposables timer helpers register clear handlers', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    try {
      defineComponent({
        setup() {
          const bag = useDisposables()
          bag.setTimeout(() => {}, 30_000)
          bag.setInterval(() => {}, 30_000)
          return {}
        },
      })

      const opts = registeredComponents[0]
      const inst: any = {
        setData() {},
        properties: {},
      }
      opts.lifetimes.created.call(inst)
      opts.lifetimes.attached.call(inst)
      opts.lifetimes.detached.call(inst)

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    }
    finally {
      clearTimeoutSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    }
  })
})
