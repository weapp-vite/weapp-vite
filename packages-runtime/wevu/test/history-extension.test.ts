import type { RouterHistory, RouterHistoryContext } from '@/router'
import { afterEach, expect, it, vi } from 'vitest'
import { createNavigationFailure, createRouter, NavigationFailureType } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { createExternalQueryHistory, createQueryStore } from './helpers/externalQueryHistory'

afterEach(() => {
  clearActiveRouter()
  vi.unstubAllGlobals()
})

function stubNative(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal('wx', {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
    ...overrides,
  })
}

it('lets the driver reject a navigation before it is written', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative()
  const push = vi.fn()
  const rejecting = createRouter({
    history: {
      create: () => ({
        check: () => createNavigationFailure(NavigationFailureType.aborted),
        push,
      }),
    },
  })
  expect(await rejecting.push('/virtual/target')).toMatchObject({ type: NavigationFailureType.aborted })
  expect(push).not.toHaveBeenCalled()
  const router = createRouter({ history: { create: () => ({ push }) } })
  await router.push('/virtual/target')
  expect(push).toHaveBeenCalledTimes(1)
})

it('writes only after guards pass', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative()
  const push = vi.fn()
  const router = createRouter({ history: { create: () => ({ push }) } })
  const remove = router.beforeEach(() => false)
  expect(await router.push('/virtual/target')).toMatchObject({ type: NavigationFailureType.aborted })
  expect(push).not.toHaveBeenCalled()
  remove()
  await router.push('/virtual/target')
  expect(push).toHaveBeenCalledTimes(1)
})

it('lets the driver release its own state on native reentry', async () => {
  const page = { route: 'pages/home/index', options: { q: 'native' } }
  vi.stubGlobal('getCurrentPages', () => [page])
  stubNative({ switchTab: vi.fn((options: { success?: () => void }) => options.success?.()) })
  const store = createQueryStore()
  const external = createExternalQueryHistory(store)
  const resetLocation = vi.fn(() => store.clear())
  const router = createRouter({
    tabBarEntries: ['/pages/home/index'],
    history: {
      create: context => ({
        ...external.history.create(context),
        resetLocation,
      }),
    },
  })
  await router.replace({ query: { q: 'custom' } })
  expect(store.get('pages/home/index')).toEqual({ q: 'custom' })
  await router.nativeRouter.switchTab({ url: '/pages/home/index' })
  expect(resetLocation).toHaveBeenCalled()
  expect(store.get('pages/home/index')).toBeUndefined()
})

it('routes driver failures through navigation hooks without publishing the target', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative()
  const router = createRouter({
    history: {
      create: () => ({
        push: () => {
          throw new Error('driver failed')
        },
      }),
    },
  })
  const onError = vi.fn()
  const after = vi.fn()
  router.onError(onError)
  router.afterEach(after)
  await expect(router.push('/virtual/target')).rejects.toMatchObject({ type: NavigationFailureType.unknown })
  expect(onError).toHaveBeenCalledTimes(1)
  expect(after).toHaveBeenCalledTimes(1)
  expect(router.currentRoute.path).toBe('pages/home/index')
})

it('creates one driver per router and keeps their stores independent', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: { count: 'initial' } }])
  stubNative()
  const create = vi.fn((context: RouterHistoryContext) => createExternalQueryHistory(createQueryStore()).history.create(context))
  const first = createRouter({ history: { create } })
  const second = createRouter({ history: { create } })
  expect(create).toHaveBeenCalledTimes(2)
  expect(first.currentRoute.query.count).toBe('initial')
  expect(second.currentRoute.query.count).toBe('initial')
})

it('keeps tab query changes away from the native page stack', async () => {
  const page = { route: 'pages/home/index', options: { q: 'initial' } }
  const pages: { route: string, options: Record<string, string> }[] = [page]
  vi.stubGlobal('getCurrentPages', () => pages)
  const navigateTo = vi.fn((options: { success?: () => void }) => {
    pages.push({ route: 'pages/home/index', options: {} })
    options.success?.()
  })
  const redirectTo = vi.fn()
  const switchTab = vi.fn()
  stubNative({ navigateTo, redirectTo, switchTab })
  const store = createQueryStore()
  const { history } = createExternalQueryHistory(store)
  const router = createRouter({ tabBarEntries: ['/pages/home/index'], history })
  await router.replace({ query: { q: 'next' } })
  expect(router.currentRoute.query.q).toBe('next')
  expect(store.get('pages/home/index')).toEqual({ q: 'next' })
  expect(navigateTo).not.toHaveBeenCalled()
  expect(redirectTo).not.toHaveBeenCalled()
  expect(switchTab).not.toHaveBeenCalled()
  expect(pages).toHaveLength(1)
  await router.push('/pages/other/index')
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/other/index' }))
})

it('keeps a custom driver independent from the native history factory', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative()
  const history: RouterHistory = { create: () => ({ push: () => {} }) }
  const router = createRouter({ history })
  expect(router.options.history).toBe(history)
  expect(router.options.history?.syncWithNative).toBeUndefined()
})

it('redirects at the driver level and honours the replace flag', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  const redirectTo = vi.fn((options: { success?: () => void }) => options.success?.())
  stubNative({ navigateTo, redirectTo })
  const router = createRouter({
    history: {
      create: () => ({
        check: to => to.path === 'pages/private/index'
          ? { to: '/pages/login/index', replace: true }
          : undefined,
      }),
    },
  })

  await router.push('/pages/private/index')

  expect(redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }))
  expect(navigateTo).not.toHaveBeenCalled()
  expect(router.currentRoute.path).toBe('pages/login/index')
})

it('awaits an asynchronous driver check before committing the navigation', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative()
  const order: string[] = []
  const router = createRouter({
    history: {
      create: () => ({
        check: async () => {
          order.push('check-start')
          await Promise.resolve()
          order.push('check-end')
          return undefined
        },
        push: () => {
          order.push('push')
        },
      }),
    },
  })

  await router.push('/virtual/target')

  // 异步校验必须先兑现，提交才发生。
  expect(order).toEqual(['check-start', 'check-end', 'push'])
})

it('does not defer the guard behind a microtask for a synchronous driver check', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  stubNative({ navigateTo: vi.fn((options: { success?: () => void }) => options.success?.()) })
  const order: string[] = []
  const router = createRouter({
    history: {
      create: () => ({
        check: () => {
          order.push('check')
          queueMicrotask(() => order.push('microtask'))
          return undefined
        },
      }),
    },
  })
  router.beforeEach(() => {
    order.push('guard')
    return undefined
  })

  await router.push('/virtual/target')

  // 同步校验不引入微任务边界：守卫紧随校验发生，不被 microtask 插队。
  expect(order).toEqual(['check', 'guard', 'microtask'])
})

it('resolves a bare raw position returned by the driver check', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  stubNative({ navigateTo })
  const router = createRouter({
    history: {
      create: () => ({
        check: to => to.path === 'pages/private/index'
          ? { path: '/pages/login/index', query: { from: 'driver' } }
          : undefined,
      }),
    },
  })

  await router.push('/pages/private/index')

  // 裸原始位置必须由框架解析：位置字段完整，不会退化成没有 fullPath 的畸形位置。
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index?from=driver' }))
  expect(router.currentRoute.path).toBe('pages/login/index')
  expect(router.currentRoute.fullPath).toBe('/pages/login/index?from=driver')
})

it('resolves a bare string returned by the driver check', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  stubNative({ navigateTo })
  const router = createRouter({
    history: {
      create: () => ({
        check: to => to.path === 'pages/private/index' ? '/pages/login/index' : undefined,
      }),
    },
  })

  await router.push('/pages/private/index')

  // 字符串形态与对象形态同源：都由框架解析，不会落到「往字符串上写属性」的崩溃路径。
  expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/login/index' }))
  expect(router.currentRoute.fullPath).toBe('/pages/login/index')
})

it('aborts the navigation when the driver check returns false', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn()
  stubNative({ navigateTo })
  const router = createRouter({
    history: {
      create: () => ({
        check: () => false,
      }),
    },
  })

  // false 与守卫的 false 语义一致：中止，而不是「当作没有结果」放行。
  expect(await router.push('/virtual/target')).toMatchObject({ type: NavigationFailureType.aborted })
  expect(navigateTo).not.toHaveBeenCalled()
})

it('releases the navigation when the driver check returns true', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn((options: { success?: () => void }) => options.success?.())
  stubNative({ navigateTo })
  const router = createRouter({
    history: {
      create: () => ({
        check: () => true,
      }),
    },
  })

  await router.push('/virtual/target')

  expect(navigateTo).toHaveBeenCalledTimes(1)
})

/** 失败对象本身是 Error：直接读 message，避免断言依赖具体断言库包装。 */
function normalizeMessage(failure: void | NavigationFailureLike): string {
  return failure ? failure.message : ''
}

interface NavigationFailureLike extends Error {
  type?: number
}

it('aborts with the original message when the driver check returns an Error', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn()
  stubNative({ navigateTo })
  const router = createRouter({
    rejectOnError: false,
    history: {
      create: () => ({
        check: () => new Error('未登录'),
      }),
    },
  })

  // 对齐 Vue Router：返回 Error 中止，且不被误判为具名路由（原型链上的 name）。
  const failure = await router.push('/virtual/target')
  expect(failure).toMatchObject({ type: NavigationFailureType.aborted })
  expect(normalizeMessage(failure)).toContain('未登录')
  expect(navigateTo).not.toHaveBeenCalled()
})

it('aborts with the original message when a guard returns an Error', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn()
  stubNative({ navigateTo })
  const router = createRouter({ rejectOnError: false })
  router.beforeEach(() => new Error('守卫拒绝'))

  const failure = await router.push('/virtual/target')
  expect(failure).toMatchObject({ type: NavigationFailureType.aborted })
  expect(normalizeMessage(failure)).toContain('守卫拒绝')
  expect(navigateTo).not.toHaveBeenCalled()
})

it('aborts with the original message when an async check returns an Error', async () => {
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/home/index', options: {} }])
  const navigateTo = vi.fn()
  stubNative({ navigateTo })
  const router = createRouter({
    rejectOnError: false,
    history: {
      create: () => ({
        check: () => Promise.resolve(new Error('异步拒绝')),
      }),
    },
  })

  const failure = await router.push('/virtual/target')
  expect(failure).toMatchObject({ type: NavigationFailureType.aborted })
  expect(normalizeMessage(failure)).toContain('异步拒绝')
  expect(navigateTo).not.toHaveBeenCalled()
})
