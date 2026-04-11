import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, parseQuery, resolveRouteLocation, stringifyQuery, useRoute, useRouter } from '@/router'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'

describe('router api', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
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

  it('useRoute syncs with onLoad, onShow, and onRouteDone hooks', () => {
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
})
