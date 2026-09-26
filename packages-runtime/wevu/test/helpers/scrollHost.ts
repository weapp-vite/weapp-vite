import type { ScrollPage, ScrollRouteEvent, ScrollRouteEventName } from '@/router/scrollRestoration/host'
import type { InternalRuntimeState } from '@/runtime/types'
import { WEVU_HOOKS_KEY, WEVU_READY_CALLED_KEY } from '@weapp-core/constants'
import { vi } from 'vitest'
import { effectScope } from '@/reactivity'
import { createRouter, createScrollRestoration } from '@/router'
import { resolvePageRoute } from '@/routerInternal/shared'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'

export function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export async function flushScrollJobs() {
  await new Promise<void>(resolve => setImmediate(resolve))
}

export function setupScroll<T>(page: ScrollPage, setup: () => T, commit: () => Promise<void> = async () => {}) {
  const scope = effectScope()
  setCurrentInstance(page as InternalRuntimeState)
  setCurrentSetupContext({ instance: page, proxy: { $nextTick: commit } })
  try {
    return { value: scope.run(setup)!, scope }
  }
  catch (error) {
    scope.stop()
    throw error
  }
  finally {
    setCurrentInstance(undefined)
    setCurrentSetupContext(undefined)
  }
}

export function createScrollHost(version = '3.5.5') {
  type Listener = (event: ScrollRouteEvent) => void
  const listeners: Record<ScrollRouteEventName, Set<Listener>> = {
    BeforeAppRoute: new Set(),
    BeforePageUnload: new Set(),
    AppRoute: new Set(),
    AppRouteDone: new Set(),
  }
  const pages: ScrollPage[] = []
  const errors: unknown[] = []
  let sequence = 0
  let pageSequence = 0
  const api = {
    getAppBaseInfo: () => ({ SDKVersion: version }),
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
    switchTab: vi.fn(),
    pageScrollTo: vi.fn((options: { scrollTop: number, duration: number, success: () => void }) => options.success()),
    ...Object.fromEntries(Object.entries(listeners).flatMap(([name, entries]) => [
      [`on${name}`, (listener: Listener) => entries.add(listener)],
      [`off${name}`, (listener: Listener) => entries.delete(listener)],
    ])),
  }
  vi.stubGlobal('wx', api)
  vi.stubGlobal('getCurrentPages', () => pages)
  const router = createRouter()
  const controller = createScrollRestoration({ router, onError: error => errors.push(error) })

  function emit(name: ScrollRouteEventName, event: ScrollRouteEvent) {
    for (const listener of listeners[name]) {
      listener(event)
    }
  }
  function hook(page: ScrollPage, name: string, ...args: unknown[]) {
    callHookList(page as InternalRuntimeState, name, args)
  }
  function makePage(query: Record<string, string> = {}, path = 'pages/list/index'): ScrollPage {
    return { route: path, options: query, __wxWebviewId__: ++pageSequence, [WEVU_HOOKS_KEY]: {} }
  }
  function begin(page: ScrollPage, openType = 'redirectTo') {
    const event: ScrollRouteEvent = {
      routeEventId: `route-${++sequence}`,
      path: page.route!,
      query: resolvePageRoute(page).query,
      openType,
      webviewId: Number(page.__wxWebviewId__),
      renderer: 'webview',
    }
    emit('BeforeAppRoute', event)
    const previous = pages.at(-1)
    if (previous) {
      hook(previous, 'onHide')
    }
    pages.splice(0, pages.length, page)
    return event
  }
  function ready(page: ScrollPage) {
    page[WEVU_READY_CALLED_KEY] = true
    hook(page, 'onReady')
  }
  function arrive(page: ScrollPage, event: ScrollRouteEvent) {
    hook(page, 'onAttached')
    hook(page, 'onShow')
    emit('AppRoute', event)
    ready(page)
    emit('AppRouteDone', event)
  }
  return { api, router, controller, pages, errors, listeners, emit, hook, makePage, begin, ready, arrive }
}
