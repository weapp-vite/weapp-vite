import type { RouterHistory } from '@/router'
import { afterEach, expect, it, vi } from 'vitest'
import { createMiniProgramHistory, createRouter, NavigationFailureType, useRoute } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { notifyRouteStateSync, registerRouteStateSyncHandler } from '@/router/routeSync'

afterEach(() => {
  clearActiveRouter()
  vi.unstubAllGlobals()
})

it('uses native navigation with explicit history', async () => {
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const redirectTo = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', { navigateTo, redirectTo, switchTab: vi.fn(), reLaunch: vi.fn(), navigateBack: vi.fn() })
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const history = createMiniProgramHistory()
  const router = createRouter({ history })
  expect(router.options.history?.syncWithNative).toBe(true)
  expect(Object.isFrozen(history)).toBe(true)
  await router.push('/pages/detail/index?q=one')
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/detail/index?q=one' }))
  await router.replace({ query: { q: 'two' } })
  expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/detail/index?q=two' }))
  expect(await router.forward()).toMatchObject({ type: NavigationFailureType.aborted })
})

it('keeps history implementation in user code and routes driver errors through onError', async () => {
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn(), navigateBack: vi.fn() })
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const write = vi.fn(() => {
    throw new Error('driver failed')
  })
  const router = createRouter({
    history: { create: () => ({ push: write }) },
  })
  const onError = vi.fn()
  const after = vi.fn()
  router.onError(onError)
  router.afterEach(after)
  await expect(router.push('/virtual/target')).rejects.toMatchObject({ type: NavigationFailureType.unknown })
  expect(write).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(after).toHaveBeenCalledTimes(1)
  expect(router.currentRoute.path).toBe('pages/home/index')
})

it('inherits all native methods when custom history leaves overrides empty', async () => {
  const navigateBack = vi.fn((options: { success?: () => void }) => options.success?.())
  const switchTab = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), switchTab, reLaunch: vi.fn(), navigateBack })
  vi.stubGlobal('getCurrentPages', () => [
    { route: 'pages/previous/index', options: {} },
    { route: 'pages/home/index', options: {} },
  ])
  const router = createRouter({ history: { create: () => ({}) }, tabBarEntries: ['/pages/tab/index'] })
  await router.back()
  expect(navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1 }))
  await router.push('/pages/tab/index')
  expect(switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/tab/index' }))
  expect(await router.push('/pages/tab/index?q=blocked')).toMatchObject({ type: NavigationFailureType.duplicated })
})

it('lets a void override fully handle navigation without invoking native behavior', async () => {
  const navigateTo = vi.fn()
  vi.stubGlobal('wx', { navigateTo, redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn() })
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const push = vi.fn(() => {})
  const router = createRouter({ history: { create: () => ({ push }) } })
  await router.push('/virtual/target')
  expect(push).toHaveBeenCalledTimes(1)
  expect(navigateTo).not.toHaveBeenCalled()
  expect(router.currentRoute.path).toBe('virtual/target')
})

it('delegates explicitly to native behavior exactly once', async () => {
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', { navigateTo, redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn() })
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const router = createRouter({ history: { create: ({ defaultHistory }) => ({ push: (to, from) => defaultHistory.push(to, from) }) } })
  await router.push('/pages/other/index')
  expect(navigateTo).toHaveBeenCalledTimes(1)
})

it('supports an external location store and out-of-band location notification', async () => {
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn() })
  const page = { route: 'pages/home/index', options: {} }
  vi.stubGlobal('getCurrentPages', () => [page])
  let location = '/custom/start'
  let notify: (() => void) | undefined
  const router = createRouter({ history: { create: ({ defaultHistory, resolve, notifyLocationChange }) => {
    notify = () => notifyLocationChange()
    return {
      readLocation: () => resolve(location),
      push(to) { location = to.fullPath },
      resolveGo: () => ({ target: resolve('/custom/start') }),
      go() { location = '/custom/start' },
      resetLocation: defaultHistory.resetLocation,
    }
  } } })
  expect(router.currentRoute.path).toBe('custom/start')
  await router.push('/custom/next')
  expect(useRoute().path).toBe('custom/next')
  location = '/custom/external'
  notify?.()
  expect(router.currentRoute.path).toBe('custom/external')
  await router.back()
  expect(router.currentRoute.path).toBe('custom/start')
})

it('keeps custom location providers isolated between routers', async () => {
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn() })
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const first = createRouter({ history: { create: ({ resolve }) => ({ readLocation: () => resolve('/virtual/first') }) } })
  const second = createRouter()
  expect(first.currentRoute.path).toBe('virtual/first')
  expect(second.currentRoute.path).toBe('pages/home/index')
  notifyRouteStateSync({ source: 'page' })
  expect(first.currentRoute.path).toBe('virtual/first')
  expect(second.currentRoute.path).toBe('pages/home/index')
})

it('resolves back targets with the owning router history, not the global active router', async () => {
  const first = { route: 'pages/home/index', options: {} }
  const second = { route: 'pages/detail/index', options: {} }
  vi.stubGlobal('getCurrentPages', () => [first, second])
  const navigateBack = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn(), navigateBack })
  const history: RouterHistory = {
    syncWithNative: false,
    create: ({ resolve }) => ({
      readLocation: () => resolve('/virtual/previous'),
      go: () => {},
    }),
  }
  const router = createRouter({ history })
  const guard = vi.fn()
  router.beforeEach(guard)
  // 后创建的 router 接管全局 active，但返回目标仍由发起 back 的 router 读取。
  createRouter()
  await router.back()
  expect(guard).toHaveBeenLastCalledWith(
    expect.objectContaining({ path: 'virtual/previous' }),
    expect.anything(),
    expect.anything(),
  )
})

it('delegates the standard traversal to the final location reader', async () => {
  const first = { route: 'pages/home/index', options: {} }
  const second = { route: 'pages/detail/index', options: {} }
  vi.stubGlobal('getCurrentPages', () => [first, second])
  const navigateBack = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn(), navigateBack })
  const router = createRouter({ history: {
    create: ({ defaultHistory, resolve }) => ({
      readLocation: () => resolve('/virtual/previous'),
      resolveGo: (delta, from) => defaultHistory.resolveGo(delta, from),
      go: () => {},
    }),
  } })
  const guard = vi.fn()
  router.beforeEach(guard)
  await router.back()
  expect(guard).toHaveBeenLastCalledWith(
    expect.objectContaining({ path: 'virtual/previous' }),
    expect.anything(),
    expect.anything(),
  )
})

it('publishes isolated location changes without broadcasting to native subscribers', async () => {
  const page = { route: 'pages/home/index', options: {} }
  vi.stubGlobal('getCurrentPages', () => [page])
  vi.stubGlobal('wx', { navigateTo: vi.fn(), redirectTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), reLaunch: vi.fn() })
  let location = '/virtual/start'
  let notify: (() => void) | undefined
  const broadcast = vi.fn()
  const unregister = registerRouteStateSyncHandler(broadcast)
  try {
    const router = createRouter({ history: {
      syncWithNative: false,
      create: ({ resolve, notifyLocationChange }) => {
        notify = () => notifyLocationChange()
        return {
          readLocation: () => resolve(location),
          push: (to) => { location = to.fullPath },
          resolveGo: () => ({ target: resolve('/virtual/start') }),
          go: () => { location = '/virtual/start' },
        }
      },
    } })
    expect(router.currentRoute.path).toBe('virtual/start')
    expect(useRoute().path).toBe('virtual/start')
    await router.push('/virtual/next')
    expect(router.currentRoute.path).toBe('virtual/next')
    location = '/virtual/external'
    notify?.()
    expect(router.currentRoute.path).toBe('virtual/external')
    expect(useRoute().path).toBe('virtual/external')
    expect(broadcast).not.toHaveBeenCalled()
  }
  finally {
    unregister()
  }
})
