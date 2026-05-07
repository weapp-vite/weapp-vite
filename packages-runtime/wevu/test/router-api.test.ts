import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, parseQuery, resolveRouteLocation, stringifyQuery, useRoute, useRouter } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { bindCurrentPageInstance } from '@/runtime/register/component/lifecycle/platform'

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
