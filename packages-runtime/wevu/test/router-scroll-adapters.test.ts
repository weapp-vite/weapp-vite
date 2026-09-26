import type { ScrollRestorationController } from '@/router'
import type { ScrollPage } from '@/router/scrollRestoration/host'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onPageScroll } from '@/index'
import { watch } from '@/reactivity'
import { usePageScrollRestoration, useScrollViewRestoration } from '@/router'
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

describe('explicit scroll adapters', () => {
  it('caches scroll-view events without reactive writes and restores repeated targets', async () => {
    const h = createHost()
    const first = h.makePage()
    const firstEvent = h.begin(first)
    const { value: firstView } = setupScroll(first, () => useScrollViewRestoration())
    h.arrive(first, firstEvent)
    await flushScrollJobs()
    firstView.onScroll({ detail: { scrollTop: 140, scrollLeft: 35 } })
    expect([firstView.scrollTop.value, firstView.scrollLeft.value]).toEqual([0, 0])

    const page = h.makePage()
    const event = h.begin(page)
    const { value: view } = setupScroll(page, () => useScrollViewRestoration())
    h.arrive(page, event)
    await flushScrollJobs()
    expect([view.scrollTop.value, view.scrollLeft.value]).toEqual([140, 35])
    const moves: number[] = []
    const stop = watch(() => view.scrollTop.value, top => moves.push(top), { flush: 'sync' })
    view.onScroll({ detail: { scrollTop: 500, scrollLeft: 60 } })
    expect(moves).toEqual([])
    expect(await view.scroll()).toBe(true)
    expect(moves).toEqual([500, 140])
    expect(view.scrollLeft.value).toBe(35)
    stop()
  })

  it('does not issue the target position when leaving during the baseline render commit', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    const baseline = deferred()
    let commits = 0
    const { value: view } = setupScroll(page, () => useScrollViewRestoration({ manual: true }), () => {
      commits++
      return commits === 2 ? baseline.promise : Promise.resolve()
    })
    h.arrive(page, event)
    view.onScroll({ detail: { scrollTop: 400, scrollLeft: 10 } })
    const pending = view.scroll()
    await flushScrollJobs()
    expect(view.scrollTop.value).toBe(400)
    h.begin(h.makePage({ id: 'next' }))
    baseline.resolve()
    expect(await pending).toBe(false)
    expect(view.scrollTop.value).toBe(400)
  })

  it('restores the WebView page from the latest page-scroll event with no animation', async () => {
    const h = createHost()
    const first = h.makePage()
    const firstEvent = h.begin(first)
    setupScroll(first, () => usePageScrollRestoration())
    h.arrive(first, firstEvent)
    await flushScrollJobs()
    first.onPageScroll!({ scrollTop: 190 })
    const page = h.makePage()
    const event = h.begin(page)
    setupScroll(page, () => usePageScrollRestoration())
    h.arrive(page, event)
    await flushScrollJobs()
    expect(h.api.pageScrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ scrollTop: 190, duration: 0 }))
    expect(h.errors).toEqual([])
  })

  it('captures in manual mode when setup runs before the host publishes the page', async () => {
    const h = createHost()
    const first = h.makePage()
    setupScroll(first, () => usePageScrollRestoration({ manual: true }))
    h.hook(first, 'onAttached')
    const firstEvent = h.begin(first)
    h.hook(first, 'onShow')
    h.emit('AppRoute', firstEvent)
    h.ready(first)
    h.emit('AppRouteDone', firstEvent)
    first.onPageScroll!({ scrollTop: 287 })
    expect(h.api.pageScrollTo).not.toHaveBeenCalled()

    const page = h.makePage()
    const event = h.begin(page)
    const { value: handle } = setupScroll(page, () => usePageScrollRestoration({ manual: true }))
    h.arrive(page, event)
    expect(await handle.scroll()).toBe(true)
    expect(h.api.pageScrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ scrollTop: 287, duration: 0 }))
  })

  it.each([false, true])('receives native Component page scrolling exactly once with composition=%s', async (composition) => {
    const h = createHost()
    interface PageDefinition {
      methods: { onPageScroll: (this: ScrollPage, event: { scrollTop: number }) => void }
      lifetimes: {
        attached: (this: ScrollPage) => void
        detached: (this: ScrollPage) => void
      }
    }
    let definition!: PageDefinition
    vi.stubGlobal('Component', (options: PageDefinition) => {
      definition = options
    })
    const optionsScroll = vi.fn()
    const compositionScroll = vi.fn()
    defineComponent({
      __wevu_isPage: true,
      features: { enableOnPageScroll: true },
      onPageScroll: optionsScroll,
      setup() {
        if (composition) {
          onPageScroll(compositionScroll)
        }
        usePageScrollRestoration({ manual: true })
      },
    })
    const first = h.makePage()
    const firstEvent = h.begin(first)
    // 微信只注册 Component.methods 中的页面滚动方法；动态添加实例方法不足以接收宿主事件。
    first.onPageScroll = definition.methods.onPageScroll.bind(first)
    definition.lifetimes.attached.call(first)
    h.emit('AppRoute', firstEvent)
    h.ready(first)
    h.emit('AppRouteDone', firstEvent)
    first.onPageScroll({ scrollTop: 250 })
    expect(optionsScroll.mock.calls).toEqual(composition ? [] : [[{ scrollTop: 250 }]])
    expect(compositionScroll.mock.calls).toEqual(composition ? [[{ scrollTop: 250 }]] : [])

    const recreated = h.makePage()
    const event = h.begin(recreated)
    definition.lifetimes.detached.call(first)
    const { value: handle } = setupScroll(recreated, () => usePageScrollRestoration({ manual: true }))
    h.arrive(recreated, event)
    expect(await handle.scroll()).toBe(true)
    expect(h.api.pageScrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ scrollTop: 250, duration: 0 }))
    expect(h.errors).toEqual([])
  })

  it('reports an unsupported Skyline page target rather than pretending it has a window scroll', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    event.renderer = 'skyline'
    setupScroll(page, () => usePageScrollRestoration())
    h.arrive(page, event)
    await flushScrollJobs()
    expect(h.api.pageScrollTo).not.toHaveBeenCalled()
    expect(h.errors).toEqual([expect.objectContaining({ message: expect.stringContaining('Skyline') })])
  })
})
