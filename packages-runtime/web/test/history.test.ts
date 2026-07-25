import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import {
  configureWebRouting,
  disposeWebRouting,
  getWebHistoryStack,
  getWebRoutingConfig,
  readWebRouteTarget,
  resolveWebRoutingConfig,
  syncWebRouting,
} from '../src/runtime/polyfill/routeRuntime/history'

interface FakeWindow {
  location: Location
  history: History
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  listeners?: Map<string, Set<() => void>>
}

function createFakeWindow(initialUrl: string) {
  let currentUrl = new URL(initialUrl)
  let state: unknown
  const listeners = new Map<string, Set<() => void>>()
  const location = {
    get href() {
      return currentUrl.href
    },
    get pathname() {
      return currentUrl.pathname
    },
    get search() {
      return currentUrl.search
    },
    get hash() {
      return currentUrl.hash
    },
  } as Location
  const history = {
    get state() {
      return state
    },
    pushState(nextState: unknown, _title: string, nextUrl: string) {
      state = nextState
      currentUrl = new URL(nextUrl, currentUrl)
    },
    replaceState(nextState: unknown, _title: string, nextUrl: string) {
      state = nextState
      currentUrl = new URL(nextUrl, currentUrl)
    },
  } as History
  const fakeWindow: FakeWindow = {
    location,
    history,
    listeners,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set()
      bucket.add(listener)
      listeners.set(type, bucket)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
  }
  return { fakeWindow, listeners }
}

function withWindow(fakeWindow: FakeWindow, callback: () => void) {
  const previous = (globalThis as Record<string, unknown>).window
  Object.assign(globalThis, { window: fakeWindow })
  try {
    callback()
  }
  finally {
    disposeWebRouting()
    if (previous === undefined) {
      delete (globalThis as Record<string, unknown>).window
    }
    else {
      Object.assign(globalThis, { window: previous })
    }
  }
}

function entry(id: string, query: Record<string, string> = {}): PageStackEntry {
  return { id, query, active: true }
}

describe('web runtime browser routing', () => {
  it('normalizes routing mode and deployment base', () => {
    expect(resolveWebRoutingConfig()).toEqual({ mode: 'memory', base: '/' })
    expect(resolveWebRoutingConfig({ mode: 'history', base: ' /mini/ ' })).toEqual({
      mode: 'history',
      base: '/mini',
    })
    expect(getWebRoutingConfig()).toEqual({ mode: 'memory', base: '/' })
  })

  it('reads a history deep link and replaces the initial entry', () => {
    const { fakeWindow } = createFakeWindow('https://example.test/mini/pages/detail/index?sku=42')
    withWindow(fakeWindow, () => {
      const onPopState = vi.fn()
      configureWebRouting({ mode: 'history', base: '/mini' }, [
        'pages/index/index',
        'pages/detail/index',
      ], onPopState)
      expect(readWebRouteTarget(['pages/index/index', 'pages/detail/index'])).toEqual({
        id: 'pages/detail/index',
        query: { sku: '42' },
      })
      syncWebRouting([entry('pages/detail/index', { sku: '42' })], 'replace')
      expect(fakeWindow.location.pathname).toBe('/mini/pages/detail/index')
      expect(fakeWindow.location.search).toBe('?sku=42')
      expect(getWebHistoryStack(fakeWindow.history.state)).toEqual([
        { id: 'pages/detail/index', query: { sku: '42' } },
      ])
      fakeWindow.listeners?.get('popstate')?.forEach(listener => listener())
      expect(onPopState).toHaveBeenCalledWith(
        { id: 'pages/detail/index', query: { sku: '42' } },
        fakeWindow.history.state,
      )
    })
  })

  it('supports hash routing for static hosting and cleans listeners', () => {
    const { fakeWindow, listeners } = createFakeWindow('https://example.test/mini/#/pages/index/index')
    withWindow(fakeWindow, () => {
      configureWebRouting({ mode: 'hash', base: '/mini' }, ['pages/index/index'], vi.fn())
      expect(readWebRouteTarget(['pages/index/index'])).toEqual({
        id: 'pages/index/index',
        query: {},
      })
      syncWebRouting([entry('pages/index/index')], 'push')
      expect(fakeWindow.location.hash).toBe('#/pages/index/index')
      expect(listeners.get('popstate')?.size).toBe(1)
      expect(listeners.get('hashchange')?.size).toBe(1)
    })
    expect(listeners.get('popstate')?.size).toBe(0)
    expect(listeners.get('hashchange')?.size).toBe(0)
  })
})
