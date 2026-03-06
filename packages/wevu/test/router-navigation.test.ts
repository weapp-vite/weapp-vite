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
    router.beforeEach(({ to }) => {
      return to?.path === 'pages/a/index' ? '/pages/b/index' : '/pages/a/index'
    })

    const result = await router.push('/pages/detail/index')
    expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true)
  })

  it('afterEach receives success and failure contexts', async () => {
    const navigateTo = vi.fn((options: any) => {
      options.success?.({})
    })
    const contexts: any[] = []
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
    router.afterEach((context) => {
      contexts.push(context)
    })

    const duplicated = await router.push('/pages/home/index')
    expect(isNavigationFailure(duplicated, NavigationFailureType.duplicated)).toBe(true)

    const success = await router.push('/pages/detail/index')
    expect(success).toBeUndefined()

    expect(contexts).toHaveLength(2)
    expect(contexts[0]).toMatchObject({
      mode: 'push',
      from: { path: 'pages/home/index' },
      to: { path: 'pages/home/index' },
      failure: { type: NavigationFailureType.duplicated },
    })
    expect(contexts[1]).toMatchObject({
      mode: 'push',
      from: { path: 'pages/home/index' },
      to: { path: 'pages/detail/index' },
      failure: undefined,
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

    const firstResult = await router.push('/pages/detail/index')
    expect(isNavigationFailure(firstResult, NavigationFailureType.aborted)).toBe(true)
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
    const secondResult = await router.push('/pages/detail/index')
    expect(isNavigationFailure(secondResult, NavigationFailureType.aborted)).toBe(true)
    expect(errors).toHaveLength(1)
    expect(navigateTo).not.toHaveBeenCalled()
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
