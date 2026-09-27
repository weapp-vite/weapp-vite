import type { ScrollRestorationController } from '@/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollRestoration } from '@/router'
import { ensureInitialNavigation, getInitialNavigationPromise } from '@/router/initialNavigation'
import { clearActiveRouter } from '@/router/instance'
import { createScrollHost, deferred, flushScrollJobs, setupScroll } from './helpers/scrollHost'

const controllers: ScrollRestorationController[] = []
function createHost() {
  const host = createScrollHost()
  controllers.push(host.controller)
  return host
}

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose()
  }
  clearActiveRouter()
  vi.unstubAllGlobals()
})

describe('native route and render completion', () => {
  it.each([true, false])('waits for eager initial guards and honors their allowed=%s result', async (allowed) => {
    const h = createHost()
    const guard = deferred()
    h.router.beforeEach(async () => {
      await guard.promise
      return allowed
    })
    const page = h.makePage()
    const event = h.begin(page)
    ensureInitialNavigation(page)
    const restore = vi.fn()
    setupScroll(page, () => useScrollRestoration({ capture: () => ({ top: 0 }), restore }))
    h.arrive(page, event)
    await flushScrollJobs()
    expect(restore).not.toHaveBeenCalled()
    guard.resolve()
    await getInitialNavigationPromise(page)
    await flushScrollJobs()
    expect(restore).toHaveBeenCalledTimes(allowed ? 1 : 0)
  })

  it('waits for logical route, own/page ready and render acknowledgment, deduplicating completion', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    const committed = deferred()
    const restore = vi.fn()
    setupScroll(page, () => useScrollRestoration({ capture: () => ({ top: 0 }), restore }), () => committed.promise)
    h.emit('AppRouteDone', event)
    h.emit('AppRoute', event)
    h.emit('AppRoute', event)
    h.emit('AppRouteDone', event)
    await flushScrollJobs()
    expect(restore).not.toHaveBeenCalled()
    h.ready(page)
    await flushScrollJobs()
    expect(restore).not.toHaveBeenCalled()
    committed.resolve()
    await flushScrollJobs()
    expect(restore).toHaveBeenCalledTimes(1)
    h.emit('AppRouteDone', event)
    h.ready(page)
    await flushScrollJobs()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('does not confuse a child component readiness with the page readiness', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    const child = { __wxWebviewId__: page.__wxWebviewId__ }
    const restore = vi.fn()
    setupScroll(child, () => useScrollRestoration({ capture: () => ({ top: 0 }), restore }))
    h.ready(child)
    h.emit('AppRoute', event)
    h.emit('AppRouteDone', event)
    await flushScrollJobs()
    expect(restore).not.toHaveBeenCalled()
    h.ready(page)
    await flushScrollJobs()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('invalidates pending commit and ignores the old done event after a newer navigation', async () => {
    const h = createHost()
    const first = h.makePage({ id: '1' })
    const firstEvent = h.begin(first)
    const committed = deferred()
    const firstRestore = vi.fn()
    const { value: firstHandle } = setupScroll(first, () => useScrollRestoration({ manual: true, capture: () => ({ top: 0 }), restore: firstRestore }), () => committed.promise)
    h.arrive(first, firstEvent)
    const pending = firstHandle.scroll()
    await flushScrollJobs()
    const second = h.makePage({ id: '2' })
    const secondEvent = h.begin(second)
    const secondRestore = vi.fn()
    setupScroll(second, () => useScrollRestoration({ capture: () => ({ top: 0 }), restore: secondRestore }))
    h.emit('AppRoute', secondEvent)
    h.ready(second)
    h.emit('AppRouteDone', firstEvent)
    committed.resolve()
    expect(await pending).toBe(false)
    expect(firstRestore).not.toHaveBeenCalled()
    expect(secondRestore).not.toHaveBeenCalled()
    h.emit('AppRouteDone', secondEvent)
    await flushScrollJobs()
    expect(secondRestore).toHaveBeenCalledTimes(1)
  })

  it('correlates an empty native completion id only with the fresh accepted webview', async () => {
    const h = createHost()
    const first = h.makePage()
    const firstEvent = h.begin(first, 'reLaunch')
    setupScroll(first, () => useScrollRestoration({ manual: true, capture: () => ({ top: 420 }), restore: () => {} }))
    h.arrive(first, firstEvent)
    const second = h.makePage()
    const event = h.begin(second, 'reLaunch')
    let visibleTop = 0
    const restore = vi.fn((saved: { top: number } | undefined) => {
      visibleTop = saved?.top ?? 0
    })
    setupScroll(second, () => useScrollRestoration({ capture: () => ({ top: visibleTop }), restore }))
    h.emit('AppRoute', event)
    h.ready(second)
    for (const completion of [
      { ...firstEvent, routeEventId: '' },
      { ...event, routeEventId: firstEvent.routeEventId },
      { ...event, routeEventId: '', webviewId: undefined },
      { ...event, routeEventId: '', path: 'pages/other/index' },
      { ...event, routeEventId: '', openType: 'navigateBack' },
    ]) {
      h.emit('AppRouteDone', completion)
    }
    await flushScrollJobs()
    expect(visibleTop).toBe(0)
    expect(restore).not.toHaveBeenCalled()
    h.emit('AppRouteDone', { ...event, routeEventId: '' })
    await flushScrollJobs()
    expect(visibleTop).toBe(420)
    expect(restore).toHaveBeenCalledWith({ top: 420 }, expect.objectContaining({ routeEventId: event.routeEventId }))
    h.emit('AppRouteDone', { ...event, routeEventId: '' })
    await flushScrollJobs()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('releases a manual wait on hide even if the retained page never becomes ready', async () => {
    const h = createHost()
    const first = h.makePage()
    const event = h.begin(first)
    const { value: handle } = setupScroll(first, () => useScrollRestoration({ manual: true, capture: () => ({ top: 0 }), restore: () => {} }))
    h.emit('AppRoute', event)
    const pending = handle.scroll()
    h.begin(h.makePage({ id: 'next' }), 'navigateTo')
    expect(await pending).toBe(false)
  })

  it('exposes invalidation to custom asynchronous restorers on clear and stop', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    let resumed = deferred()
    let visibleTop = 23
    const { value: handle } = setupScroll(page, () => useScrollRestoration({
      manual: true,
      capture: () => ({ top: visibleTop }),
      async restore(_snapshot, context) {
        await resumed.promise
        if (context.isActive()) {
          visibleTop = 999
        }
      },
    }))
    h.arrive(page, event)
    const cleared = handle.scroll()
    await flushScrollJobs()
    handle.clear()
    resumed.resolve()
    expect(await cleared).toBe(false)
    resumed = deferred()
    const stopped = handle.scroll()
    await flushScrollJobs()
    handle.stop()
    resumed.resolve()
    expect(await stopped).toBe(false)
    expect(visibleTop).toBe(23)
  })

  it('reports automatic failures but rejects an explicit restore failure', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    const failure = new Error('missing virtual list anchor')
    const { value: handle } = setupScroll(page, () => useScrollRestoration({
      capture: () => {
        throw new Error('capture failed')
      },
      restore: () => {
        throw failure
      },
    }))
    h.arrive(page, event)
    await flushScrollJobs()
    expect(h.errors).toEqual([failure])
    await expect(handle.scroll()).rejects.toBe(failure)
    h.begin(h.makePage({ id: 'next' }))
    expect(h.errors).toEqual([failure, new Error('capture failed')])
  })
})
