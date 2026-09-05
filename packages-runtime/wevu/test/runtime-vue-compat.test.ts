import { WEVU_HOST_COMMIT_PROMISE_KEY, WEVU_PUBLIC_RUNTIME_KEY, WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD, WEVU_RUNTIME_APP_KEY, WEVU_SCOPED_SLOT_OWNER_STORE_KEY, WEVU_SLOT_NAMES_PROP } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createWevuComponent, defineComponent, getCurrentInstance, mergeModels, nextTick, toRaw, useAttrs, useBindModel, useChangeModel, useDisposables, useIntersectionObserver, useModel, useNativeInstance, useNativePageRouter, useNativeRouter, usePageScrollThrottle, useSlots, useUpdatePerformanceListener } from '@/index'
import { normalizeStyle, resolvePropValue } from '@/runtime/template'

const registeredComponents: Record<string, any>[] = []

function expectRouteOption(call: unknown[], url: string): void {
  expect(call[0]).toMatchObject({ url })
  expect(call[0]).toMatchObject({ success: expect.any(Function) })
}

beforeEach(() => {
  registeredComponents.length = 0
  delete (globalThis as any).wx
  delete (globalThis as any).my
  delete (globalThis as any).tt
  delete (globalThis as any).getApp
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
describe('runtime: vue compat helpers', () => {
  it('exposes the Vue internal instance proxy, uid and exposed state during setup', () => {
    let internal: any
    const focus = vi.fn()
    defineComponent({
      setup(_props, { expose }) {
        internal = getCurrentInstance()
        expose({ focus })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(internal).toBe(inst)
    expect(internal.proxy.$).toBe(internal)
    expect(internal.proxy.$el).toBe(inst)
    expect(internal.proxy).toBeTruthy()
    expect(internal.uid).toEqual(expect.any(Number))
    expect(internal.exposed).toEqual({ focus })
  })

  it('does not consume the root App registration slot for component runtimes', () => {
    const registerRootApp = vi.fn()
    ;(globalThis as any).App = registerRootApp

    defineComponent({})

    expect(registerRootApp).not.toHaveBeenCalled()
    expect((globalThis as any).wx?.__wevuAppRegistered).not.toBe(true)
  })

  it('exposes declared props through the Vue public instance proxy', () => {
    let internal: any
    defineComponent({
      props: {
        title: { type: String },
      },
      setup() {
        internal = getCurrentInstance()
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {
        title: 'Child title',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(internal.proxy.title).toBe('Child title')
    expect('title' in internal.proxy).toBe(true)
  })

  it('exposes $nextTick with the public instance as callback context', async () => {
    defineComponent({})

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const proxy = inst.__wevu.proxy
    await expect(proxy.$nextTick(function (this: unknown) {
      return this === proxy
    })).resolves.toBe(true)
    expect('$nextTick' in proxy).toBe(true)
  })

  it('waits for the provider host commit before an instance nextTick callback', async () => {
    defineComponent({})

    const opts = registeredComponents[0]
    let resolveHostCommit!: () => void
    const hostCommit = new Promise<void>((resolve) => {
      resolveHostCommit = resolve
    })
    interface RuntimeTestInstance {
      __wevu?: {
        proxy: {
          $nextTick: (callback?: () => unknown) => Promise<unknown>
        }
      }
      properties: Record<string, unknown>
      setData: () => void
      triggerEvent: (...args: unknown[]) => unknown
      [WEVU_HOST_COMMIT_PROMISE_KEY]: Promise<void>
    }
    const inst: RuntimeTestInstance = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
      [WEVU_HOST_COMMIT_PROMISE_KEY]: hostCommit,
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const proxy = inst.__wevu?.proxy
    expect(proxy).toBeDefined()
    if (!proxy) {
      throw new Error('expected mounted Wevu proxy')
    }
    const callback = vi.fn()
    const pending = proxy.$nextTick(callback)
    await nextTick()
    await Promise.resolve()

    expect(callback).not.toHaveBeenCalled()
    resolveHostCommit()
    await pending
    expect(callback).toHaveBeenCalledOnce()
  })

  it('exposes $nextTick inside Options API mounted hooks', async () => {
    const callback = vi.fn()
    defineComponent({
      mounted() {
        this.$nextTick(callback)
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.ready.call(inst)
    await Promise.resolve()

    expect(callback.mock.contexts[0]).toBe(inst.__wevu.proxy)
  })

  it('resolves the public instance when DevTools wraps the ready lifecycle instance', async () => {
    const callback = vi.fn()
    defineComponent({
      mounted() {
        this.$nextTick(callback)
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      data: {},
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    let hostRuntimeApp: Record<string, any> | undefined
    Object.defineProperty(inst, '__wevuRuntimeApp', {
      configurable: true,
      get: () => hostRuntimeApp ? { ...hostRuntimeApp } : undefined,
      set: value => hostRuntimeApp = value,
    })
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const readyInst: any = {
      __wevuRuntimeOwnerId: inst.__wevuRuntimeOwnerId,
    }
    ;(globalThis as any)[WEVU_SCOPED_SLOT_OWNER_STORE_KEY] = new Map()
    opts.lifetimes.ready.call(readyInst)
    await Promise.resolve()

    expect(readyInst.__wevu).toBeTruthy()
    expect(callback.mock.contexts[0]).toBe(readyInst.__wevu.proxy)
  })

  it('exposes Vue 2 mutation helpers, slots and refs on the public instance', () => {
    defineComponent({
      properties: {
        [WEVU_SLOT_NAMES_PROP]: { type: null, value: null },
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {
        [WEVU_SLOT_NAMES_PROP]: { header: true },
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const proxy = inst.__wevu.proxy
    const target: Record<string, any> = {}
    expect(Object.keys(inst.__wevu.state.$slots)).toEqual(['header'])
    expect(typeof proxy.$slots.header).toBe('function')
    proxy.$set(target, 'ready', true)
    expect(target.ready).toBe(true)
    expect(proxy.$delete(target, 'ready')).toBe(true)
    expect(target).not.toHaveProperty('ready')
    expect(proxy.$refs).toEqual({})
    expect('$slots' in proxy).toBe(true)
    expect('$refs' in proxy).toBe(true)
  })

  it('supports Options API provide and inject through the native owner chain', () => {
    defineComponent({
      name: 'provider',
      provide() {
        return { sharedValue: this }
      },
    } as any)
    defineComponent({
      name: 'consumer',
      inject: ['sharedValue'],
    } as any)

    const parentOptions = registeredComponents[0]
    const childOptions = registeredComponents[1]
    const parent: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    parentOptions.lifetimes.created.call(parent)
    parentOptions.lifetimes.attached.call(parent)

    const child: any = {
      selectOwnerComponent: () => parent,
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    childOptions.lifetimes.created.call(child)
    childOptions.lifetimes.attached.call(child)

    expect(child.__wevu.proxy.sharedValue).toBe(parent.__wevu.proxy)
  })

  it('initializes injected watch sources before watching across scoped slot hosts', async () => {
    const updateOffsetFromChild = vi.fn()
    const earlyWatchCalls: unknown[] = []

    defineComponent({
      name: 'u-list',
      data() {
        return { innerScrollTop: 0 }
      },
      provide() {
        return { uList: this }
      },
      methods: {
        updateOffsetFromChild,
      },
    } as any)
    defineComponent({ name: 'scoped-slots-default' } as any)
    defineComponent({
      name: 'u-list-item',
      inject: ['uList'],
      watch: {
        'uList.innerScrollTop': function (this: any, value: number) {
          if (typeof this.parent?.updateOffsetFromChild !== 'function') {
            earlyWatchCalls.push(value)
            return
          }
          this.parent.updateOffsetFromChild(value)
        },
      },
      created() {
        this.parent = {}
      },
      mounted() {
        let parent = this.$parent
        while (parent && parent.$options?.name !== 'u-list') {
          parent = parent.$parent
        }
        this.parent = parent
      },
    } as any)

    const [parentOptions, slotHostOptions, childOptions] = registeredComponents
    const createInstance = (options: Record<string, any>, owner?: Record<string, any>) => {
      const instance: any = {
        data: typeof options.data === 'function' ? options.data() : structuredClone(options.data ?? {}),
        properties: {},
        selectOwnerComponent: () => owner,
        setData(payload: Record<string, any>) {
          Object.assign(this.data, payload)
        },
        triggerEvent: vi.fn(),
      }
      options.lifetimes.created.call(instance)
      options.lifetimes.attached.call(instance)
      return instance
    }
    const parent = createInstance(parentOptions)
    const slotHost = createInstance(slotHostOptions, parent)
    const child = createInstance(childOptions, slotHost)

    await nextTick()
    expect(earlyWatchCalls).toEqual([])
    expect(updateOffsetFromChild).not.toHaveBeenCalled()

    childOptions.lifetimes.ready.call(child)
    await nextTick()
    parent.__wevu.proxy.innerScrollTop = 12
    await nextTick()

    expect(earlyWatchCalls).toEqual([])
    expect(updateOffsetFromChild).toHaveBeenCalledWith(12)
  })

  it('inherits globalProperties from the root runtime app', () => {
    const rootApp = createApp({})
    const $u = { zIndex: { popup: 10075 } }
    rootApp.config.globalProperties.$u = $u
    ;(globalThis as any).getApp = () => ({
      [WEVU_RUNTIME_APP_KEY]: rootApp,
    })

    defineComponent({})
    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(inst.__wevu.proxy.$u).toBe($u)
    expect('$u' in inst.__wevu.proxy).toBe(true)
  })

  it('exposes the owner component through $parent and $options', () => {
    defineComponent({ name: 'u-grid' } as any)
    defineComponent({ name: 'u-grid-item' } as any)

    const parentOptions = registeredComponents[0]
    const childOptions = registeredComponents[1]
    const parent: any = {
      name: 'weapp_vite_external/uview-plus/components/u-grid/u-grid',
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    parentOptions.lifetimes.created.call(parent)
    parentOptions.lifetimes.attached.call(parent)

    const child: any = {
      selectOwnerComponent: () => parent,
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    childOptions.lifetimes.created.call(child)
    childOptions.lifetimes.attached.call(child)

    expect(child.__wevu.proxy.$parent).toBe(parent.__wevu.proxy)
    expect(child.__wevu.proxy.$parent.$options.name).toBe('u-grid')
    expect(child.__wevu.proxy.$options.name).toBe('u-grid-item')
  })

  it('rebuilds isolated owner wrappers while resolving the Options API parent chain', () => {
    defineComponent({
      name: 'u-index-list',
      created() {
        this.children = []
      },
      mounted() {},
    } as any)
    defineComponent({
      name: 'scoped-slots-default',
      mounted() {},
    } as any)
    defineComponent({
      name: 'u-index-item',
      mounted() {
        let parent = this.$parent
        while (parent && parent.$options?.name !== 'u-index-list') {
          parent = parent.$parent
        }
        parent.children.push(this)
      },
    } as any)

    const [parentOptions, slotOwnerOptions, childOptions] = registeredComponents
    const createAttachedInstance = (options: Record<string, any>, owner?: Record<string, any>) => {
      const instance: any = {
        data: typeof options.data === 'function' ? options.data() : structuredClone(options.data ?? {}),
        properties: {},
        selectOwnerComponent: () => owner,
        setData() {},
        triggerEvent: vi.fn(),
      }
      options.lifetimes.created.call(instance)
      options.lifetimes.attached.call(instance)
      return instance
    }
    const parent = createAttachedInstance(parentOptions)
    const slotOwner = createAttachedInstance(slotOwnerOptions, parent)
    const child = createAttachedInstance(childOptions, slotOwner)
    const createReadyWrapper = (options: Record<string, any>, source: Record<string, any>, owner?: Record<string, any>): Record<string, any> => ({
      [WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD]: options.methods[WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD],
      __wevuRuntimeOwnerId: source.__wevuRuntimeOwnerId,
      data: structuredClone(source.data ?? {}),
      properties: {},
      selectOwnerComponent: () => owner,
      setData() {},
      triggerEvent: vi.fn(),
    })
    const parentReady = createReadyWrapper(parentOptions, parent)
    const slotOwnerReady = createReadyWrapper(slotOwnerOptions, slotOwner, parentReady)
    const childReady = createReadyWrapper(childOptions, child, slotOwnerReady)
    ;(globalThis as any)[WEVU_SCOPED_SLOT_OWNER_STORE_KEY] = new Map()

    childOptions.lifetimes.ready.call(childReady)

    expect(childReady.__wevu.proxy.$parent).toBe(slotOwnerReady.__wevu.proxy)
    expect(childReady.__wevu.proxy.$parent.$parent).toBe(parentReady.__wevu.proxy)
    expect(parentReady.__wevu.proxy.children).toEqual([childReady.__wevu.proxy])
  })

  it('keeps undeclared Options API instance fields out of reactive snapshots', async () => {
    defineComponent({
      data() {
        return { count: 0 }
      },
      created(this: any) {
        this.children = []
      },
      methods: {
        registerChild(this: any, child: unknown) {
          this.children.push(child)
        },
      },
    } as any)
    defineComponent({
      methods: {
        updateFromParent() {
          return 'updated'
        },
      },
    } as any)

    const parentOptions = registeredComponents[0]
    const childOptions = registeredComponents[1]
    const parentSetData = vi.fn()
    const parent: any = {
      setData: parentSetData,
      triggerEvent: vi.fn(),
      properties: {},
    }
    Object.defineProperty(parent, 'children', {
      configurable: true,
      get: () => ({ 0: 'native-child', length: 1 }),
    })
    parentOptions.lifetimes.created.call(parent)
    parentOptions.lifetimes.attached.call(parent)

    const child: any = {
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: {},
    }
    childOptions.lifetimes.created.call(child)
    childOptions.lifetimes.attached.call(child)

    const parentProxy = parent.__wevu.proxy
    const childProxy = child.__wevu.proxy
    parentSetData.mockClear()
    parentProxy.registerChild(childProxy)
    await parentProxy.$nextTick()

    expect(parentProxy.children).toEqual([childProxy])
    expect(parentProxy.children[0].updateFromParent()).toBe('updated')
    expect(parent.__wevu.state).not.toHaveProperty('children')
    expect(parent.__wevu.snapshot()).not.toHaveProperty('children')
    expect(parentSetData).not.toHaveBeenCalled()
  })

  it('runs created before the initial computed snapshot', () => {
    const setData = vi.fn()
    defineComponent({
      data() {
        return { parent: undefined as undefined | { children: unknown[] } }
      },
      computed: {
        childCount(this: any): number {
          return this.parent.children.length
        },
      },
      created() {
        this.parent = { children: ['ready'] }
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      setData,
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)

    expect(() => opts.lifetimes.attached.call(inst)).not.toThrow()
    expect(inst.__wevu.proxy.childCount).toBe(1)
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ childCount: 1 }), expect.any(Function))
  })

  it('exposes initial native props before the first computed snapshot', () => {
    defineComponent({
      props: {
        name: { type: String, default: '' },
      },
      computed: {
        isImage(this: any): boolean {
          // eslint-disable-next-line e18e/prefer-includes, unicorn/prefer-includes
          return this.name.indexOf('/') !== -1
        },
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: { name: '/icon.png' },
    }

    expect(() => opts.lifetimes.created.call(inst)).not.toThrow()
    expect(() => opts.lifetimes.attached.call(inst)).not.toThrow()
    expect(inst.__wevu.proxy.isImage).toBe(true)
  })

  it('exposes normalized prop defaults while creating native initial data', () => {
    createWevuComponent({
      props: {
        src: { type: String, default: '/fallback.png' },
      },
      methods: {
        resolveSource(src: string) {
          return `resolved:${src}`
        },
      },
      data() {
        return { avatarUrl: this.resolveSource(this.src) }
      },
    })

    expect(registeredComponents[0].data).toMatchObject({
      avatarUrl: 'resolved:/fallback.png',
    })
  })

  it('merges recursive Options API mixins before component registration', () => {
    const lifecycleCalls: string[] = []
    createWevuComponent({
      mixins: [{
        props: {
          duration: { type: Number, default: 300 },
        },
        data(this: any): { inheritedValue: string, overridden: string } {
          return { inheritedValue: this.formatDuration(this.duration), overridden: 'mixin' }
        },
        computed: {
          inheritedLabel(this: any): string {
            return this.formatDuration(this.duration)
          },
        },
        methods: {
          formatDuration(value: number) {
            return `${value}ms`
          },
        },
        created() {
          lifecycleCalls.push('mixin')
        },
      }],
      data() {
        return { overridden: 'component' }
      },
      created() {
        lifecycleCalls.push('component')
      },
      mounted() {
        lifecycleCalls.push('mounted')
      },
      beforeUnmount() {
        lifecycleCalls.push('beforeUnmount')
      },
      unmounted() {
        lifecycleCalls.push('unmounted')
      },
    } as any)

    const opts = registeredComponents[0]
    expect(opts.properties.duration.value).toBe(300)
    expect(opts.data).toMatchObject({
      inheritedValue: '300ms',
      overridden: 'component',
    })

    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: { duration: 300 },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    expect(lifecycleCalls).toEqual(['mixin', 'component'])
    opts.lifetimes.ready.call(inst)
    expect(lifecycleCalls).toEqual(['mixin', 'component', 'mounted'])
    opts.lifetimes.detached.call(inst)
    expect(lifecycleCalls).toEqual(['mixin', 'component', 'mounted', 'beforeUnmount', 'unmounted'])
  })

  it('runs mounted when a component mixin also declares onReady', () => {
    const lifecycleCalls: string[] = []
    defineComponent({
      mixins: [{
        onReady() {
          lifecycleCalls.push('onReady')
        },
      }],
      mounted() {
        lifecycleCalls.push('mounted')
      },
    } as any)

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.ready.call(inst)
    opts.lifetimes.ready.call(inst)

    expect(lifecycleCalls).toEqual(['onReady', 'mounted', 'onReady'])
  })

  it('keeps nested runtime data isolated from the native snapshot until setData flushes', async () => {
    defineComponent({
      data() {
        return { parentData: { col: 0, border: true } }
      },
    } as any)

    const opts = registeredComponents[0]
    const setDataPayloads: Record<string, any>[] = []
    const setData = vi.fn(function setData(this: any, payload: Record<string, any>) {
      const snapshot = structuredClone(payload)
      setDataPayloads.push(snapshot)
      Object.assign(this.data, snapshot)
    })
    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : { ...opts.data },
      setData,
      triggerEvent: vi.fn(),
      properties: {},
    }

    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    const nativeParentData = inst.data.parentData
    const callsBeforeMutation = setDataPayloads.length

    expect(toRaw(inst.__wevu.state.parentData)).not.toBe(nativeParentData)
    inst.__wevu.proxy.parentData.col = 1
    expect(nativeParentData.col).toBe(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(setDataPayloads.slice(callsBeforeMutation).some(payload => (
      payload.parentData?.col === 1 || payload['parentData.col'] === 1
    ))).toBe(true)
  })

  it('keeps explicitly marked components out of page lifecycle registration', async () => {
    const lifecycleCalls: string[] = []
    defineComponent({
      __wevu_isPage: false,
      data() {
        return { parentData: { col: 0 } }
      },
      mixins: [{
        onLoad() {
          lifecycleCalls.push('onLoad')
        },
        onReady() {
          lifecycleCalls.push('onReady')
        },
      }],
      mounted() {
        this.parentData.col = 1
        lifecycleCalls.push('mounted')
      },
    } as any)

    const opts = registeredComponents[0]
    const setDataPayloads: Record<string, any>[] = []
    const setData = vi.fn(function setData(this: any, payload: Record<string, any>) {
      const snapshot = structuredClone(payload)
      setDataPayloads.push(snapshot)
      Object.assign(this.data, snapshot)
    })
    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : { ...opts.data },
      setData,
      triggerEvent: vi.fn(),
      properties: {},
    }

    expect(opts.onLoad).toBeUndefined()
    expect(opts.onReady).toBeUndefined()
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    const callsBeforeReady = setDataPayloads.length
    opts.lifetimes.ready.call(inst)
    await Promise.resolve()
    await Promise.resolve()

    expect(lifecycleCalls).toEqual(['mounted'])
    expect(setDataPayloads.slice(callsBeforeReady).some(payload => (
      payload.parentData?.col === 1 || payload['parentData.col'] === 1
    ))).toBe(true)
  })

  it('flushes nested data written through mixed-in parent lookup methods during mounted', async () => {
    defineComponent({
      __wevu_isPage: false,
      name: 'u-grid',
      props: {
        col: { type: Number, default: 1 },
        border: { type: Boolean, default: false },
      },
      created() {
        this.children = []
      },
    } as any)
    defineComponent({
      __wevu_isPage: false,
      name: 'scoped-slots-default',
    } as any)
    defineComponent({
      __wevu_isPage: false,
      name: 'u-grid-item',
      mixins: [{
        methods: {
          getParentData(this: any, parentName: string) {
            let parent = this.$parent
            while (parent && parent.$options?.name !== parentName) {
              parent = parent.$parent
            }
            this.parent = parent
            if (parent?.children && !parent.children.includes(this)) {
              parent.children.push(this)
            }
            for (const key of Object.keys(this.parentData)) {
              this.parentData[key] = parent?.[key]
            }
          },
        },
      }],
      data() {
        return { parentData: { col: 0, border: true } }
      },
      computed: {
        itemStyle() {
          return { width: '100%' }
        },
        __wv_style_0(this: any) {
          return normalizeStyle([
            [resolvePropValue(this, 'itemStyle', this.itemStyle)],
            resolvePropValue(this, 'parentData', this.parentData).col > 0 ? '' : 'display: none',
          ])
        },
      },
      methods: {
        init(this: any) {
          this.updateParentData()
        },
        updateParentData(this: any) {
          this.getParentData('u-grid')
        },
      },
      mounted() {
        this.init()
      },
    } as any)

    const parentOptions = registeredComponents[0]
    const slotOwnerOptions = registeredComponents[1]
    const childOptions = registeredComponents[2]
    const parent: any = {
      data: typeof parentOptions.data === 'function' ? parentOptions.data() : structuredClone(parentOptions.data),
      properties: { col: 1, border: false },
      selectOwnerComponent: () => undefined,
      setData() {},
      triggerEvent: vi.fn(),
    }
    parentOptions.lifetimes.created.call(parent)
    parentOptions.lifetimes.attached.call(parent)

    const slotOwner: any = {
      data: typeof slotOwnerOptions.data === 'function' ? slotOwnerOptions.data() : structuredClone(slotOwnerOptions.data),
      properties: {},
      selectOwnerComponent: () => parent,
      setData() {},
      triggerEvent: vi.fn(),
    }
    slotOwnerOptions.lifetimes.created.call(slotOwner)
    slotOwnerOptions.lifetimes.attached.call(slotOwner)
    const setDataPayloads: Record<string, any>[] = []
    const child: any = {
      data: typeof childOptions.data === 'function' ? childOptions.data() : structuredClone(childOptions.data),
      // DevTools 可能把同名 data 字段暴露在 properties wrapper 上；未声明字段不能污染 props。
      properties: { parentData: { col: 1, border: false } },
      selectOwnerComponent: () => slotOwner,
      setData(payload: Record<string, any>) {
        setDataPayloads.push(structuredClone(payload))
        Object.assign(this.data, structuredClone(payload))
      },
      triggerEvent: vi.fn(),
    }
    childOptions.lifetimes.created.call(child)
    childOptions.lifetimes.attached.call(child)
    expect(child.__wevu.proxy.props).not.toHaveProperty('parentData')
    expect(child.__wevu.proxy.parentData).toEqual({ col: 0, border: true })
    expect(child.__wevu.computed.__wv_style_0).toBe('width:100%;display: none')
    const callsBeforeReady = setDataPayloads.length
    childOptions.lifetimes.ready.call(child)
    await Promise.resolve()
    await Promise.resolve()

    expect(child.__wevu.proxy.parentData).toEqual({ col: 1, border: false })
    expect(child.__wevu.computed.__wv_style_0).toBe('width:100%')
    expect(parent.__wevu.proxy.children).toContain(child.__wevu.proxy)
    expect(setDataPayloads.slice(callsBeforeReady).some(payload => (
      payload.parentData?.col === 1 || payload['parentData.col'] === 1
    ))).toBe(true)
    expect(setDataPayloads.slice(callsBeforeReady).some(payload => (
      payload.__wv_style_0 === 'width:100%'
    ))).toBe(true)
  })

  it('keeps declared props ahead of same-name native component fields', () => {
    let internal: any
    defineComponent({
      name: 'wd-tab',
      props: {
        name: { type: String },
      },
      setup() {
        internal = getCurrentInstance()
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      name: 'wd-tab',
      setData() {},
      triggerEvent: vi.fn(),
      properties: {
        name: 'first',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(internal.proxy.name).toBe('first')
  })

  it('mergeModels merges arrays and objects', () => {
    expect(mergeModels([1, 2], [2, 3])).toEqual([1, 2, 3])
    expect(mergeModels({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
    expect(mergeModels(null as any, { a: 1 })).toEqual({ a: 1 })
  })

  it('useAttrs/useSlots/useModel/useNativeInstance/useIntersectionObserver/useNativeRouter/useNativePageRouter/usePageScrollThrottle/useUpdatePerformanceListener/useDisposables throw when called outside setup', () => {
    expect(() => useAttrs()).toThrow()
    expect(() => useSlots()).toThrow()
    expect(() => useModel({}, 'modelValue')).toThrow()
    expect(() => useNativeInstance()).toThrow()
    expect(() => useIntersectionObserver()).toThrow()
    expect(() => useNativeRouter()).toThrow()
    expect(() => useNativePageRouter()).toThrow()
    expect(() => usePageScrollThrottle(() => {})).toThrow()
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

    expect(triggerEvent).toHaveBeenCalledWith('update-modelvalue', 'next', undefined)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs).toMatchObject({ extra: 'alpha' })
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs?.modelValue).toBeUndefined()
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots).toEqual({})
    expect(Object.getPrototypeOf(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots)).toBeNull()
    expect(Object.isFrozen(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots)).toBe(true)

    inst.properties.extra = 'beta'
    opts.observers['**'].call(inst)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs).toMatchObject({ extra: 'beta' })
  })

  it('useSlots reads compiled slot metadata in components without user props', () => {
    createWevuComponent({
      properties: {
        [WEVU_SLOT_NAMES_PROP]: { type: null, value: null },
      },
      setup() {
        const slots = useSlots()
        return { slots }
      },
    } as any)

    const opts = registeredComponents[0]
    expect(opts.properties[WEVU_SLOT_NAMES_PROP]).toBeTruthy()

    const inst: any = {
      setData() {},
      triggerEvent: vi.fn(),
      properties: {
        [WEVU_SLOT_NAMES_PROP]: { default: true, header: true },
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(Object.keys(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots)).toEqual(['default', 'header'])
    expect(typeof inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots.default).toBe('function')
    expect('header' in inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.slots).toBe(true)
  })

  it('useAttrs filters compiler internal template binding keys', () => {
    defineComponent({
      setup() {
        const attrs = useAttrs()
        return { attrs }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {
        __wv_cls_0: 'internal-class',
        __wv_style_0: 'color: red',
        extra: 'alpha',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs).toMatchObject({ extra: 'alpha' })
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs.__wv_cls_0).toBeUndefined()
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs.__wv_style_0).toBeUndefined()

    inst.properties.extra = 'beta'
    inst.properties.__wv_cls_1 = 'next-internal-class'
    opts.observers['**'].call(inst)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs).toMatchObject({ extra: 'beta' })
    expect(Object.keys(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.attrs)).toEqual(['extra'])
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

    expect(triggerEvent).toHaveBeenCalledWith('update-modelvalue', 'next value', undefined)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.modifiers?.trim).toBe(true)
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

    const model = inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.enabledModel
    model.onChange({ detail: { value: true } })

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.enabled).toBe(true)
  })

  it('useChangeModel creates value+change binding payloads', () => {
    defineComponent({
      data: () => ({ title: '' }),
      setup() {
        const changeModel = useChangeModel()
        const titleModel = changeModel<string>('title')
        return { titleModel }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData() {}, properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const model = inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.titleModel
    expect(model.value).toBe('')
    model.onChange({ detail: { value: 'next title' } })

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY]?.state?.title).toBe('next title')
  })

  it('ctx.emit supports Vue style variadic args and normalizes triggerEvent payload', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      setup(_props, ctx) {
        ctx.emit('single', 1)
        ctx.emit('single-with-options', 1, { bubbles: true })
        ctx.emit('update:abc', 'abc')
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
    expect(triggerEvent).toHaveBeenNthCalledWith(3, 'update-abc', 'abc', undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(4, 'multi', [1, 2], undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(5, 'multi-with-options', [1, 2], { composed: true })
  })

  it('normalizes camelCase emit names to kebab-case listener names', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      setup(_props, ctx) {
        ctx.emit('quantityChange', { quantity: 2 })
        ctx.emit('quantity-change', { quantity: 3 })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst = {
      setData() {},
      triggerEvent,
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'quantity-change', { quantity: 2 }, undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'quantity-change', { quantity: 3 }, undefined)
    expect(triggerEvent).toHaveBeenCalledTimes(2)
  })

  it('exposes Vue style $emit through Options API methods', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      methods: {
        notify(this: any) {
          this.$emit('update:value', 1, 2)
          this.$emit('quantityChange', { quantity: 3 })
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
    opts.methods.notify.call(inst)

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'update-value', [1, 2], undefined)
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'quantity-change', { quantity: 3 }, undefined)
  })

  it('useModel emits through the native invocation instance for setup returned methods', () => {
    const triggerEvent = vi.fn()
    defineComponent({
      props: {
        abc: { type: String },
      } as any,
      setup(props) {
        const abcModel = useModel<string>(props as any, 'abc')
        function updateAbc() {
          abcModel.value = 'abc-from-child'
        }
        return {
          updateAbc,
        }
      },
    })

    const opts = registeredComponents[0]
    const mountedInst: any = {
      setData() {},
      properties: {
        abc: 'abc-seed',
      },
    }

    opts.lifetimes.created.call(mountedInst)
    opts.lifetimes.attached.call(mountedInst)

    const callInst: any = {
      ...mountedInst,
      triggerEvent,
    }

    mountedInst.updateAbc.call(callInst)

    expect(triggerEvent).toHaveBeenCalledWith('update-abc', 'abc-from-child', undefined)
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

  it('useNativeRouter/useNativePageRouter prefer native router and pageRouter', () => {
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
        const router = useNativeRouter()
        const hostPageRouter = useNativePageRouter()
        router.navigateTo({ url: './from-component' })
        hostPageRouter.navigateTo({ url: './from-page' })
        return {}
      },
    })

    const opts = registeredComponents[0]
    const inst: any = {
      setData() {},
      properties: {},
      is: 'components/demo-card/index',
      route: 'pages/demo/index',
      router: componentRouter,
      pageRouter,
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expectRouteOption(componentRouter.navigateTo.mock.calls[0], '/components/demo-card/from-component')
    expectRouteOption(pageRouter.navigateTo.mock.calls[0], '/pages/demo/from-page')
  })

  it('useNativeRouter/useNativePageRouter fallback to global route methods when instance router is unavailable', () => {
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
        const router = useNativeRouter()
        const pageRouter = useNativePageRouter()
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

    expectRouteOption(wxNavigateTo.mock.calls[0], '/pages/a/index')
    expectRouteOption(wxRedirectTo.mock.calls[0], '/pages/b/index')
  })

  it('useNativeRouter/useNativePageRouter fallback to complementary instance accessor before global fallback', () => {
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
        const router = useNativeRouter()
        const pageRouter = useNativePageRouter()
        router.navigateTo({ url: './from-component-fallback' })
        pageRouter.navigateTo({ url: './from-page-fallback' })
        return {}
      },
    })

    defineComponent({
      setup() {
        const router = useNativeRouter()
        const pageRouter = useNativePageRouter()
        router.navigateTo({ url: './from-component-only' })
        pageRouter.navigateTo({ url: './from-page-only' })
        return {}
      },
    })

    const pageRouterOnlyOptions = registeredComponents[0]
    const componentRouterOnlyOptions = registeredComponents[1]
    const pageRouterOnlyInstance: any = {
      setData() {},
      properties: {},
      is: 'components/fallback-card/index',
      route: 'pages/fallback/index',
      pageRouter: pageRouterOnly,
    }
    const componentRouterOnlyInstance: any = {
      setData() {},
      properties: {},
      is: 'components/router-only/index',
      route: 'pages/router-only/index',
      router: componentRouterOnly,
    }

    pageRouterOnlyOptions.lifetimes.created.call(pageRouterOnlyInstance)
    pageRouterOnlyOptions.lifetimes.attached.call(pageRouterOnlyInstance)
    componentRouterOnlyOptions.lifetimes.created.call(componentRouterOnlyInstance)
    componentRouterOnlyOptions.lifetimes.attached.call(componentRouterOnlyInstance)

    expect(pageRouterOnly.navigateTo).toHaveBeenCalledTimes(2)
    expectRouteOption(pageRouterOnly.navigateTo.mock.calls[0], '/components/fallback-card/from-component-fallback')
    expectRouteOption(pageRouterOnly.navigateTo.mock.calls[1], '/pages/fallback/from-page-fallback')
    expect(componentRouterOnly.navigateTo).toHaveBeenCalledTimes(2)
    expectRouteOption(componentRouterOnly.navigateTo.mock.calls[0], '/components/router-only/from-component-only')
    expectRouteOption(componentRouterOnly.navigateTo.mock.calls[1], '/pages/router-only/from-page-only')
  })

  it('useNativeRouter/useNativePageRouter fallback to my route methods when wx is unavailable', () => {
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
        const router = useNativeRouter()
        const pageRouter = useNativePageRouter()
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

    expectRouteOption(myGlobal.navigateTo.mock.calls[0], '/pages/fallback-my/index')
    expect(myGlobal.navigateBack).toHaveBeenCalledWith({ delta: 1 })
    expect(myContexts).toHaveLength(2)
    expect(myContexts.every(context => context === myGlobal)).toBe(true)
  })

  it('useNativeRouter/useNativePageRouter fallback to tt route methods when wx/my are unavailable', () => {
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
        const router = useNativeRouter()
        const pageRouter = useNativePageRouter()
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

    expectRouteOption(ttGlobal.reLaunch.mock.calls[0], '/pages/fallback-tt/index')
    expectRouteOption(ttGlobal.redirectTo.mock.calls[0], '/pages/fallback-tt/detail')
    expect(ttContexts).toHaveLength(2)
    expect(ttContexts.every(context => context === ttGlobal)).toBe(true)
  })

  it('useNativeRouter/useNativePageRouter throw when runtime global route methods are incomplete', () => {
    ;(globalThis as any).wx = {
      switchTab: vi.fn(),
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      navigateTo: vi.fn(),
      // navigateBack 缺失，视为不支持完整 Router 能力
    }

    defineComponent({
      setup() {
        expect(() => useNativeRouter()).toThrow('当前运行环境不支持 Router')
        expect(() => useNativePageRouter()).toThrow('当前运行环境不支持 Router')
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

  it('useNativeRouter/useNativePageRouter throw when Router and fallback route methods are both unavailable', () => {
    defineComponent({
      setup() {
        expect(() => useNativeRouter()).toThrow('当前运行环境不支持 Router')
        expect(() => useNativePageRouter()).toThrow('当前运行环境不支持 Router')
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

  it('usePageScrollThrottle throttles page scroll callbacks and clears pending timer on detach', () => {
    vi.useFakeTimers()
    const calls: number[] = []

    try {
      defineComponent({
        features: {
          enableOnPageScroll: true,
        },
        setup() {
          usePageScrollThrottle((opt) => {
            calls.push(Number(opt?.scrollTop ?? -1))
          }, { interval: 100 })
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

      opts.onPageScroll.call(inst, { scrollTop: 1 })
      opts.onPageScroll.call(inst, { scrollTop: 2 })
      expect(calls).toEqual([1])

      vi.advanceTimersByTime(100)
      expect(calls).toEqual([1, 2])

      opts.onPageScroll.call(inst, { scrollTop: 3 })
      opts.lifetimes.detached.call(inst)
      vi.advanceTimersByTime(200)
      expect(calls).toEqual([1, 2])
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('usePageScrollThrottle honors maxWait when trailing is disabled', () => {
    vi.useFakeTimers()
    const calls: number[] = []

    try {
      defineComponent({
        features: {
          enableOnPageScroll: true,
        },
        setup() {
          usePageScrollThrottle((opt) => {
            calls.push(Number(opt?.scrollTop ?? -1))
          }, {
            interval: 200,
            leading: false,
            trailing: false,
            maxWait: 120,
          })
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

      opts.onPageScroll.call(inst, { scrollTop: 1 })
      vi.advanceTimersByTime(40)
      opts.onPageScroll.call(inst, { scrollTop: 2 })
      vi.advanceTimersByTime(40)
      opts.onPageScroll.call(inst, { scrollTop: 3 })
      vi.advanceTimersByTime(40)

      expect(calls).toEqual([3])
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('usePageScrollThrottle maxWait can force callback earlier than interval trailing window', () => {
    vi.useFakeTimers()
    const calls: number[] = []

    try {
      defineComponent({
        features: {
          enableOnPageScroll: true,
        },
        setup() {
          usePageScrollThrottle((opt) => {
            calls.push(Number(opt?.scrollTop ?? -1))
          }, {
            interval: 300,
            leading: false,
            trailing: true,
            maxWait: 120,
          })
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

      opts.onPageScroll.call(inst, { scrollTop: 1 })
      vi.advanceTimersByTime(60)
      opts.onPageScroll.call(inst, { scrollTop: 2 })
      vi.advanceTimersByTime(60)

      expect(calls).toEqual([2])
    }
    finally {
      vi.useRealTimers()
    }
  })
})
