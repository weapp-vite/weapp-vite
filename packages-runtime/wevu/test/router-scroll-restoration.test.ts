import type { ScrollRestorationController } from '@/router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollRestoration } from '@/router'
import { clearActiveRouter } from '@/router/instance'
import { createScrollHost, flushScrollJobs, setupScroll } from './helpers/scrollHost'

const controllers: ScrollRestorationController[] = []
function createHost(version?: string) {
  const host = createScrollHost(version)
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

describe('component scroll snapshots', () => {
  it('isolates query strings and named containers while capturing before hide', async () => {
    const h = createHost()
    const first = h.makePage({ id: '1' })
    const firstEvent = h.begin(first)
    let top = 140
    const restored: Array<[string, number | undefined]> = []
    setupScroll(first, () => {
      useScrollRestoration({ capture: () => ({ top }), restore: (value) => {
        restored.push(['main', value?.top])
      } })
      useScrollRestoration({ id: 'aside', capture: () => ({ top: 75 }), restore: (value) => {
        restored.push(['aside', value?.top])
      } })
    })
    h.arrive(first, firstEvent)
    await flushScrollJobs()
    restored.length = 0

    const second = h.makePage({ id: '2' })
    const secondEvent = h.begin(second)
    top = 999
    h.hook(first, 'onHide')
    setupScroll(second, () => useScrollRestoration({ capture: () => ({ top: 310 }), restore: (value) => {
      restored.push(['other-query', value?.top])
    } }))
    h.arrive(second, secondEvent)
    await flushScrollJobs()
    expect(restored).toEqual([['other-query', undefined]])

    const recreated = h.makePage({ id: '1' })
    const recreatedEvent = h.begin(recreated)
    setupScroll(recreated, () => {
      useScrollRestoration({ capture: () => ({ top: 0 }), restore: (value) => {
        restored.push(['main', value?.top])
      } })
      useScrollRestoration({ id: 'aside', capture: () => ({ top: 0 }), restore: (value) => {
        restored.push(['aside', value?.top])
      } })
    })
    h.arrive(recreated, recreatedEvent)
    await flushScrollJobs()
    expect(restored).toEqual([['other-query', undefined], ['main', 140], ['aside', 75]])
  })

  it('keeps retained instances untouched even when a new instance shares their cache key', async () => {
    const h = createHost()
    const first = h.makePage({ id: '1' })
    const firstEvent = h.begin(first)
    let firstTop = 40
    let firstRestores = 0
    const { value: firstHandle } = setupScroll(first, () => useScrollRestoration({
      key: route => route.path,
      capture: () => ({ top: firstTop }),
      restore: (value) => {
        firstRestores++
        firstTop = value?.top ?? 0
      },
    }))
    h.arrive(first, firstEvent)
    await flushScrollJobs()
    firstTop = 222

    const second = h.makePage({ id: '2' })
    const secondEvent = h.begin(second, 'navigateTo')
    setupScroll(second, () => useScrollRestoration({ key: route => route.path, capture: () => ({ top: 777 }), restore: () => {} }))
    h.arrive(second, secondEvent)
    await flushScrollJobs()
    const backEvent = h.begin(first, 'navigateBack')
    h.hook(first, 'onShow')
    h.emit('AppRoute', backEvent)
    h.emit('AppRouteDone', backEvent)
    await flushScrollJobs()
    expect({ firstTop, firstRestores }).toEqual({ firstTop: 222, firstRestores: 1 })
    expect(await firstHandle.scroll()).toBe(true)
    expect(firstTop).toBe(777)
  })

  it('clear removes only the named snapshot and leaves other registrations usable', async () => {
    const h = createHost()
    const old = h.makePage()
    const oldEvent = h.begin(old)
    setupScroll(old, () => {
      useScrollRestoration({ id: 'main', capture: () => ({ top: 120 }), restore: () => {} })
      useScrollRestoration({ id: 'sidebar', capture: () => ({ top: 60 }), restore: () => {} })
    })
    h.arrive(old, oldEvent)
    const page = h.makePage()
    const event = h.begin(page, 'reLaunch')
    const observed: Array<number | undefined> = []
    const { value: main } = setupScroll(page, () => useScrollRestoration({ id: 'main', manual: true, capture: () => ({ top: 20 }), restore: (value) => {
      observed.push(value?.top)
    } }))
    const { value: sidebar } = setupScroll(page, () => useScrollRestoration({ id: 'sidebar', manual: true, capture: () => ({ top: 10 }), restore: (value) => {
      observed.push(value?.top)
    } }))
    h.arrive(page, event)
    main.clear()
    await main.scroll()
    await sidebar.scroll()
    expect(observed).toEqual([undefined, 60])
    h.controller.clear('/pages/list/index')
    await sidebar.scroll()
    expect(observed).toEqual([undefined, 60, undefined])
  })

  it('explicit stop preserves saved snapshots and does not undo clear during later scope disposal', async () => {
    const h = createHost()
    const old = h.makePage()
    const oldEvent = h.begin(old)
    setupScroll(old, () => {
      useScrollRestoration({ id: 'main', manual: true, capture: () => ({ top: 120 }), restore: () => {} })
      useScrollRestoration({ id: 'sidebar', manual: true, capture: () => ({ top: 60 }), restore: () => {} })
    })
    h.arrive(old, oldEvent)
    const page = h.makePage()
    const event = h.begin(page)
    const { scope, value: handles } = setupScroll(page, () => ({
      main: useScrollRestoration({ id: 'main', manual: true, capture: () => ({ top: 20 }), restore: () => {} }),
      sidebar: useScrollRestoration({ id: 'sidebar', manual: true, capture: () => ({ top: 10 }), restore: () => {} }),
    }))
    h.arrive(page, event)
    handles.main.clear()
    handles.main.stop()
    handles.sidebar.stop()
    scope.stop()

    const recreated = h.makePage()
    const recreatedEvent = h.begin(recreated)
    const observed: Array<number | undefined> = []
    const { value: readers } = setupScroll(recreated, () => ['main', 'sidebar'].map(id => useScrollRestoration({
      id,
      manual: true,
      capture: () => ({ top: 0 }),
      restore: (value) => {
        observed.push(value?.top)
      },
    })))
    h.arrive(recreated, recreatedEvent)
    for (const reader of readers) {
      await reader.scroll()
    }
    expect(observed).toEqual([undefined, 60])
  })

  it('captures low-SDK unload even after the host has removed the page from its stack', async () => {
    const h = createHost('3.5.4')
    const old = h.makePage()
    const oldEvent = h.begin(old)
    setupScroll(old, () => useScrollRestoration({ capture: () => ({ top: 88 }), restore: () => {} }))
    h.arrive(old, oldEvent)
    h.pages.splice(0)
    h.hook(old, 'onUnload')
    const page = h.makePage()
    const event = h.begin(page)
    let top = 0
    const { value: handle } = setupScroll(page, () => useScrollRestoration({
      capture: () => ({ top }),
      restore: (value) => {
        top = value?.top ?? 0
      },
    }))
    h.arrive(page, event)
    expect(await handle.scroll()).toBe(true)
    expect(top).toBe(88)
  })

  it('low SDK keeps manual snapshots without subscribing to legacy route APIs', async () => {
    const h = createHost('3.5.4')
    expect(h.controller.automatic).toBe(false)
    const old = h.makePage()
    const oldEvent = h.begin(old)
    setupScroll(old, () => useScrollRestoration({ capture: () => ({ top: 88 }), restore: () => {
      throw new Error('must remain manual')
    } }))
    h.arrive(old, oldEvent)
    const page = h.makePage()
    const event = h.begin(page)
    let top = 0
    const { value: handle } = setupScroll(page, () => useScrollRestoration({ capture: () => ({ top }), restore: (value) => {
      top = value?.top ?? 0
    } }))
    h.arrive(page, event)
    await flushScrollJobs()
    expect(top).toBe(0)
    expect(await handle.scroll()).toBe(true)
    expect(top).toBe(88)
    expect(Object.values(h.listeners).map(listeners => listeners.size)).toEqual([0, 0, 0, 0])
    expect(h.errors).toEqual([])
  })

  it('foreground show does not replay snapshots and scope disposal cancels work', async () => {
    const h = createHost()
    const page = h.makePage()
    const event = h.begin(page)
    let restores = 0
    const { scope, value: handle } = setupScroll(page, () => useScrollRestoration({ capture: () => ({ top: 9 }), restore: () => {
      restores++
    } }))
    h.arrive(page, event)
    await flushScrollJobs()
    h.hook(page, 'onHide')
    h.hook(page, 'onShow')
    await flushScrollJobs()
    expect(restores).toBe(1)
    scope.stop()
    expect(await handle.scroll()).toBe(false)
    h.controller.dispose()
    h.emit('AppRouteDone', event)
    expect(restores).toBe(1)
    expect(Object.values(h.listeners).map(listeners => listeners.size)).toEqual([0, 0, 0, 0])
  })
})
