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
      name: 'post-detail',
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
