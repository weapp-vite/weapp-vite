import type { RouteLocationNormalizedLoaded } from '@/router'
import { afterEach, expect, it, vi } from 'vitest'
import { watch } from '@/reactivity'
import { createRouter, NavigationFailureType, useRoute } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { notifyRouteStateSync } from '@/router/routeSync'
import { createQueryStore } from './helpers/externalQueryHistory'
import { createSwitchTabQueryHistory } from './helpers/switchTabQueryHistory'

afterEach(() => {
  clearActiveRouter()
  vi.unstubAllGlobals()
})

function stubNative(overrides: Record<string, unknown> = {}) {
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const redirectTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const switchTab = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', {
    navigateTo,
    redirectTo,
    switchTab,
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
    ...overrides,
  })
  return { navigateTo, redirectTo, switchTab }
}

it('shows the built-in tab navigation rejects query instead of preserving it', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'] })

  const failure = await router.push({ path: '/pages/tab/index', query: { tab: 'all' } })

  expect(failure).toMatchObject({ type: NavigationFailureType.aborted })
  expect(failure?.message).toContain('switchTab does not support query parameters')
})

it('uses switchTab for push to a tabBar page and keeps query out of the native url', async () => {
  const pages = [{ route: 'pages/home/index', options: {} }]
  vi.stubGlobal('getCurrentPages', () => pages)
  const switchTab = vi.fn((options: { success?: () => void }) => {
    pages.splice(0, pages.length, { route: 'pages/tab/index', options: {} })
    options.success?.()
  })
  const { navigateTo, redirectTo } = stubNative({ switchTab })
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()

  await router.push({ path: '/pages/tab/index', query: { tab: 'all', from: 'home' } })

  expect(switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/tab/index' }))
  expect(navigateTo).not.toHaveBeenCalled()
  expect(redirectTo).not.toHaveBeenCalled()
  expect(pages[0].options).toEqual({})
  expect(store.get('pages/tab/index')).toEqual({ tab: 'all', from: 'home' })
  expect(route.query).toEqual({ tab: 'all', from: 'home' })
})

it('uses switchTab for replace to a tabBar page and allows same-tab query changes', async () => {
  const { navigateTo, redirectTo, switchTab } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()

  await router.push({ path: '/pages/tab/index', query: { tab: 'all' } })
  await router.replace({ path: '/pages/tab/index', query: { tab: 'mine' } })

  expect(switchTab).toHaveBeenCalledTimes(2)
  expect(redirectTo).not.toHaveBeenCalled()
  expect(navigateTo).not.toHaveBeenCalled()
  expect(store.get('pages/tab/index')).toEqual({ tab: 'mine' })
  expect(route.query.tab).toBe('mine')
})

it('delegates non-tab navigation to the native history', async () => {
  const { navigateTo, switchTab } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })

  await router.push({ path: '/pages/detail/index', query: { id: '7' } })

  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/detail/index?id=7' }))
  expect(switchTab).not.toHaveBeenCalled()
  expect(store.get('pages/detail/index')).toBeUndefined()
  expect(router.currentRoute.query.id).toBe('7')
})

it('does not write the stored query when switchTab fails', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const switchTab = vi.fn((options: { fail?: (error: unknown) => void }) => options.fail?.('native failure'))
  stubNative({ switchTab })
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history, rejectOnError: false })

  const failure = await router.push({ path: '/pages/tab/index', query: { tab: 'lost' } })

  expect(failure).toBeDefined()
  expect(store.get('pages/tab/index')).toBeUndefined()
  expect(router.currentRoute.path).toBe('pages/home/index')
})

it('reads the stored tab query back after native tab reentry', () => {
  const pages = [{ route: 'pages/home/index', options: {} }]
  vi.stubGlobal('getCurrentPages', () => pages)
  stubNative()
  const store = createQueryStore()
  const { history, notify } = createSwitchTabQueryHistory(store)
  createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()

  store.set('pages/tab/index', { tab: 'saved' })
  pages.splice(0, pages.length, { route: 'pages/tab/index', options: {} })
  notify()

  expect(route.path).toBe('pages/tab/index')
  expect(route.query.tab).toBe('saved')
})

it('exposes the stored tab query to beforeEach when the target omits it', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  store.set('pages/tab/index', { tab: 'stored' })
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  let guardTarget: RouteLocationNormalizedLoaded | undefined
  router.beforeEach((to) => {
    guardTarget = to
    return undefined
  })

  await router.push('/pages/tab/index')

  expect(guardTarget?.query).toEqual({ tab: 'stored' })
  expect(guardTarget?.fullPath).toBe('/pages/tab/index?tab=stored')
})

it('accepts a promise-returning switchTab for success and failure', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  vi.stubGlobal('wx', {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
    switchTab: vi.fn(() => Promise.resolve()),
  })
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })

  await router.push({ path: '/pages/tab/index', query: { tab: 'promise' } })
  expect(store.get('pages/tab/index')).toEqual({ tab: 'promise' })

  const failing = vi.fn(() => Promise.reject(new Error('native failure')))
  vi.stubGlobal('wx', {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
    switchTab: failing,
  })
  const failStore = createQueryStore()
  const failHistory = createSwitchTabQueryHistory(failStore)
  const failRouter = createRouter({ tabBarEntries: ['/pages/tab/index'], history: failHistory.history, rejectOnError: false })

  const failure = await failRouter.push({ path: '/pages/tab/index', query: { tab: 'rejected' } })
  expect(failure).toBeDefined()
  expect(failStore.get('pages/tab/index')).toBeUndefined()
})

it('rejects a duplicated non-tab target through the default check without writing the store', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history, rejectOnError: false })

  await router.push({ path: '/pages/detail/index', query: { id: '7' } })
  expect(navigateTo).toHaveBeenCalledTimes(1)

  const failure = await router.push({ path: '/pages/detail/index', query: { id: '7' } })
  expect(failure).toMatchObject({ type: NavigationFailureType.duplicated })
  expect(navigateTo).toHaveBeenCalledTimes(1)
  expect(store.get('pages/detail/index')).toBeUndefined()
})

it('reads the stored tab query only from native syncs that carry the page, not the raw url', () => {
  const pages = [{ route: 'pages/home/index', options: {} }]
  vi.stubGlobal('getCurrentPages', () => pages)
  stubNative()
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()

  store.set('pages/tab/index', { tab: 'saved' })
  pages.splice(0, pages.length, { route: 'pages/tab/index', options: {} })

  notifyRouteStateSync({ source: 'native', method: 'switchTab', page: pages[0] })
  expect(route.query.tab).toBe('saved')

  store.set('pages/tab/index', { tab: 'kept' })
  notifyRouteStateSync({ source: 'native', method: 'switchTab', url: '/pages/tab/index' })
  expect(route.query.tab).toBeUndefined()
})

it('notifies reactive consumers when a tab query changes through navigation', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()
  const seen: unknown[] = []

  const stop = watch(() => route.query.tab, value => seen.push(value), { flush: 'sync' })
  await router.push({ path: '/pages/tab/index', query: { tab: 'all' } })
  stop()

  expect(seen).toEqual(['all'])
})

it('refreshes the route and reactive consumers when the tab store changes out of band', () => {
  stubNative()
  const pages = [{ route: 'pages/tab/index', options: {} }]
  vi.stubGlobal('getCurrentPages', () => pages)
  const store = createQueryStore()
  const { history, notify } = createSwitchTabQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/tab/index'], history })
  const route = useRoute()
  const seen: unknown[] = []

  const stop = watch(() => route.query.tab, value => seen.push(value), { flush: 'sync' })
  store.set('pages/tab/index', { tab: 'out-of-band' })
  notify()
  stop()

  expect(seen).toEqual(['out-of-band'])
  expect(route.query.tab).toBe('out-of-band')
  expect(router.currentRoute.query.tab).toBe('out-of-band')
})
