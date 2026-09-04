import { WEVU_HOOKS_KEY, WEVU_NATIVE_INSTANCE_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, parseQuery, resolveRouteLocation, stringifyQuery, useRoute, useRouter } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { installRouteStateSyncOnNativeRouter, notifyRouteStateSync } from '@/router/routeSync'
import { createRouteStateController } from '@/router/useRoute'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { bindCurrentPageInstance } from '@/runtime/register/component/lifecycle/platform'
import { ensureSetupContextInstance } from '@/runtime/register/runtimeInstance/setupContext'

describe('router api', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
    clearActiveRouter()
    bindCurrentPageInstance(undefined as any)
    delete (globalThis as any).getCurrentPages
  })

  it('parseQuery parses repeated keys, empty value, and flags', () => {
    expect(parseQuery('?name=alice&name=bob&flag&empty=&space=hello%20world')).toEqual({
      name: ['alice', 'bob'],
      flag: null,
      empty: '',
      space: 'hello world',
    })
  })

  it('stringifyQuery serializes null, arrays, and skips undefined', () => {
    expect(stringifyQuery({
      name: ['alice', null, 'bob'],
      flag: null,
      empty: '',
      active: true,
      count: 1,
      skip: undefined,
    })).toBe('name=alice&name&name=bob&flag&empty=&active=true&count=1')
  })

  it('resolveRouteLocation normalizes relative and absolute paths', () => {
    expect(resolveRouteLocation('./detail?scene=1', 'pages/home/index')).toEqual({
      path: 'pages/home/detail',
      fullPath: '/pages/home/detail?scene=1',
      query: { scene: '1' },
      hash: '',
      params: {},
    })

    expect(resolveRouteLocation('../list', 'pages/home/index')).toEqual({
      path: 'pages/list',
      fullPath: '/pages/list',
      query: {},
      hash: '',
      params: {},
    })

    expect(resolveRouteLocation({
      path: '/pages/tab/index',
      query: {
        from: 'demo',
        keep: null,
        skip: undefined,
      },
    })).toEqual({
      path: 'pages/tab/index',
      fullPath: '/pages/tab/index?from=demo&keep',
      query: {
        from: 'demo',
        keep: null,
      },
      hash: '',
      params: {},
    })

    expect(resolveRouteLocation({
      fullPath: '/pages/post/index?from=home#comment',
      name: 'post-detail',
      params: {
        id: 1,
        tags: ['a', true],
        skip: undefined,
      },
    })).toEqual({
      path: 'pages/post/index',
      fullPath: '/pages/post/index?from=home#comment',
      query: {
        from: 'home',
      },
      hash: '#comment',
      name: 'post-detail',
      params: {
        id: '1',
        tags: ['a', 'true'],
      },
    })
  })

  it('useRoute requires setup context', () => {
    setCurrentInstance({ __wevu: {}, [WEVU_HOOKS_KEY]: {} } as any)
    setCurrentSetupContext(undefined)
    expect(() => useRoute()).toThrow('useRoute() 必须在 setup() 的同步阶段调用')
  })

  it('useRouter requires an existing router instance when called without options', () => {
    const instance = { __wevu: {}, [WEVU_HOOKS_KEY]: {} } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    expect(() => useRouter()).toThrow('useRouter() 未找到已创建的 router 实例')
  })

  it('createRouter registers the active router instance for useRouter()', () => {
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack: vi.fn(),
      },
    } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {},
      },
    ])

    const createdRouter = createRouter()

    expect(useRouter()).toBe(createdRouter)
  })

  it('createRouter install registers router on app globalProperties', () => {
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack: vi.fn(),
      },
    } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {},
      },
    ])

    const createdRouter = createRouter()
    const app = { config: { globalProperties: {} as Record<string, unknown> } }

    createdRouter.install(app)

    expect(app.config.globalProperties.$router).toBe(createdRouter)
  })

  it('useRoute syncs with onLoad, onReady, onShow, and onRouteDone hooks', () => {
    const instance = { __wevu: {}, [WEVU_HOOKS_KEY]: {} } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    let pages = [
      {
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)

    const route = useRoute()
    expect(route).toEqual({
      path: 'pages/home/index',
      fullPath: '/pages/home/index?tab=all',
      query: {
        tab: 'all',
      },
      hash: '',
      params: {},
      name: undefined,
    })

    callHookList(instance, 'onLoad', [{ tab: 'new', scene: 1 }])
    expect(route.fullPath).toBe('/pages/home/index?tab=new&scene=1')
    expect(route.query).toEqual({
      tab: 'new',
      scene: '1',
    })

    pages = [
      {
        route: 'pages/ready/index',
        options: {
          from: 'ready',
        },
      } as any,
    ]

    callHookList(instance, 'onReady')
    expect(route.fullPath).toBe('/pages/ready/index?from=ready')
    expect(route.query).toEqual({
      from: 'ready',
    })

    pages = [
      {
        route: 'pages/profile/index',
        options: {
          from: 'mine',
        },
      } as any,
    ]

    callHookList(instance, 'onShow')
    expect(route).toEqual({
      path: 'pages/profile/index',
      fullPath: '/pages/profile/index?from=mine',
      query: {
        from: 'mine',
      },
      hash: '',
      params: {},
      name: undefined,
    })

    pages = [
      {
        route: 'pages/profile/index',
        options: {
          from: 'activity',
        },
      } as any,
    ]

    callHookList(instance, 'onRouteDone')
    expect(route.fullPath).toBe('/pages/profile/index?from=activity')
    expect(route.query).toEqual({
      from: 'activity',
    })
  })

  it('limits page route sync broadcasts to the activated page controller', () => {
    const page1 = {
      route: 'pages/home/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    const page2 = {
      route: 'pages/detail/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    ;(globalThis as any).getCurrentPages = vi.fn(() => [page1, page2])

    const syncCalls: string[] = []
    setCurrentInstance(page1)
    setCurrentSetupContext({ instance: page1, emit: vi.fn(), attrs: {}, slots: {} })
    createRouteStateController({
      beforeRouteStateSync: () => syncCalls.push('page1'),
    })

    setCurrentInstance(page2)
    setCurrentSetupContext({ instance: page2, emit: vi.fn(), attrs: {}, slots: {} })
    createRouteStateController({
      beforeRouteStateSync: () => syncCalls.push('page2'),
    })

    notifyRouteStateSync({
      page: page2,
      source: 'page',
    })

    expect(syncCalls).toEqual(['page2'])
    callHookList(page1, 'onUnload', [])
    callHookList(page2, 'onUnload', [])
  })

  it('matches setup instance bridges to their activated native page', () => {
    const page1 = {
      route: 'pages/home/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    const page2 = {
      route: 'pages/detail/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    const runtimeState1 = { [WEVU_NATIVE_INSTANCE_KEY]: page1 }
    const runtimeState2 = { [WEVU_NATIVE_INSTANCE_KEY]: page2 }
    const bridge1 = ensureSetupContextInstance(page1, {
      state: runtimeState1,
      proxy: Object.create(null),
    } as any)
    const bridge2 = ensureSetupContextInstance(page2, {
      state: runtimeState2,
      proxy: Object.create(null),
    } as any)
    let pages = [page1, page2]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)

    const syncCalls: string[] = []
    setCurrentInstance(page1)
    setCurrentSetupContext({ instance: bridge1, emit: vi.fn(), attrs: {}, slots: {} })
    createRouteStateController({
      beforeRouteStateSync: () => syncCalls.push('page1'),
    })

    setCurrentInstance(page2)
    setCurrentSetupContext({ instance: bridge2, emit: vi.fn(), attrs: {}, slots: {} })
    const { route } = createRouteStateController({
      beforeRouteStateSync: () => syncCalls.push('page2'),
    })

    const nativePage1 = { route: page1.route, options: {} } as any
    const nativePage2 = { route: page2.route, options: {} } as any
    runtimeState1[WEVU_NATIVE_INSTANCE_KEY] = nativePage1
    runtimeState2[WEVU_NATIVE_INSTANCE_KEY] = nativePage2
    pages = [nativePage1, nativePage2]

    notifyRouteStateSync({
      source: 'native',
      method: 'switchTab',
      url: '/pages/issue-705-tab/index',
    })

    expect(syncCalls).toEqual(['page2'])
    expect(route.path).toBe('pages/issue-705-tab/index')
    callHookList(page1, 'onUnload', [])
    callHookList(page2, 'onUnload', [])
  })

  it('syncs the source page controller after native navigation commits the target stack', () => {
    const sourcePage = {
      route: 'pages/home/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    const targetPage = {
      route: 'pages/profile/index',
      options: {},
    } as any
    let pages = [sourcePage]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)
    const nativeRouter = {
      switchTab: vi.fn((option: any) => {
        pages = [targetPage]
        option.success?.({})
      }),
    }

    setCurrentInstance(sourcePage)
    setCurrentSetupContext({ instance: sourcePage, emit: vi.fn(), attrs: {}, slots: {} })
    const { route } = createRouteStateController()
    installRouteStateSyncOnNativeRouter(nativeRouter)

    nativeRouter.switchTab({ url: '/pages/profile/index' })

    expect(route.path).toBe('pages/profile/index')
    callHookList(sourcePage, 'onUnload', [])
  })

  it('restores the activated page controller after native back commits the target stack', () => {
    const targetPage = {
      route: 'pages/home/index',
      options: {},
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
    } as any
    const sourcePage = {
      route: 'pages/detail/index',
      options: {},
    } as any
    let pages = [targetPage]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)
    const nativeRouter = {
      navigateBack: vi.fn((option: any) => {
        pages = [targetPage]
        option.success?.({})
      }),
    }

    setCurrentInstance(targetPage)
    setCurrentSetupContext({ instance: targetPage, emit: vi.fn(), attrs: {}, slots: {} })
    const { route } = createRouteStateController()
    installRouteStateSyncOnNativeRouter(nativeRouter)
    pages = [targetPage, sourcePage]
    notifyRouteStateSync({
      route: resolveRouteLocation('/pages/detail/index'),
      source: 'router',
    })

    nativeRouter.navigateBack({})

    expect(route.path).toBe('pages/home/index')
    callHookList(targetPage, 'onUnload', [])
  })

  it('useRoute infers name from an existing named router instance', () => {
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack: vi.fn(),
      },
    } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    let pages = [
      {
        route: 'pages/issue-550/index',
        options: {
          from: 'setup',
        },
      },
    ]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)

    createRouter({
      routes: [
        {
          name: 'issue-550',
          path: '/pages/issue-550/index',
        },
        {
          name: 'issue-550-detail',
          path: '/pages/issue-550/detail/:id',
        },
      ],
    })
    const route = useRoute()

    expect(route.name).toBe('issue-550')
    expect(route.matched).toEqual([
      {
        name: 'issue-550',
        path: '/pages/issue-550/index',
      },
    ])

    pages = [
      {
        route: 'pages/issue-550/detail/1',
        options: {},
      } as any,
    ]
    callHookList(instance, 'onShow')
    expect(route.name).toBe('issue-550-detail')
    expect(route.params).toEqual({
      id: '1',
    })
  })

  it('useRoute falls back to current page instance before page stack is ready', () => {
    const pageInstance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      route: 'pages/home/page',
      options: {
        tab: 'home',
      },
    } as any
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      is: 'custom-tab-bar/index',
    } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })
    bindCurrentPageInstance(pageInstance)

    ;(globalThis as any).getCurrentPages = vi.fn(() => [])

    const route = useRoute()

    expect(route).toEqual({
      path: 'pages/home/page',
      fullPath: '/pages/home/page?tab=home',
      query: {
        tab: 'home',
      },
      hash: '',
      params: {},
      name: undefined,
    })
  })

  it('useRoute falls back to current page instance when page stack route is empty', () => {
    const pageInstance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      route: 'pages/issue-380/index',
      options: {},
    } as any
    const instance = {
      __wevu: {},
      [WEVU_HOOKS_KEY]: {},
      is: 'custom-tab-bar/index',
    } as any
    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })
    bindCurrentPageInstance(pageInstance)

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: '',
        options: {},
      },
    ])

    const route = useRoute()

    expect(route).toEqual({
      path: 'pages/issue-380/index',
      fullPath: '/pages/issue-380/index',
      query: {},
      hash: '',
      params: {},
      name: undefined,
    })
  })
})
