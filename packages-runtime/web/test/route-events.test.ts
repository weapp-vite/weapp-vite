// @vitest-environment happy-dom

import type { ScrollRestorationHandle } from 'wevu/router'
import type { ComponentPublicInstance } from '../src/runtime/component'
import type { AppRouteEvent, BeforePageUnloadEvent } from '../src/runtime/polyfill/routeRuntime/events'
import { WEVU_HOST_COMMIT_PROMISE_KEY, WEVU_PAGE_SCROLL_RESTORATION_OWNER_KEY, WEVU_ROUTE_EVENT_CONTRACT_KEY } from '@weapp-core/constants'
import { html } from 'lit'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { onHide, onPageScroll, onShow, onUnload } from 'wevu'
import { createRouter, createScrollRestoration, usePageScrollRestoration } from 'wevu/router'
import {
  getAppBaseInfo,
  initializePageRoutes,
  installMiniProgramGlobals,
  navigateBack,
  navigateTo,
  offAppRoute,
  offAppRouteDone,
  offBeforeAppRoute,
  offBeforePageUnload,
  onAppRoute,
  onAppRouteDone,
  onBeforeAppRoute,
  onBeforePageUnload,
  pageScrollTo,
  redirectTo,
  registerPage,
  reLaunch,
  switchTab,
} from '../src/runtime/polyfill'
import { getCurrentPagesInternal } from '../src/runtime/polyfill/routeRuntime'
import { disposeWebRouting } from '../src/runtime/polyfill/routeRuntime/history'
import { disposePageScrollOwner } from '../src/runtime/polyfill/routeRuntime/scroll'
import { registerWebWevuComponent } from '../src/runtime/wevu'

const ids = ['pages/route-home', 'pages/route-detail', 'pages/route-settings']
const [home, detail, settings] = ids as [string, string, string]
const trace: string[] = []
const scrollEvents: Array<{ page: ComponentPublicInstance, scrollTop: number }> = []
const claimedPages = new Set<string>()
const releases = new WeakMap<object, () => void>()
const host: {
  [WEVU_PAGE_SCROLL_RESTORATION_OWNER_KEY]?: (page: object) => () => void
  [WEVU_ROUTE_EVENT_CONTRACT_KEY]?: number
  pageScrollTo?: typeof pageScrollTo
} = {}
const tabBar = {
  color: '#777',
  selectedColor: '#333',
  backgroundColor: '#fff',
  borderStyle: 'black' as const,
  position: 'bottom' as const,
  custom: false,
  list: [{ pagePath: home, text: 'Home' }, { pagePath: settings, text: 'Settings' }],
}

function currentPage() {
  return getCurrentPagesInternal().at(-1)!
}

async function route(action: () => unknown): Promise<AppRouteEvent> {
  let receive!: (event: AppRouteEvent) => void
  const done = new Promise<AppRouteEvent>((resolve) => {
    receive = resolve
  })
  onAppRouteDone(receive)
  try {
    await action()
    return await done
  }
  finally {
    offAppRouteDone(receive)
  }
}

function observe() {
  const before: AppRouteEvent[] = []
  const after: AppRouteEvent[] = []
  const done: AppRouteEvent[] = []
  const unload: BeforePageUnloadEvent[] = []
  onBeforeAppRoute((event) => {
    before.push(event)
    trace.push('before')
  })
  onAppRoute((event) => {
    after.push(event)
    trace.push('after')
  })
  onAppRouteDone((event) => {
    done.push(event)
    trace.push('done')
  })
  onBeforePageUnload((event) => {
    unload.push(event)
    trace.push('unload-before')
  })
  return { before, after, done, unload }
}

beforeAll(() => {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  vi.stubGlobal('wx', host)
  installMiniProgramGlobals()
  for (const id of ids) {
    registerPage({
      data: { status: 'loading' },
      onLoad(this: ComponentPublicInstance) {
        trace.push(`load:${id}`)
        if (claimedPages.has(id)) {
          releases.set(this, host[WEVU_PAGE_SCROLL_RESTORATION_OWNER_KEY]!(this))
          void pageScrollTo({ scrollTop: 123, duration: 0 })
        }
      },
      onReady(this: ComponentPublicInstance) {
        trace.push(`ready:${id}`)
        void this.setData({ status: 'committed' })
      },
      onHide() {
        trace.push(`hide:${id}`)
      },
      onUnload(this: ComponentPublicInstance) {
        trace.push(`unload:${id}`)
        releases.get(this)?.()
      },
      onPageScroll(this: ComponentPublicInstance, event: { scrollTop: number }) {
        scrollEvents.push({ page: this, scrollTop: event.scrollTop })
      },
    }, { id, template: scope => html`<p>${scope.status}</p>` })
  }
})

afterEach(() => {
  offBeforeAppRoute()
  offBeforePageUnload()
  offAppRoute()
  offAppRouteDone()
  claimedPages.clear()
  trace.length = 0
  scrollEvents.length = 0
})

afterAll(() => {
  disposeWebRouting()
  disposePageScrollOwner()
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('native Web route observations', () => {
  it('ties launch, push, replace, back and relaunch to native instances and committed readiness', async () => {
    const events = observe()
    const launched = await route(() => initializePageRoutes(ids, { tabBar }))
    expect(getAppBaseInfo().SDKVersion).toBe('web')
    expect(host[WEVU_ROUTE_EVENT_CONTRACT_KEY]).toBe(1)
    expect(launched).toMatchObject({ openType: 'appLaunch', path: home, page: currentPage(), renderer: 'webview' })
    expect(events.before[0]?.routeEventId).toBe(launched.routeEventId)
    expect(events.after[0]?.routeEventId).toBe(launched.routeEventId)
    expect(launched.page).toMatchObject({ webviewId: launched.webviewId })
    const launchedElement = document.querySelector<HTMLElement>(`[data-weapp-page="${home}"]`)!
    expect(launchedElement.shadowRoot?.querySelector('p')?.textContent).toBe('committed')
    expect(trace).toEqual(['before', `load:${home}`, 'after', `ready:${home}`, 'done'])

    trace.length = 0
    const pushed = await route(() => navigateTo({ url: `/${detail}?sku=42` }))
    expect(pushed).toMatchObject({ openType: 'navigateTo', path: detail, query: { sku: '42' }, page: currentPage() })
    expect(trace).toEqual(['before', `hide:${home}`, `load:${detail}`, 'after', `ready:${detail}`, 'done'])
    expect(pushed.webviewId).not.toBe(launched.webviewId)

    const outgoing = currentPage()
    const outgoingElement = document.querySelector<HTMLElement>('[data-weapp-page-active="true"]')!
    const outgoingStates: boolean[] = []
    onBeforePageUnload(() => outgoingStates.push(outgoingElement.isConnected))
    trace.length = 0
    const replaced = await route(() => redirectTo({ url: `/${detail}?sku=43` }))
    expect(events.unload.at(-1)).toMatchObject({ routeEventId: replaced.routeEventId, page: outgoing, webviewId: pushed.webviewId })
    expect(outgoingStates).toEqual([true])
    expect(outgoingElement.isConnected).toBe(false)
    expect(trace.indexOf('unload-before')).toBeLessThan(trace.indexOf(`unload:${detail}`))
    expect(replaced.webviewId).not.toBe(pushed.webviewId)
    expect(replaced.openType).toBe('redirectTo')

    const back = await route(() => navigateBack())
    expect(back).toMatchObject({ openType: 'navigateBack', page: launched.page, webviewId: launched.webviewId })
    const relaunched = await route(() => reLaunch({ url: `/${home}` }))
    expect(relaunched.openType).toBe('reLaunch')
    expect(relaunched.page).not.toBe(launched.page)
    expect(events.before.map(event => event.routeEventId)).toEqual(events.done.map(event => event.routeEventId))
    expect(new Set(events.done.map(event => event.routeEventId)).size).toBe(5)
  })

  it('uses one owner for tab clicks and browser back, retaining page instances and scroll positions', async () => {
    initializePageRoutes(ids, { tabBar, runtime: { routing: { mode: 'hash' } } })
    const first = await route(() => reLaunch({ url: `/${home}` }))
    const state = window.history.state
    const url = window.location.href
    await pageScrollTo({ scrollTop: 81, duration: 0 })
    const events = observe()
    const switched = await route(() => {
      document.querySelector('weapp-tab-bar')!.shadowRoot!.querySelector<HTMLButtonElement>(`button[data-page-path="${settings}"]`)!.click()
    })
    expect(switched.openType).toBe('switchTab')
    await pageScrollTo({ scrollTop: 24, duration: 0 })
    const returned = await route(() => {
      window.history.replaceState(state, '', url)
      window.dispatchEvent(new PopStateEvent('popstate', { state }))
      window.dispatchEvent(new Event('hashchange'))
    })
    expect(returned).toMatchObject({ openType: 'switchTab', page: first.page, webviewId: first.webviewId })
    expect(document.querySelector<HTMLElement>('#app')!.scrollTop).toBe(81)
    expect(events.before).toHaveLength(2)
    expect(events.done).toHaveLength(2)

    const homeState = window.history.state
    await route(() => navigateTo({ url: `/${detail}` }))
    const back = await route(() => {
      window.history.replaceState(homeState, '', url)
      window.dispatchEvent(new PopStateEvent('popstate', { state: homeState }))
      window.dispatchEvent(new Event('hashchange'))
    })
    expect(back).toMatchObject({ openType: 'navigateBack', page: first.page, webviewId: first.webviewId })
    expect(events.before).toHaveLength(4)
    expect(events.done).toHaveLength(4)

    const forward = await route(() => {
      const forwardState = {
        __weappWebRuntime: {
          stack: [
            { id: home, query: {}, webviewId: first.webviewId },
            { id: detail, query: { forward: '1' } },
            { id: settings, query: { forward: '2' } },
          ],
        },
      }
      window.history.replaceState(forwardState, '', `/#/${settings}?forward=2`)
      window.dispatchEvent(new PopStateEvent('popstate', { state: forwardState }))
      window.dispatchEvent(new Event('hashchange'))
    })
    expect(forward).toMatchObject({ openType: 'navigateTo', path: settings, query: { forward: '2' } })
    expect(getCurrentPagesInternal()).toEqual(ids.map(route => expect.objectContaining({ route })))
    expect(events.before).toHaveLength(5)
    expect(events.done).toHaveLength(5)
  })

  it.each(['hash', 'history'] as const)('switches to a retained underlying tab and synchronizes %s routing while unloading the pages above it', async (mode) => {
    initializePageRoutes(ids, { tabBar, runtime: { routing: { mode } } })
    const first = await route(() => reLaunch({ url: `/${home}` }))
    const homeUrl = window.location.href
    await pageScrollTo({ scrollTop: 144, duration: 0 })
    const pushed = await route(() => navigateTo({ url: `/${detail}` }))
    const detailElement = document.querySelector<HTMLElement>(`[data-weapp-page="${detail}"]`)!
    await pageScrollTo({ scrollTop: 29, duration: 0 })
    const historyLength = window.history.length
    const events = observe()
    const returned = await route(() => switchTab({ url: `/${home}` }))

    expect(returned).toMatchObject({ openType: 'switchTab', page: first.page, webviewId: first.webviewId })
    expect(getCurrentPagesInternal()).toEqual([first.page])
    expect(detailElement.isConnected).toBe(false)
    expect(document.querySelector<HTMLElement>('#app')!.scrollTop).toBe(144)
    expect(events.before.map(event => event.routeEventId)).toEqual([returned.routeEventId])
    expect(events.after.map(event => event.routeEventId)).toEqual([returned.routeEventId])
    expect(events.done.map(event => event.routeEventId)).toEqual([returned.routeEventId])
    expect(events.unload).toEqual([expect.objectContaining({ routeEventId: returned.routeEventId, page: pushed.page })])
    expect(window.history.length).toBe(historyLength + 1)
    expect(window.history.state.__weappWebRuntime.stack).toEqual([{ id: home, query: {}, webviewId: first.webviewId }])
    expect(window.location.href).toBe(homeUrl)
  })

  it('suppresses only claimed fresh resets while pageScrollTo and retained activation share the existing owner', async () => {
    await route(() => reLaunch({ url: `/${home}` }))
    claimedPages.add(detail)
    const claimed = await route(() => navigateTo({ url: `/${detail}` }))
    const container = document.querySelector<HTMLElement>('#app')!
    expect(container.scrollTop).toBe(123)
    await pageScrollTo({ scrollTop: 160, duration: 0 })
    expect(scrollEvents.at(-1)).toEqual({ page: claimed.page, scrollTop: 160 })
    container.scrollTop = 175
    container.dispatchEvent(new Event('scroll'))
    expect(scrollEvents.at(-1)).toEqual({ page: claimed.page, scrollTop: 175 })
    await route(() => navigateTo({ url: `/${settings}` }))
    expect(container.scrollTop).toBe(0)
    await pageScrollTo({ scrollTop: 12, duration: 0 })
    const retained = await route(() => navigateBack())
    expect(retained.page).toBe(claimed.page)
    expect(container.scrollTop).toBe(175)
    claimedPages.clear()
    await route(() => redirectTo({ url: `/${detail}` }))
    expect(container.scrollTop).toBe(0)
  })

  it('emits no success stages for rejected navigation and removes individual or all listeners', async () => {
    await route(() => reLaunch({ url: `/${home}` }))
    const events = observe()
    for (const action of [navigateTo, redirectTo, reLaunch, switchTab]) {
      await expect(action({ url: '/pages/not-registered' })).rejects.toMatchObject({ errMsg: expect.stringContaining(':fail') })
    }
    await expect(navigateBack()).rejects.toMatchObject({ errMsg: expect.stringContaining(':fail') })
    expect(events).toEqual({ before: [], after: [], done: [], unload: [] })
    const removed = vi.fn()
    onBeforeAppRoute(removed)
    onBeforePageUnload(removed)
    onAppRoute(removed)
    onAppRouteDone(removed)
    offBeforeAppRoute(removed)
    offBeforePageUnload(removed)
    offAppRoute(removed)
    offAppRouteDone(removed)
    await route(() => redirectTo({ url: `/${detail}` }))
    expect(removed).not.toHaveBeenCalled()
    expect(events.done).toHaveLength(1)
    offBeforeAppRoute()
    offBeforePageUnload()
    offAppRoute()
    offAppRouteDone()
    await route(() => redirectTo({ url: `/${home}` }))
    expect(events.before).toHaveLength(1)
    expect(events.unload).toHaveLength(1)
    expect(events.after).toHaveLength(1)
    expect(events.done).toHaveLength(1)
  })

  it('waits for real mounting and never mounts or completes a destroyed pending destination', async () => {
    await route(() => reLaunch({ url: `/${home}` }))
    const events = observe()
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    try {
      await navigateTo({ url: `/${detail}` })
      expect(events.before).toHaveLength(1)
      expect(events.after).toHaveLength(0)
      expect(events.done).toHaveLength(0)
      await redirectTo({ url: `/${settings}` })
      const final = route(() => {
        readyState.mockReturnValue('complete')
        document.dispatchEvent(new Event('DOMContentLoaded'))
      })
      const event = await final
      expect(event).toMatchObject({ openType: 'redirectTo', path: settings })
      expect(events.after.map(item => item.path)).toEqual([settings])
      expect(events.done.map(item => item.routeEventId)).toEqual([events.before[1]!.routeEventId])
      expect(document.querySelector(`[data-weapp-page="${detail}"]`)).toBeNull()
    }
    finally {
      readyState.mockReturnValue('complete')
    }
  })

  it('does not relabel an old target when its commit finishes after a newer route', async () => {
    await route(() => reLaunch({ url: `/${home}` }))
    let commit!: () => void
    const pendingCommit = new Promise<void>((resolve) => {
      commit = resolve
    })
    const events = observe()
    onAppRoute((event) => {
      if (event.path === detail) {
        Object.defineProperty(event.page!, WEVU_HOST_COMMIT_PROMISE_KEY, { configurable: true, value: pendingCommit })
      }
    })
    await navigateTo({ url: `/${detail}` })
    const newer = await route(() => redirectTo({ url: `/${settings}` }))
    commit()
    await pendingCommit
    expect(events.done.map(event => event.routeEventId)).toEqual([newer.routeEventId])
    expect(events.done[0]?.page).toBe(currentPage())
  })

  it.each(['hash', 'history'] as const)('keeps redundant active-tab switches inert in %s routing and captures the latest scroll before recreation', async (mode) => {
    const scrollTab = `pages/route-scroll-tab-${mode}`
    const url = `/${scrollTab}?entry=initial`
    const lifecycle: string[] = []
    const errors: unknown[] = []
    const controller = createScrollRestoration({ router: createRouter(), onError: error => errors.push(error) })
    let restoration!: ScrollRestorationHandle
    registerWebWevuComponent({
      __wevu_isPage: true,
      setup() {
        restoration = usePageScrollRestoration({ controller, manual: true })
        onShow(() => lifecycle.push('show'))
        onHide(() => lifecycle.push('hide'))
        onUnload(() => lifecycle.push('unload'))
        return {}
      },
    }, { id: scrollTab, kind: 'page', template: () => html`<p>Scroll snapshot</p>` })
    initializePageRoutes([...ids, scrollTab], {
      tabBar: { ...tabBar, list: [...tabBar.list, { pagePath: scrollTab, text: 'Scroll' }] },
      runtime: { routing: { mode } },
    })
    try {
      const previous = await route(() => reLaunch({ url: `/${home}` }))
      const previousUrl = window.location.href
      const previousState = window.history.state
      const first = await route(() => switchTab({ url }))
      const firstRestoration = restoration
      const container = document.querySelector<HTMLElement>('#app')!
      expect(controller.automatic).toBe(true)
      expect(lifecycle).toEqual(['show'])
      lifecycle.length = 0
      await pageScrollTo({ scrollTop: 123, duration: 0 })
      const historyLength = window.history.length
      const historyState = window.history.state
      const historyUrl = window.location.href
      const success = vi.fn()
      const complete = vi.fn()
      const events = observe()

      for (let repeat = 0; repeat < 3; repeat++) {
        await expect(switchTab({ url: `/${scrollTab}?ignored=${repeat}`, success, complete })).resolves.toMatchObject({ errMsg: 'switchTab:ok' })
        expect(window.history.length).toBe(historyLength)
        expect(window.history.state).toBe(historyState)
        expect(window.location.href).toBe(historyUrl)
      }

      expect(events).toEqual({ before: [], after: [], done: [], unload: [] })
      expect(lifecycle).toEqual([])
      expect(getCurrentPagesInternal()).toEqual([first.page])
      expect(success).toHaveBeenCalledTimes(3)
      expect(complete).toHaveBeenCalledTimes(3)
      expect(historyState.__weappWebRuntime.stack).toEqual([{ id: scrollTab, query: { entry: 'initial' }, webviewId: first.webviewId }])
      expect(container.scrollTop).toBe(123)

      const back = await route(() => window.history.back())
      expect(back).toMatchObject({ openType: 'switchTab', page: previous.page, webviewId: previous.webviewId })
      expect(getCurrentPagesInternal()).toEqual([previous.page])
      expect(window.location.href).toBe(previousUrl)
      expect(window.history.state).toEqual(previousState)

      // happy-dom 的 replaceState 会截断 forward 栈；真实 Back/Forward 由 feature-1087 Web E2E 覆盖。
      const returned = await route(() => switchTab({ url }))
      expect(returned).toMatchObject({ openType: 'switchTab', page: first.page, webviewId: first.webviewId })
      expect(container.scrollTop).toBe(123)
      expect(window.location.href).toBe(historyUrl)
      lifecycle.length = 0
      events.before.length = 0
      events.after.length = 0
      events.done.length = 0
      events.unload.length = 0

      await pageScrollTo({ scrollTop: 287, duration: 0 })
      await route(() => navigateTo({ url: `/${detail}` }))
      const recreated = await route(() => reLaunch({ url }))
      expect(recreated.page).not.toBe(first.page)
      expect(restoration).not.toBe(firstRestoration)
      expect(await restoration.scroll()).toBe(true)
      expect(container.scrollTop).toBe(287)
      expect(lifecycle).toEqual(['hide', 'unload', 'show'])
      expect(events.before.map(event => event.openType)).toEqual(['navigateTo', 'reLaunch'])
      expect(events.after.map(event => event.routeEventId)).toEqual(events.before.map(event => event.routeEventId))
      expect(events.done.map(event => event.routeEventId)).toEqual(events.before.map(event => event.routeEventId))
      expect(errors).toEqual([])
    }
    finally {
      controller.dispose()
      await route(() => reLaunch({ url: `/${home}` }))
      initializePageRoutes(ids, { tabBar })
    }
  })

  it.each([
    { leave: false, duration: 0, requested: -40 },
    { leave: true, duration: 0, requested: 123 },
    { leave: true, duration: 1, requested: 123 },
  ])('notifies the originating page once through installed pageScrollTo (navigation: $leave, duration: $duration)', async ({ leave, duration, requested }) => {
    const source = `pages/scroll-api-source-${leave}-${duration}`
    const target = `pages/scroll-api-target-${leave}-${duration}`
    const actual = Math.max(0, requested)
    const notifications: Array<{ page: string, top: number }> = []
    const controller = createScrollRestoration({ router: createRouter() })
    let restoration!: ScrollRestorationHandle
    let navigate = leave
    registerWebWevuComponent({
      __wevu_isPage: true,
      setup() {
        restoration = usePageScrollRestoration({ controller, manual: true })
        onPageScroll((event) => {
          notifications.push({ page: 'source', top: event.scrollTop })
          if (navigate) {
            navigate = false
            void navigateTo({ url: `/${target}` })
          }
        })
        return {}
      },
    }, { id: source, kind: 'page', template: () => html`<p>Source scroll</p>` })
    registerWebWevuComponent({
      __wevu_isPage: true,
      setup() {
        onPageScroll(event => notifications.push({ page: 'target', top: event.scrollTop }))
        return {}
      },
    }, { id: target, kind: 'page', template: () => html`<p>Target scroll</p>` })
    initializePageRoutes([...ids, source, target], { tabBar })
    try {
      await route(() => reLaunch({ url: `/${source}` }))
      const scroll = () => host.pageScrollTo!({ scrollTop: requested, duration })
      if (leave) {
        await route(scroll)
      }
      else {
        await scroll()
      }
      expect(notifications).toEqual([{ page: 'source', top: actual }])
      if (leave) {
        await route(() => reLaunch({ url: `/${source}` }))
        expect(await restoration.scroll()).toBe(true)
        expect(document.querySelector<HTMLElement>('#app')!.scrollTop).toBe(actual)
      }
    }
    finally {
      controller.dispose()
      await route(() => reLaunch({ url: `/${home}` }))
      initializePageRoutes(ids, { tabBar })
    }
  })
})
