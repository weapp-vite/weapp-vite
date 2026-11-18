import type { RouteLocationNormalizedLoaded } from '@/router/types'
import { afterEach, expect, it, vi } from 'vitest'
import {
  isNavigationRedirectCandidate,
  isRouteLocationRawCandidate,
} from '@/router/navigationCore'
import { createNavigationScope } from '@/router/navigationScope'
import {
  applyRedirectTransition,
  createRedirectCounter,
  resolveRedirectMode,
} from '@/router/navigationTargetHelpers'
import { notifyRouteStateSync, publishRouteState, registerRouteStateSyncHandler } from '@/router/routeSync'

function createRoute(fullPath: string): RouteLocationNormalizedLoaded {
  const [path, search = ''] = fullPath.split('?')
  const query: Record<string, string> = {}
  for (const pair of search.split('&')) {
    if (!pair) {
      continue
    }
    const [key, value = ''] = pair.split('=')
    query[key] = value
  }
  return {
    path,
    fullPath,
    query,
    hash: '',
    params: {},
    matched: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('redirect policy', () => {
  it('resolves the three-state replace semantics', () => {
    expect(resolveRedirectMode(true, 'push')).toBe('replace')
    expect(resolveRedirectMode(false, 'replace')).toBe('push')
    expect(resolveRedirectMode(undefined, 'push')).toBe('push')
    expect(resolveRedirectMode(undefined, 'replace')).toBe('replace')
  })

  it('recognizes raw positions only through own fields', () => {
    // 普通 Error 的原型链带 name="Error"，用 `in` 判定会把它误判为具名路由。
    expect(isRouteLocationRawCandidate(new Error('拒绝'))).toBe(false)
    expect(isRouteLocationRawCandidate(Object.create({ name: 'home' }))).toBe(false)
    expect(isRouteLocationRawCandidate(Object.create({ path: '/x' }))).toBe(false)
    expect(isRouteLocationRawCandidate('pages/home/index')).toBe(true)
    expect(isRouteLocationRawCandidate({ path: 'pages/home/index' })).toBe(true)
    expect(isRouteLocationRawCandidate(createRoute('/pages/home/index?a=1'))).toBe(true)
  })

  it('recognizes redirect shape only through own to field', () => {
    expect(isNavigationRedirectCandidate({ to: '/pages/login/index', replace: true })).toBe(true)
    expect(isNavigationRedirectCandidate(Object.create({ to: '/pages/login/index' }))).toBe(false)
    expect(isNavigationRedirectCandidate({ path: '/pages/login/index' })).toBe(false)
  })

  it('treats an unchanged target and mode as no transition', () => {
    const current = createRoute('/pages/home/index?q=1')
    const redirected = createRoute('/pages/home/index?q=1')
    const transition = applyRedirectTransition({
      redirectedTarget: redirected,
      currentTarget: current,
      currentMode: 'push',
      nextMode: 'push',
    })
    expect(transition).toBeUndefined()
    expect(redirected.redirectedFrom).toBeUndefined()
  })

  it('records the redirect source when the target changes', () => {
    const current = createRoute('/pages/home/index')
    const redirected = createRoute('/pages/other/index')
    const transition = applyRedirectTransition({
      redirectedTarget: redirected,
      currentTarget: current,
      currentMode: 'push',
      nextMode: 'replace',
    })
    expect(transition).toEqual({ target: redirected, mode: 'replace' })
    expect(redirected.redirectedFrom).toMatchObject({ fullPath: '/pages/home/index' })
  })

  it('counts redirects against the configured limit', () => {
    const counter = createRedirectCounter(2)
    expect(counter.increase()).toBe(true)
    expect(counter.count).toBe(1)
    expect(counter.increase()).toBe(true)
    expect(counter.increase()).toBe(false)
    expect(counter.count).toBe(3)
  })
})

describe('navigation scope', () => {
  it('ignores external sync while a managed navigation is in flight', () => {
    const scope = createNavigationScope()
    scope.beginManaged()
    scope.setActiveTarget('/pages/home/index')
    expect(scope.activeTargetPath).toBe('/pages/home/index')
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'page' }, '/pages/home/index')).toBe(false)
    scope.endManaged()
    expect(scope.activeTargetPath).toBeUndefined()
  })

  it('suppresses the echo of a managed navigation that just settled', () => {
    const scope = createNavigationScope()
    scope.beginManaged()
    scope.setActiveTarget('/pages/other/index')
    scope.markManagedEcho('/pages/other/index')
    scope.endManaged()
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'page' }, '/pages/home/index')).toBe(false)
    expect(scope.acceptExternalSync(createRoute('/pages/third/index'), { source: 'page' }, '/pages/home/index')).toBe(true)
  })

  it('accepts a page switch once and dedupes concurrent external syncs', () => {
    const scope = createNavigationScope()
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'page' }, '/pages/home/index')).toBe(true)
    expect(scope.acceptExternalSync(createRoute('/pages/third/index'), { source: 'page' }, '/pages/home/index')).toBe(false)
    scope.completeExternalSync()
    expect(scope.acceptExternalSync(createRoute('/pages/third/index'), { source: 'page' }, '/pages/home/index')).toBe(true)
  })

  it('ignores router originated sync and unchanged positions', () => {
    const scope = createNavigationScope()
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'router' }, '/pages/home/index')).toBe(false)
    expect(scope.acceptExternalSync(createRoute('/pages/home/index'), { source: 'page' }, '/pages/home/index')).toBe(false)
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'native', method: 'navigateTo' }, '/pages/home/index')).toBe(false)
    expect(scope.acceptExternalSync(createRoute('/pages/other/index'), { source: 'native', method: 'navigateBack' }, '/pages/home/index')).toBe(true)
  })
})

describe('route state publisher', () => {
  it('broadcasts the published position when syncing with native', () => {
    const handler = vi.fn()
    const unregister = registerRouteStateSyncHandler(handler)
    const route = createRoute('/pages/home/index?q=1')
    publishRouteState({ syncWithNative: true, updateRoute: vi.fn(), route })
    expect(handler).toHaveBeenCalledWith({ route, source: 'router' })
    unregister()
  })

  it('updates the local snapshot only when the driver owns its own state', () => {
    const handler = vi.fn()
    const unregister = registerRouteStateSyncHandler(handler)
    const updateRoute = vi.fn()
    const route = createRoute('/pages/home/index?q=1')
    publishRouteState({ syncWithNative: false, updateRoute, route })
    expect(updateRoute).toHaveBeenCalledWith(route)
    expect(handler).not.toHaveBeenCalled()
    unregister()
  })

  it('lets subscribers re-read the current position when no target is published', () => {
    const handler = vi.fn()
    const unregister = registerRouteStateSyncHandler(handler)
    publishRouteState({ syncWithNative: true, updateRoute: vi.fn() })
    expect(handler).toHaveBeenCalledWith(undefined)
    unregister()
  })
})

describe('route state broadcast contract', () => {
  it('keeps subscriber exceptions from breaking the broadcast', () => {
    const failing = registerRouteStateSyncHandler(() => {
      throw new Error('subscriber failed')
    })
    const received = vi.fn()
    const unregister = registerRouteStateSyncHandler(received)
    expect(() => notifyRouteStateSync({ source: 'router' })).not.toThrow()
    expect(received).toHaveBeenCalled()
    failing()
    unregister()
  })
})
