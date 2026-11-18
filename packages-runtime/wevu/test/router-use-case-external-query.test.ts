import type { RouteLocationNormalizedLoaded } from '@/router'
import { afterEach, expect, it, vi } from 'vitest'
import { watch } from '@/reactivity'
import { createRouter, NavigationFailureType, useRoute } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { createExternalQueryHistory, createQueryStore } from './helpers/externalQueryHistory'

afterEach(() => {
  clearActiveRouter()
  vi.unstubAllGlobals()
})

function stubNative() {
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const redirectTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const navigateBack = vi.fn((options: { success?: () => void }) => options.success?.())
  vi.stubGlobal('wx', {
    navigateTo,
    redirectTo,
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack,
  })
  return { navigateTo, redirectTo, navigateBack }
}

it('keeps query in the application store instead of the native url', async () => {
  const { navigateTo, redirectTo } = stubNative()
  const page = { route: 'pages/home/index', options: { q: 'native' } }
  vi.stubGlobal('getCurrentPages', () => [page])
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  const route = useRoute()

  expect(route.query.q).toBe('native')

  await router.replace({ query: { q: 'external' } })
  expect(store.get('pages/home/index')).toEqual({ q: 'external' })
  expect(route.query.q).toBe('external')
  expect(navigateTo).not.toHaveBeenCalled()
  expect(redirectTo).not.toHaveBeenCalled()
  expect(page.options.q).toBe('native')

  await router.push({ path: '/pages/other/index', query: { q: 'next' } })
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/other/index' }))
  expect(store.get('pages/other/index')).toEqual({ q: 'next' })
})

it('notifies reactive consumers when query changes through navigation', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: { q: 'native' } }])
  const { history } = createExternalQueryHistory(createQueryStore())
  const router = createRouter({ history })
  const route = useRoute()
  const seen: unknown[] = []

  const stop = watch(() => route.query.q, value => seen.push(value), { flush: 'sync' })
  await router.replace({ query: { q: 'external' } })
  stop()

  expect(seen).toEqual(['external'])
})

it('refreshes the route and reactive consumers when the store changes out of band', () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: { q: 'native' } }])
  const store = createQueryStore()
  const { history, notify } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  const route = useRoute()
  const seen: unknown[] = []

  const stop = watch(() => route.query.q, value => seen.push(value), { flush: 'sync' })
  store.set('pages/home/index', { q: 'out-of-band' })
  notify()
  stop()

  expect(seen).toEqual(['out-of-band'])
  expect(route.query.q).toBe('out-of-band')
  expect(router.currentRoute.query.q).toBe('out-of-band')
})

it('does not touch the store or route when a guard aborts', async () => {
  const { navigateTo } = stubNative()
  const page = { route: 'pages/home/index', options: { q: 'native' } }
  vi.stubGlobal('getCurrentPages', () => [page])
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  const route = useRoute()

  const remove = router.beforeEach(() => false)
  expect(await router.replace({ query: { q: 'blocked' } })).toMatchObject({ type: NavigationFailureType.aborted })
  expect(navigateTo).not.toHaveBeenCalled()
  expect(store.get('pages/home/index')).toBeUndefined()
  expect(route.query.q).toBe('native')
  remove()

  await router.replace({ query: { q: 'allowed' } })
  expect(store.get('pages/home/index')).toEqual({ q: 'allowed' })
  expect(route.query.q).toBe('allowed')
})

it('exposes the stored query to beforeEach when the raw target omits it', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  store.set('pages/other/index', { q: 'stored' })
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  let guardTarget: RouteLocationNormalizedLoaded | undefined
  router.beforeEach((to) => {
    guardTarget = to
    return undefined
  })

  await router.push('/pages/other/index')

  expect(guardTarget?.query).toEqual({ q: 'stored' })
  expect(guardTarget?.fullPath).toBe('/pages/other/index?q=stored')
})

it('keeps an explicit target query over the stored one in beforeEach', async () => {
  stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  store.set('pages/other/index', { q: 'stored' })
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  let guardedQuery: Record<string, unknown> | undefined
  router.beforeEach((to) => {
    guardedQuery = { ...to?.query }
    return undefined
  })

  await router.push({ path: '/pages/other/index', query: { q: 'explicit' } })

  expect(guardedQuery).toEqual({ q: 'explicit' })
  expect(store.get('pages/other/index')).toEqual({ q: 'explicit' })
})

it('exposes the stored query as the from snapshot in beforeEach', async () => {
  stubNative()
  const store = createQueryStore()
  const { history, notify } = createExternalQueryHistory(store)
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: { q: 'native' } }])
  const router = createRouter({ history })
  let fromQuery: Record<string, unknown> | undefined
  router.beforeEach((_to, from) => {
    fromQuery = { ...from.query }
    return undefined
  })
  store.set('pages/home/index', { q: 'external' })
  notify()

  await router.replace({ query: { next: '1' } })

  expect(fromQuery).toEqual({ q: 'external' })
})

it('injects the stored query into a guard redirect target', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  store.set('pages/login/index', { redirect: '/pages/private/index?id=7' })
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  router.beforeEach(to => to?.path === 'pages/private/index' ? { path: '/pages/login/index' } : undefined)

  await router.push({ path: '/pages/private/index', query: { id: '7' } })

  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }))
  expect(store.get('pages/login/index')).toEqual({ redirect: '/pages/private/index?id=7' })
  expect(router.currentRoute.query.redirect).toBe('/pages/private/index?id=7')
})

it('lets a guard redirect supply the query', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: { q: 'native' } }])
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  router.beforeEach((to) => {
    if (to?.path !== 'pages/private/index') {
      return undefined
    }
    return { path: '/pages/login/index', query: { redirect: to.fullPath } }
  })

  await router.push({ path: '/pages/private/index', query: { id: '7' } })

  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }))
  expect(store.get('pages/login/index')).toEqual({ redirect: '/pages/private/index?id=7' })
})

it('honours the replace flag of a guard redirect', async () => {
  const { navigateTo, redirectTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const { history } = createExternalQueryHistory(createQueryStore())
  const router = createRouter({ history })
  router.beforeEach(to => to?.path === 'pages/private/index'
    ? { to: { path: '/pages/login/index' }, replace: true }
    : undefined)

  await router.push('/pages/private/index')

  expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }))
  expect(navigateTo).not.toHaveBeenCalled()
  expect(router.currentRoute.path).toBe('pages/login/index')
})

it('awaits an asynchronous guard before deciding the navigation', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  router.beforeEach(async (to) => {
    await Promise.resolve()
    return to?.path === 'pages/private/index' ? false : undefined
  })

  expect(await router.push('/pages/private/index')).toMatchObject({ type: NavigationFailureType.aborted })
  expect(navigateTo).not.toHaveBeenCalled()
  expect(store.get('pages/private/index')).toBeUndefined()
})

it('completes the navigation after an asynchronous guard allows it', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  router.beforeEach(async () => {
    await Promise.resolve()
    return undefined
  })

  await router.push({ path: '/pages/other/index', query: { q: 'next' } })

  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/other/index' }))
  expect(store.get('pages/other/index')).toEqual({ q: 'next' })
})

it('resolves relative redirects with the same base as router.resolve', async () => {
  const { navigateTo } = stubNative()
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const router = createRouter()
  router.beforeEach(to => to?.path === 'pages/private/index' ? { path: './login/index' } : undefined)

  expect(router.resolve('./login/index').fullPath).toBe('/pages/home/login/index')
  await router.push('/pages/private/index')

  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/home/login/index' }))
})

it('keeps each page query isolated by path and reads the right one back', async () => {
  const home = { route: 'pages/home/index', options: {} }
  const other = { route: 'pages/other/index', options: {} }
  const pages: { route: string, options: Record<string, string> }[] = [home]
  vi.stubGlobal('getCurrentPages', () => pages)
  stubNative()
  const store = createQueryStore()
  const { history, notify } = createExternalQueryHistory(store)
  const router = createRouter({ history })
  const route = useRoute()

  await router.replace({ query: { from: 'home' } })
  await router.push({ path: '/pages/other/index', query: { from: 'other' } })

  expect(store.get('pages/home/index')).toEqual({ from: 'home' })
  expect(store.get('pages/other/index')).toEqual({ from: 'other' })

  pages.splice(0, pages.length, other)
  notify()
  expect(route.path).toBe('pages/other/index')
  expect(route.query.from).toBe('other')

  pages.splice(0, pages.length, home)
  notify()
  expect(route.path).toBe('pages/home/index')
  expect(route.query.from).toBe('home')

  store.clear('pages/other/index')
  expect(store.get('pages/other/index')).toBeUndefined()
  expect(store.get('pages/home/index')).toEqual({ from: 'home' })
})

it('does not write the store when the native cross-page navigation fails', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  vi.stubGlobal('wx', {
    navigateTo: vi.fn((options: { fail?: (error: unknown) => void }) => options.fail?.('native failure')),
    redirectTo: vi.fn(),
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
  })
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ history, rejectOnError: false })

  const failure = await router.push({ path: '/pages/other/index', query: { q: 'lost' } })

  expect(failure).toBeDefined()
  expect(store.get('pages/other/index')).toBeUndefined()
  expect(router.currentRoute.path).toBe('pages/home/index')
})
