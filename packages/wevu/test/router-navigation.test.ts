import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createNavigationFailure,
  isNavigationFailure,
  NavigationFailureType,
  useRouter,
} from '@/router'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'

describe('router navigation helpers', () => {
  afterEach(() => {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('creates and detects navigation failure', () => {
    const failure = createNavigationFailure(NavigationFailureType.cancelled, undefined, undefined, {
      errMsg: 'navigateTo:fail cancel',
    })

    expect(isNavigationFailure(failure)).toBe(true)
    expect(isNavigationFailure(failure, NavigationFailureType.cancelled)).toBe(true)
    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(false)
    expect(isNavigationFailure(new Error('x'))).toBe(false)
  })

  it('push resolves target with current route path and calls native navigateTo', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
        navigateBack: vi.fn(),
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ])

    const router = useRouter()
    const result = await router.push('./detail?scene=1')

    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/home/detail?scene=1',
    }))
  })

  it('keeps hash in route resolution but strips hash for native navigation url', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    const resolved = router.resolve('./detail?scene=1#comment')
    expect(resolved.fullPath).toBe('/pages/home/detail?scene=1#comment')
    expect(resolved.hash).toBe('#comment')

    const result = await router.push('./detail?scene=1#comment')
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/home/detail?scene=1',
    }))
  })

  it('returns aborted failure for hash-only navigation changes', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
        navigateBack: vi.fn(),
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ])

    const router = useRouter()
    const result = await router.push('/pages/home/index?tab=all#comment')
    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
    expect(result?.message).toContain('Hash-only navigation is not supported')
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('supports custom parseQuery and stringifyQuery through useRouter options', async () => {
    const parseQueryHook = vi.fn(() => ({
      from: 'codec',
    }))
    const stringifyQueryHook = vi.fn((query: any) => {
      if (query.from) {
        return `from=${query.from}`
      }
      return ''
    })
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      parseQuery: parseQueryHook,
      stringifyQuery: stringifyQueryHook,
    })

    const resolved = router.resolve('/pages/detail/index?scene=1')
    expect(parseQueryHook).toHaveBeenCalledWith('scene=1')
    expect(resolved.query).toEqual({
      from: 'codec',
    })
    expect(resolved.fullPath).toBe('/pages/detail/index?from=codec')

    const result = await router.push('/pages/detail/index?scene=1')
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/detail/index?from=codec',
    }))
  })

  it('resolves named routes with params and preserves route metadata', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      namedRoutes: {
        'post-detail': '/pages/post/:id/index',
      },
    })

    const resolved = router.resolve({
      name: 'post-detail',
      params: {
        id: 123,
      },
      query: {
        from: 'home',
      },
      hash: 'comment',
    })
    expect(resolved).toEqual({
      path: 'pages/post/123/index',
      fullPath: '/pages/post/123/index?from=home#comment',
      query: {
        from: 'home',
      },
      hash: '#comment',
      href: '/pages/post/123/index?from=home#comment',
      name: 'post-detail',
      matched: [
        {
          name: 'post-detail',
          path: '/pages/post/:id/index',
        },
      ],
      params: {
        id: '123',
      },
    })

    const result = await router.push({
      name: 'post-detail',
      params: {
        id: 123,
      },
      query: {
        from: 'home',
      },
    })
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/post/123/index?from=home',
    }))
  })

  it('infers route name when resolving static named route paths', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home/index',
        },
      ],
    })

    expect(router.resolve('/pages/home/index').name).toBe('home')
  })

  it('resolves route meta from matched route records', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'dashboard',
          path: '/pages/dashboard/index',
          meta: {
            requiresAuth: true,
            layout: 'admin',
          },
        },
      ],
    })

    const resolved = router.resolve('/pages/dashboard/index')
    expect(resolved.name).toBe('dashboard')
    expect(resolved.href).toBe('/pages/dashboard/index')
    expect(resolved.matched).toEqual([
      {
        name: 'dashboard',
        path: '/pages/dashboard/index',
        meta: {
          requiresAuth: true,
          layout: 'admin',
        },
      },
    ])
    expect(resolved.meta).toEqual({
      requiresAuth: true,
      layout: 'admin',
    })
  })

  it('infers name and params for dynamic route path resolution', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: {
        'post-detail': '/pages/post/:id/index',
      },
    })

    const resolved = router.resolve('/pages/post/123/index')
    expect(resolved.name).toBe('post-detail')
    expect(resolved.params).toEqual({
      id: '123',
    })
    expect(resolved.matched).toEqual([
      {
        name: 'post-detail',
        path: '/pages/post/:id/index',
      },
    ])
  })

  it('infers route name from alias path and keeps canonical matched record', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'dashboard',
          path: '/pages/dashboard/index',
          alias: '/pages/admin/index',
        },
      ],
    })

    const resolved = router.resolve('/pages/admin/index')
    expect(resolved.name).toBe('dashboard')
    expect(resolved.path).toBe('pages/admin/index')
    expect(resolved.matched).toEqual([
      {
        name: 'dashboard',
        path: '/pages/dashboard/index',
        aliasPath: '/pages/admin/index',
      },
    ])
    expect(router.getRoutes()).toEqual([
      {
        name: 'dashboard',
        path: '/pages/dashboard/index',
        alias: '/pages/admin/index',
      },
    ])
  })

  it('matches nested child route records through inherited parent alias paths', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          alias: '/pages/admin',
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
            },
          ],
        },
      ],
    })

    const resolved = router.resolve('/pages/admin/detail/42')
    expect(resolved.name).toBe('home-detail')
    expect(resolved.params).toEqual({
      id: '42',
    })
    expect(resolved.matched).toEqual([
      {
        name: 'home',
        path: '/pages/home',
      },
      {
        name: 'home-detail',
        path: '/pages/home/detail/:id',
        aliasPath: '/pages/admin/detail/:id',
      },
    ])
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home',
        alias: '/pages/admin',
      },
      {
        name: 'home-detail',
        path: '/pages/home/detail/:id',
        alias: '/pages/admin/detail/:id',
      },
    ])
  })

  it('supports nested route records by flattening children paths', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          meta: {
            layout: 'base',
            requiresAuth: false,
          },
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
              meta: {
                requiresAuth: true,
                page: 'detail',
              },
            },
          ],
        },
      ],
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('home-detail')).toBe(true)
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home',
        meta: {
          layout: 'base',
          requiresAuth: false,
        },
      },
      {
        name: 'home-detail',
        path: '/pages/home/detail/:id',
        meta: {
          requiresAuth: true,
          page: 'detail',
        },
      },
    ])

    const resolvedByName = router.resolve({
      name: 'home-detail',
      params: {
        id: 3,
      },
    })
    expect(resolvedByName.fullPath).toBe('/pages/home/detail/3')
    expect(resolvedByName.matched).toEqual([
      {
        name: 'home',
        path: '/pages/home',
        meta: {
          layout: 'base',
          requiresAuth: false,
        },
      },
      {
        name: 'home-detail',
        path: '/pages/home/detail/:id',
        meta: {
          requiresAuth: true,
          page: 'detail',
        },
      },
    ])

    const resolvedByPath = router.resolve('/pages/home/detail/3')
    expect(resolvedByPath.name).toBe('home-detail')
    expect(resolvedByPath.params).toEqual({
      id: '3',
    })
    expect(resolvedByPath.matched).toEqual([
      {
        name: 'home',
        path: '/pages/home',
        meta: {
          layout: 'base',
          requiresAuth: false,
        },
      },
      {
        name: 'home-detail',
        path: '/pages/home/detail/:id',
        meta: {
          requiresAuth: true,
          page: 'detail',
        },
      },
    ])
    expect(resolvedByPath.meta).toEqual({
      layout: 'base',
      requiresAuth: true,
      page: 'detail',
    })
  })

  it('returns unknown navigation failure for invalid named route targets', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: {
        'home': '/pages/home/index',
        'post-detail': '/pages/post/:id/index',
      },
    })

    await expect(router.push({
      name: 'missing-route',
    })).rejects.toMatchObject({
      type: NavigationFailureType.unknown,
      message: expect.stringContaining('Named route "missing-route"'),
    })

    await expect(router.push({
      name: 'post-detail',
    })).rejects.toMatchObject({
      type: NavigationFailureType.unknown,
      message: expect.stringContaining('Missing required param "id"'),
    })
  })

  it('keeps loose params mode by default for unused named-route params', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      namedRoutes: {
        'post-detail': '/pages/post/:id/index',
      },
    })

    const result = await router.push({
      name: 'post-detail',
      params: {
        id: 1,
        extra: 'unused',
      },
    })
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/post/1/index',
    }))
  })

  it('strict params mode rejects unexpected named-route params', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      paramsMode: 'strict',
      namedRoutes: {
        'post-detail': '/pages/post/:id/index',
      },
    })

    await expect(router.push({
      name: 'post-detail',
      params: {
        id: 1,
        extra: 'unused',
      },
    })).rejects.toMatchObject({
      type: NavigationFailureType.unknown,
      message: expect.stringContaining('Unexpected params for named route "post-detail": extra'),
    })
  })

  it('provides hasRoute and getRoutes for named route introspection', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: {
        'home': '/pages/home/index',
        'post-detail': '/pages/post/:id/index',
      },
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('post-detail')).toBe(true)
    expect(router.hasRoute('unknown')).toBe(false)
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home/index',
      },
      {
        name: 'post-detail',
        path: '/pages/post/:id/index',
      },
    ])
  })

  it('supports Vue Router style routes option for route introspection', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home/index',
        },
        {
          name: 'post-detail',
          path: '/pages/post/:id/index',
        },
      ],
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('post-detail')).toBe(true)
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home/index',
      },
      {
        name: 'post-detail',
        path: '/pages/post/:id/index',
      },
    ])
    expect(router.options.routes).toEqual([
      {
        name: 'home',
        path: '/pages/home/index',
      },
      {
        name: 'post-detail',
        path: '/pages/post/:id/index',
      },
    ])
    expect(router.options.namedRoutes).toEqual(router.options.routes)
  })

  it('gives namedRoutes higher precedence when routes and namedRoutes overlap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home/from-routes',
        },
      ],
      namedRoutes: {
        home: '/pages/home/from-named-routes',
      },
    })

    const resolvedByName = router.resolve({
      name: 'home',
    })
    expect(resolvedByName.fullPath).toBe('/pages/home/from-named-routes')
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home/from-named-routes',
      },
    ])
    warn.mockRestore()
  })

  it('warns when routes and namedRoutes contain duplicate route names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home/from-routes',
        },
      ],
      namedRoutes: {
        home: '/pages/home/from-named-routes',
      },
    })

    expect(router.resolve({
      name: 'home',
    }).fullPath).toBe('/pages/home/from-named-routes')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('duplicate route names detected')
    expect(warn.mock.calls[0]?.[0]).toContain('"home" (routes:/pages/home/from-routes -> namedRoutes:/pages/home/from-named-routes)')
    warn.mockRestore()
  })

  it('warns and skips route records with missing name or path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: '',
          path: '/pages/invalid/name',
        } as any,
        {
          name: 'invalid-path',
          path: '',
        } as any,
        {
          name: 'valid-route',
          path: '/pages/valid/index',
        },
      ],
      namedRoutes: {
        '': '/pages/empty-name/index',
        'invalid-map-path': '',
        'valid-map-route': '/pages/valid-map/index',
      } as any,
    })

    expect(router.hasRoute('valid-route')).toBe(true)
    expect(router.hasRoute('valid-map-route')).toBe(true)
    expect(router.hasRoute('invalid-path')).toBe(false)
    expect(warn.mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      expect.stringContaining('ignored route record at routes[0]: route name is required'),
      expect.stringContaining('ignored route record "invalid-path" at routes[1]: route path is required'),
      expect.stringContaining('ignored route record at namedRoutes: route name is required'),
      expect.stringContaining('ignored route record "invalid-map-path" at namedRoutes: route path is required'),
    ]))
    warn.mockRestore()
  })

  it('warns and normalizes duplicate alias declarations', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'alias-home',
          path: '/pages/home/index',
          alias: [
            '/pages/home/index',
            '/pages/home/alias',
            '/pages/home/alias',
          ],
        },
      ],
    })

    expect(router.getRoutes()).toEqual([
      {
        name: 'alias-home',
        path: '/pages/home/index',
        alias: '/pages/home/alias',
      },
    ])
    expect(warn.mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      expect.stringContaining('ignored alias "/pages/home/index" for route "alias-home" at routes[0]: alias is same as route path'),
      expect.stringContaining('ignored duplicate alias "/pages/home/alias" for route "alias-home" at routes[0]'),
    ]))
    warn.mockRestore()
  })

  it('warns and skips circular children references in route records', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const circularRoute: any = {
      name: 'home',
      path: '/pages/home',
    }
    circularRoute.children = [
      circularRoute,
      {
        name: 'home-child',
        path: 'child',
      },
    ]

    const router = useRouter({
      routes: [circularRoute],
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('home-child')).toBe(true)
    expect(router.resolve('/pages/home/child').name).toBe('home-child')
    expect(warn.mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      expect.stringContaining('ignored route record at routes[0].children[0]: detected circular children reference'),
    ]))
    warn.mockRestore()
  })

  it('uses the overriding route guard when routes and namedRoutes overlap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const routesBeforeEnter = vi.fn(() => '/pages/login/index?from=routes')
    const namedRoutesBeforeEnter = vi.fn(() => '/pages/login/index?from=named-routes')
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home/from-routes',
          beforeEnter: routesBeforeEnter,
        },
      ],
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home/from-named-routes',
          beforeEnter: namedRoutesBeforeEnter,
        },
      ],
    })

    await expect(router.push({
      name: 'home',
    })).resolves.toBeUndefined()
    expect(routesBeforeEnter).not.toHaveBeenCalled()
    expect(namedRoutesBeforeEnter).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=named-routes',
    }))
    warn.mockRestore()
  })

  it('uses the overriding route redirect when routes and namedRoutes overlap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
        navigateTo,
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

    const router = useRouter({
      routes: [
        {
          name: 'legacy',
          path: '/pages/legacy/from-routes',
          redirect: '/pages/login/index?from=routes',
        },
      ],
      namedRoutes: [
        {
          name: 'legacy',
          path: '/pages/legacy/from-named-routes',
          redirect: '/pages/login/index?from=named-routes',
        },
      ],
    })

    await expect(router.push({
      name: 'legacy',
    })).resolves.toBeUndefined()
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=named-routes',
    }))
    warn.mockRestore()
  })

  it('supports guard redirect with named route target', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      namedRoutes: {
        'home': '/pages/home/index',
        'post-detail': '/pages/post/:id/index',
      },
    })
    router.beforeEach(() => ({
      name: 'post-detail',
      params: {
        id: 9,
      },
      query: {
        from: 'guard',
      },
    }))

    const result = await router.push('/pages/detail/index')
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/post/9/index?from=guard',
    }))
  })

  it('supports route record beforeEnter guards', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const beforeEnter = vi.fn(() => '/pages/login/index?from=before-enter')
    const router = useRouter({
      namedRoutes: [
        {
          name: 'protected',
          path: '/pages/protected/index',
          beforeEnter,
        },
      ],
    })

    const result = await router.push({
      name: 'protected',
    })
    expect(result).toBeUndefined()
    expect(beforeEnter).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=before-enter',
    }))
  })

  it('matches dynamic route records for path-based beforeEnter navigation', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const beforeEnter = vi.fn((to) => {
      expect(to?.params).toEqual({
        id: '42',
      })
      return '/pages/login/index?from=dynamic-path'
    })

    const router = useRouter({
      namedRoutes: [
        {
          name: 'post-detail',
          path: '/pages/post/:id/index',
          beforeEnter,
        },
      ],
    })

    const result = await router.push('/pages/post/42/index')
    expect(result).toBeUndefined()
    expect(beforeEnter).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=dynamic-path',
    }))
  })

  it('matches alias path for route record beforeEnter navigation', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const beforeEnter = vi.fn((to) => {
      expect(to?.name).toBe('post-detail')
      expect(to?.params).toEqual({
        id: '42',
      })
      return '/pages/login/index?from=alias'
    })

    const router = useRouter({
      namedRoutes: [
        {
          name: 'post-detail',
          path: '/pages/post/:id/index',
          alias: '/pages/article/:id/index',
          beforeEnter,
        },
      ],
    })

    const resolved = router.resolve('/pages/article/42/index')
    expect(resolved.name).toBe('post-detail')
    expect(resolved.params).toEqual({
      id: '42',
    })
    expect(resolved.matched).toEqual([
      {
        name: 'post-detail',
        path: '/pages/post/:id/index',
        aliasPath: '/pages/article/:id/index',
      },
    ])

    const result = await router.push('/pages/article/42/index')
    expect(result).toBeUndefined()
    expect(beforeEnter).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=alias',
    }))
  })

  it('matches nested child route records for path-based beforeEnter navigation', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const beforeEnter = vi.fn((to) => {
      expect(to?.name).toBe('home-detail')
      expect(to?.params).toEqual({
        id: '7',
      })
      return '/pages/login/index?from=nested-child'
    })

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
              beforeEnter,
            },
          ],
        },
      ],
    })

    const result = await router.push('/pages/home/detail/7')
    expect(result).toBeUndefined()
    expect(beforeEnter).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=nested-child',
    }))
  })

  it('runs nested beforeEnter guards from parent to child', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const callOrder: string[] = []
    const parentBeforeEnter = vi.fn(() => {
      callOrder.push('parent')
    })
    const childBeforeEnter = vi.fn(() => {
      callOrder.push('child')
    })

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          beforeEnter: parentBeforeEnter,
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
              beforeEnter: childBeforeEnter,
            },
          ],
        },
      ],
    })

    const result = await router.push('/pages/home/detail/7')
    expect(result).toBeUndefined()
    expect(parentBeforeEnter).toHaveBeenCalledTimes(1)
    expect(childBeforeEnter).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['parent', 'child'])
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/home/detail/7',
    }))
  })

  it('stops nested beforeEnter chain when parent guard redirects', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const parentBeforeEnter = vi.fn(() => '/pages/login/index?from=parent-guard')
    const childBeforeEnter = vi.fn()

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          beforeEnter: parentBeforeEnter,
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
              beforeEnter: childBeforeEnter,
            },
          ],
        },
      ],
    })

    const result = await router.push('/pages/home/detail/8')
    expect(result).toBeUndefined()
    expect(parentBeforeEnter).toHaveBeenCalledTimes(1)
    expect(childBeforeEnter).not.toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=parent-guard',
    }))
  })

  it('applies parent route redirect before nested child guards', async () => {
    const navigateTo = vi.fn()
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
        navigateTo,
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

    const childBeforeEnter = vi.fn()

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          redirect: '/pages/login/index?from=parent-record',
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
              beforeEnter: childBeforeEnter,
            },
          ],
        },
      ],
    })

    const result = await router.push('/pages/home/detail/8')
    expect(result).toBeUndefined()
    expect(childBeforeEnter).not.toHaveBeenCalled()
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=parent-record',
    }))
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('supports route record redirect before navigation', async () => {
    const navigateTo = vi.fn()
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
        navigateTo,
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'legacy-home',
          path: '/pages/legacy/index',
          redirect: '/pages/new/index?from=legacy',
        },
      ],
    })

    const result = await router.push({
      name: 'legacy-home',
    })
    expect(result).toBeUndefined()
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/new/index?from=legacy',
    }))
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('exposes redirectedFrom on resolved redirect targets', () => {
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'legacy-home',
          path: '/pages/legacy/index',
          redirect: '/pages/new/index?from=legacy',
        },
      ],
    })

    let finalTo: any
    router.afterEach((to) => {
      finalTo = to
    })

    return router.push({ name: 'legacy-home' }).then(() => {
      expect(finalTo?.fullPath).toBe('/pages/new/index?from=legacy')
      expect(finalTo?.redirectedFrom).toMatchObject({
        fullPath: '/pages/legacy/index',
        name: 'legacy-home',
      })
    })
  })

  it('supports adding and removing named routes at runtime', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    expect(router.hasRoute('dynamic-post')).toBe(false)

    const removeDynamicPostRoute = router.addRoute({
      name: 'dynamic-post',
      path: '/pages/post/:id/index',
    })
    expect(router.hasRoute('dynamic-post')).toBe(true)
    expect(router.getRoutes()).toEqual([
      {
        name: 'dynamic-post',
        path: '/pages/post/:id/index',
      },
    ])

    const resolvedByName = router.resolve({
      name: 'dynamic-post',
      params: {
        id: 7,
      },
    })
    expect(resolvedByName.fullPath).toBe('/pages/post/7/index')

    const pushed = await router.push({
      name: 'dynamic-post',
      params: {
        id: 7,
      },
    })
    expect(pushed).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/post/7/index',
    }))

    removeDynamicPostRoute()
    expect(router.hasRoute('dynamic-post')).toBe(false)
    await expect(router.push({
      name: 'dynamic-post',
      params: {
        id: 7,
      },
    })).rejects.toMatchObject({
      type: NavigationFailureType.unknown,
      message: expect.stringContaining('Named route "dynamic-post"'),
    })

    router.addRoute({
      name: 'dynamic-post',
      path: '/pages/post/:id/index',
    })
    expect(router.hasRoute('dynamic-post')).toBe(true)
    router.removeRoute('dynamic-post')
    expect(router.hasRoute('dynamic-post')).toBe(false)
  })

  it('supports adding and removing nested routes at runtime', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter()
    const removeNestedRoutes = router.addRoute({
      name: 'home',
      path: '/pages/home',
      children: [
        {
          name: 'home-detail',
          path: 'detail/:id',
        },
      ],
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('home-detail')).toBe(true)
    expect(router.resolve('/pages/home/detail/9').name).toBe('home-detail')

    removeNestedRoutes()
    expect(router.hasRoute('home')).toBe(false)
    expect(router.hasRoute('home-detail')).toBe(false)
  })

  it('addRoute throws for missing route name or path', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home',
        },
      ],
    })

    expect(() => router.addRoute({
      name: '',
      path: '/pages/missing-name/index',
    } as any)).toThrowError('Route name is required when adding a named route')
    expect(() => router.addRoute({
      name: 'missing-path',
      path: '',
    } as any)).toThrowError('Route path is required when adding named route "missing-path"')
    expect(() => router.addRoute('home', {
      name: '',
      path: 'settings',
    } as any)).toThrowError('Route name is required when adding a named route')
  })

  it('addRoute throws for circular children references', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter()
    const circularRoute: any = {
      name: 'circular-home',
      path: '/pages/circular/home',
    }
    circularRoute.children = [circularRoute]

    expect(() => router.addRoute(circularRoute)).toThrowError(
      'Circular children reference detected when adding named route "circular-home"',
    )
  })

  it('supports addRoute(parentName, route) with relative child path', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
        },
      ],
    })

    const removeChildRoute = router.addRoute('home', {
      name: 'home-settings',
      path: 'settings',
    })

    expect(router.hasRoute('home-settings')).toBe(true)
    expect(router.resolve('/pages/home/settings').name).toBe('home-settings')
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home',
      },
      {
        name: 'home-settings',
        path: '/pages/home/settings',
      },
    ])

    removeChildRoute()
    expect(router.hasRoute('home-settings')).toBe(false)
    expect(router.hasRoute('home')).toBe(true)
  })

  it('addRoute replacement removes previous nested children and old path matches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home',
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
            },
          ],
        },
      ],
    })

    expect(router.resolve('/pages/home/detail/9').name).toBe('home-detail')
    router.addRoute({
      name: 'home',
      path: '/pages/dashboard',
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('home-detail')).toBe(false)
    expect(router.resolve('/pages/home/detail/9').name).toBeUndefined()
    expect(router.resolve({
      name: 'home',
    }).fullPath).toBe('/pages/dashboard')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('replaced existing route "home" (/pages/home -> /pages/dashboard) and removed 1 nested route(s)'))
    warn.mockRestore()
  })

  it('addRoute replacement updates static path lookup for renamed route path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home/index',
        },
      ],
    })

    expect(router.resolve('/pages/home/index').name).toBe('home')
    router.addRoute({
      name: 'home',
      path: '/pages/home/new-index',
    })

    expect(router.resolve('/pages/home/index').name).toBeUndefined()
    expect(router.resolve('/pages/home/new-index').name).toBe('home')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('replaced existing route "home" (/pages/home/index -> /pages/home/new-index) and removed 0 nested route(s)'))
    warn.mockRestore()
  })

  it('addRoute replacement updates alias and beforeEnter chains for new records', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const beforeEnterOld = vi.fn(() => '/pages/login/index?from=old')
    const beforeEnterNew = vi.fn(() => '/pages/login/index?from=new')
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter({
      routes: [
        {
          name: 'home',
          path: '/pages/home',
          alias: '/pages/member',
          beforeEnter: beforeEnterOld,
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
            },
          ],
        },
      ],
    })

    router.addRoute({
      name: 'home',
      path: '/pages/dashboard',
      alias: '/pages/admin',
      beforeEnter: beforeEnterNew,
      children: [
        {
          name: 'home-settings',
          path: 'settings',
        },
      ],
    })

    expect(router.hasRoute('home-detail')).toBe(false)
    expect(router.hasRoute('home-settings')).toBe(true)
    expect(router.resolve('/pages/member/detail/1').name).toBeUndefined()
    expect(router.resolve('/pages/admin/settings').name).toBe('home-settings')
    await expect(router.push('/pages/admin/settings')).resolves.toBeUndefined()
    expect(beforeEnterOld).not.toHaveBeenCalled()
    expect(beforeEnterNew).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=new',
    }))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('replaced existing route "home" (/pages/home -> /pages/dashboard) and removed 1 nested route(s)'))
    warn.mockRestore()
  })

  it('addRoute replacement refreshes redirect and alias resolution', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
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

    const router = useRouter({
      routes: [
        {
          name: 'legacy',
          path: '/pages/legacy/index',
          alias: '/pages/legacy/alias',
          redirect: '/pages/login/index?from=old',
        },
      ],
    })

    router.addRoute({
      name: 'legacy',
      path: '/pages/new/index',
      alias: '/pages/new/alias',
      redirect: '/pages/login/index?from=new',
    })

    expect(router.resolve('/pages/legacy/alias').name).toBeUndefined()
    expect(router.resolve('/pages/new/alias').name).toBe('legacy')
    await expect(router.push('/pages/new/alias')).resolves.toBeUndefined()
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=new',
    }))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('replaced existing route "legacy" (/pages/legacy/index -> /pages/new/index) and removed 0 nested route(s)'))
    warn.mockRestore()
  })

  it('inherits parent alias paths for addRoute(parentName, route) children', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          alias: '/pages/admin',
        },
      ],
    })

    router.addRoute('home', {
      name: 'home-log',
      path: 'log/:day',
    })

    const resolved = router.resolve('/pages/admin/log/2026-03-07')
    expect(resolved.name).toBe('home-log')
    expect(resolved.params).toEqual({
      day: '2026-03-07',
    })
    expect(resolved.matched).toEqual([
      {
        name: 'home',
        path: '/pages/home',
      },
      {
        name: 'home-log',
        path: '/pages/home/log/:day',
        aliasPath: '/pages/admin/log/:day',
      },
    ])
    expect(router.getRoutes()).toEqual([
      {
        name: 'home',
        path: '/pages/home',
        alias: '/pages/admin',
      },
      {
        name: 'home-log',
        path: '/pages/home/log/:day',
        alias: '/pages/admin/log/:day',
      },
    ])
  })

  it('removeRoute removes nested child route records together', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home',
          children: [
            {
              name: 'home-detail',
              path: 'detail/:id',
            },
          ],
        },
      ],
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('home-detail')).toBe(true)

    router.removeRoute('home')

    expect(router.hasRoute('home')).toBe(false)
    expect(router.hasRoute('home-detail')).toBe(false)
    expect(router.getRoutes()).toEqual([])
    expect(router.resolve('/pages/home/detail/1').name).toBeUndefined()
  })

  it('supports clearing all named routes at runtime', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      namedRoutes: {
        home: '/pages/home/index',
      },
    })

    router.addRoute({
      name: 'dynamic-post',
      path: '/pages/post/:id/index',
    })

    expect(router.hasRoute('home')).toBe(true)
    expect(router.hasRoute('dynamic-post')).toBe(true)
    expect(router.resolve('/pages/home/index').name).toBe('home')

    router.clearRoutes()

    expect(router.hasRoute('home')).toBe(false)
    expect(router.hasRoute('dynamic-post')).toBe(false)
    expect(router.getRoutes()).toEqual([])
    expect(router.resolve('/pages/home/index').name).toBeUndefined()

    await expect(router.push({ name: 'home' })).rejects.toMatchObject({
      type: NavigationFailureType.unknown,
      message: expect.stringContaining('Named route "home"'),
    })
  })

  it('replace returns duplicated failure when navigating to same location', async () => {
    const redirectTo = vi.fn()
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
        navigateTo: vi.fn(),
        navigateBack: vi.fn(),
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ])

    const router = useRouter()
    const result = await router.replace('/pages/home/index?tab=all')

    expect(isNavigationFailure(result)).toBe(true)
    expect(isNavigationFailure(result, NavigationFailureType.duplicated)).toBe(true)
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('back wraps native failure into NavigationFailure', async () => {
    const navigateBack = vi.fn((options: any) => {
      options.fail?.({ errMsg: 'navigateBack:fail cancel' })
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack,
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ])

    const router = useRouter()
    const result = await router.back(2)

    expect(navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 2 }))
    expect(isNavigationFailure(result, NavigationFailureType.cancelled)).toBe(true)
  })

  it('go with negative delta delegates to back navigation', async () => {
    const navigateBack = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack,
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

    const router = useRouter()
    const result = await router.go(-3)
    expect(result).toBeUndefined()
    expect(navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 3 }))
  })

  it('go with zero delta is a no-op', async () => {
    const navigateBack = vi.fn()
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack,
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

    const router = useRouter()
    const result = await router.go(0)
    expect(result).toBeUndefined()
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('forward returns aborted failure because mini-program router does not support it', async () => {
    const navigateBack = vi.fn()
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo: vi.fn(),
        navigateBack,
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

    const router = useRouter()
    const result = await router.forward()
    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
    expect(result?.message).toContain('Forward navigation is not supported')
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('exposes currentRoute on router and keeps it reactive with route hooks', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)

    const router = useRouter()
    expect(router.currentRoute.fullPath).toBe('/pages/home/index?tab=all')
    expect(router.currentRoute.path).toBe('pages/home/index')

    pages = [
      {
        route: 'pages/profile/index',
        options: {
          from: 'mine',
        },
      },
    ]

    callHookList(instance, 'onShow')
    expect(router.currentRoute.fullPath).toBe('/pages/profile/index?from=mine')
    expect(router.currentRoute.path).toBe('pages/profile/index')
  })

  it('isReady resolves immediately for mini-program router', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter()
    await expect(router.isReady()).resolves.toBeUndefined()
  })

  it('install is a no-op compatibility method', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter()
    expect(() => router.install({})).not.toThrow()
  })

  it('exposes normalized options snapshot', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      tabBarEntries: ['pages/home/index'],
      namedRoutes: {
        home: '/pages/home/index',
      },
      paramsMode: 'strict',
      maxRedirects: 3,
      rejectOnError: false,
    })

    expect(router.options).toMatchObject({
      tabBarEntries: ['/pages/home/index'],
      routes: [
        {
          name: 'home',
          path: '/pages/home/index',
        },
      ],
      namedRoutes: [
        {
          name: 'home',
          path: '/pages/home/index',
        },
      ],
      paramsMode: 'strict',
      maxRedirects: 3,
      rejectOnError: false,
    })

    router.addRoute({
      name: 'dynamic-post',
      path: '/pages/post/:id/index',
    })
    expect(router.options.namedRoutes).toEqual([
      {
        name: 'home',
        path: '/pages/home/index',
      },
    ])
    expect(router.options.routes).toEqual([
      {
        name: 'home',
        path: '/pages/home/index',
      },
    ])
    expect(Object.isFrozen(router.options)).toBe(true)
    expect(Object.isFrozen(router.options.routes)).toBe(true)
    expect(Object.isFrozen(router.options.namedRoutes)).toBe(true)
    expect(() => {
      ;(router.options as any).maxRedirects = 99
    }).toThrow(TypeError)
    expect(() => {
      ;(router.options.routes as any).push({
        name: 'hacked',
        path: '/pages/hacked/index',
      })
    }).toThrow(TypeError)
  })

  it('push auto-switches to tabBar entries', async () => {
    const switchTab = vi.fn((options: any) => {
      options.success?.({})
    })
    const navigateTo = vi.fn()
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab,
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
        navigateBack: vi.fn(),
      },
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance, emit: vi.fn(), attrs: {}, slots: {} })

    ;(globalThis as any).getCurrentPages = vi.fn(() => [
      {
        route: 'pages/profile/index',
        options: {},
      },
    ])

    const router = useRouter({
      tabBarEntries: ['pages/home/index'],
    })

    const result = await router.push('/pages/home/index')
    expect(result).toBeUndefined()
    expect(switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/home/index',
    }))
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('returns aborted failure when tabBar navigation contains query', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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
        route: 'pages/profile/index',
        options: {},
      },
    ])

    const router = useRouter({
      tabBarEntries: ['pages/home/index'],
    })
    const result = await router.push('/pages/home/index?from=profile')

    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
  })

  it('beforeEach can abort and unregister guards', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const guard = vi.fn(() => false)
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    const removeGuard = router.beforeEach(guard)

    const blocked = await router.push('/pages/detail/index')
    expect(isNavigationFailure(blocked, NavigationFailureType.aborted)).toBe(true)
    expect(navigateTo).not.toHaveBeenCalled()
    expect(guard).toHaveBeenCalledTimes(1)

    removeGuard()

    const allowed = await router.push('/pages/detail/index')
    expect(allowed).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledTimes(1)
  })

  it('beforeEach supports redirect result', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    router.beforeEach(() => '/pages/login/index?from=home')

    const result = await router.push('/pages/detail/index')
    expect(result).toBeUndefined()
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=home',
    }))
  })

  it('beforeResolve redirect can dispatch to switchTab for tabBar routes', async () => {
    const switchTab = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab,
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
        route: 'pages/profile/index',
        options: {},
      },
    ])

    const router = useRouter({
      tabBarEntries: ['pages/home/index'],
    })
    router.beforeResolve(() => '/pages/home/index')

    const result = await router.push('/pages/detail/index')
    expect(result).toBeUndefined()
    expect(switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/home/index',
    }))
  })

  it('guard redirect supports replace semantics', async () => {
    const navigateTo = vi.fn()
    const redirectTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo,
        navigateTo,
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

    const router = useRouter()
    router.beforeEach(() => ({
      to: '/pages/login/index?from=home',
      replace: true,
    }))

    const result = await router.push('/pages/detail/index')
    expect(result).toBeUndefined()
    expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/login/index?from=home',
    }))
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('returns aborted failure when guard redirects exceed maxRedirects', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      maxRedirects: 1,
    })
    router.beforeEach((to) => {
      return to?.path === 'pages/a/index' ? '/pages/b/index' : '/pages/a/index'
    })

    const result = await router.push('/pages/detail/index')
    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
  })

  it('afterEach receives success and failure contexts', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const calls: any[] = []
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    router.afterEach((to, from, failure, context) => {
      calls.push({ to, from, failure, context })
    })

    const duplicated = await router.push('/pages/home/index')
    expect(isNavigationFailure(duplicated, NavigationFailureType.duplicated)).toBe(true)

    const success = await router.push('/pages/detail/index')
    expect(success).toBeUndefined()

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      from: { path: 'pages/home/index' },
      to: { path: 'pages/home/index' },
      failure: { type: NavigationFailureType.duplicated },
      context: { mode: 'push' },
    })
    expect(calls[1]).toMatchObject({
      from: { path: 'pages/home/index' },
      to: { path: 'pages/detail/index' },
      failure: undefined,
      context: { mode: 'push' },
    })
  })

  it('onError receives thrown guard errors and supports unregister', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const errors: any[] = []
    const instance = {
      __wevu: {},
      __wevuHooks: {},
      router: {
        switchTab: vi.fn(),
        reLaunch: vi.fn(),
        redirectTo: vi.fn(),
        navigateTo,
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

    const router = useRouter()
    const removeOnError = router.onError((error, context) => {
      errors.push({ error, context })
    })

    const guardError = new Error('guard boom')
    router.beforeEach(() => {
      throw guardError
    })

    await expect(router.push('/pages/detail/index')).rejects.toMatchObject({
      type: NavigationFailureType.aborted,
      cause: guardError,
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      error: guardError,
      context: {
        mode: 'push',
        from: { path: 'pages/home/index' },
        to: { path: 'pages/detail/index' },
        failure: { type: NavigationFailureType.aborted },
      },
    })

    removeOnError()
    await expect(router.push('/pages/detail/index')).rejects.toMatchObject({
      type: NavigationFailureType.aborted,
      cause: guardError,
    })
    expect(errors).toHaveLength(1)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('can resolve unexpected failures when rejectOnError is disabled', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const router = useRouter({
      rejectOnError: false,
    })
    router.beforeEach(() => {
      throw new Error('guard boom')
    })

    const result = await router.push('/pages/detail/index')
    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
  })

  it('onError ignores expected navigation failures', async () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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

    const onError = vi.fn()
    const router = useRouter()
    router.onError(onError)

    const result = await router.push('/pages/home/index')
    expect(isNavigationFailure(result, NavigationFailureType.duplicated)).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('resolve uses latest route state after route hooks update', () => {
    const instance = {
      __wevu: {},
      __wevuHooks: {},
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
        route: 'pages/home/index',
        options: {
          tab: 'all',
        },
      },
    ]
    ;(globalThis as any).getCurrentPages = vi.fn(() => pages)

    const router = useRouter()
    expect(router.resolve('./detail').fullPath).toBe('/pages/home/detail')

    pages = [
      {
        route: 'pages/profile/index',
        options: {
          from: 'mine',
        },
      },
    ]

    callHookList(instance, 'onShow')
    expect(router.resolve('./detail').fullPath).toBe('/pages/profile/detail')
  })
})
