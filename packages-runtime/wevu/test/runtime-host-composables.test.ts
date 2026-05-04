import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from '@/reactivity'
import { getCurrentPageStackSnapshot, getNavigationBarMetrics, useAsyncPullDownRefresh, useBoundingClientRect, useElementIntersectionObserver, useNavigationBarMetrics, usePageStack } from '@/runtime'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { callHookList } from '@/runtime/hooks/base'

type QueryResolver = (selector: string, multiple: boolean) => any

function flushAsyncHooks() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

function createSelectorQueryFactory(resolver: QueryResolver) {
  return () => {
    const queue: Array<{ selector: string, multiple: boolean }> = []
    const nodesRef = {
      boundingClientRect: () => nodesRef,
      fields: () => nodesRef,
      scrollOffset: () => nodesRef,
    }
    return {
      select(selector: string) {
        queue.push({ selector, multiple: false })
        return nodesRef
      },
      selectAll(selector: string) {
        queue.push({ selector, multiple: true })
        return nodesRef
      },
      exec(cb: (res: any[]) => void) {
        cb(queue.map(item => resolver(item.selector, item.multiple)))
      },
    }
  }
}

afterEach(() => {
  setCurrentInstance(undefined)
  setCurrentSetupContext(undefined)
  delete (globalThis as any).getCurrentPages
  delete (globalThis as any).wx
})

describe('runtime host composables', () => {
  it('queries bounding rect with the current native instance', async () => {
    const instance = {
      createSelectorQuery: createSelectorQueryFactory((selector, multiple) => {
        expect(selector).toBe('.card')
        expect(multiple).toBe(false)
        return { height: 56, width: 128 }
      }),
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    const getRect = useBoundingClientRect()
    await expect(getRect('.card')).resolves.toEqual({ height: 56, width: 128 })
  })

  it('observes element visibility and disconnects with lifecycles', () => {
    const observeResult = { intersectionRatio: 1 }
    const disconnect = vi.fn()
    const observe = vi.fn((_selector: string, callback: (result: unknown) => void) => {
      callback(observeResult)
    })
    const relativeToViewport = vi.fn(() => ({
      disconnect,
      observe,
      relativeToViewport,
    }))
    const instance = {
      createIntersectionObserver: vi.fn(() => ({
        disconnect,
        observe,
        relativeToViewport,
      })),
    } as any
    const seen: unknown[] = []

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    const controller = useElementIntersectionObserver({
      observerOptions: { thresholds: [0.5] },
      selector: '#goods-card',
      onObserve: result => seen.push(result),
    })

    callHookList(instance, 'onReady')

    expect(instance.createIntersectionObserver).toHaveBeenCalledWith({ thresholds: [0.5] })
    expect(relativeToViewport).toHaveBeenCalled()
    expect(observe).toHaveBeenCalledWith('#goods-card', expect.any(Function))
    expect(controller.observer).toBeTruthy()
    expect(seen).toEqual([observeResult])

    callHookList(instance, 'onUnload')
    expect(disconnect).toHaveBeenCalled()
    expect(controller.observer).toBeNull()
  })

  it('tracks current page stack through setup helpers', () => {
    ;(globalThis as any).wx = {}
    ;(globalThis as any).getCurrentPages = () => [
      { route: 'pages/home/home' },
      { route: '/pages/goods/details/index?id=1' },
    ]
    const instance = {} as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    const snapshot = getCurrentPageStackSnapshot()
    expect(snapshot).toEqual({
      canGoBack: true,
      currentRoute: 'pages/goods/details/index',
      stackLength: 2,
    })

    const pageStack = usePageStack({ autoRefresh: false })
    expect(pageStack.currentRoute.value).toBe('pages/goods/details/index')
    expect(pageStack.stackLength.value).toBe(2)
    expect(pageStack.canGoBack.value).toBe(true)
  })

  it('computes custom navigation metrics from host APIs', () => {
    ;(globalThis as any).wx = {
      getMenuButtonBoundingClientRect: () => ({ height: 32, top: 28 }),
      getSystemInfoSync: () => ({ statusBarHeight: 20 }),
    }
    const instance = {} as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    expect(getNavigationBarMetrics()).toEqual({
      navigationBarHeight: 48,
      navigationHeight: 68,
      statusBarHeight: 20,
    })

    const metrics = useNavigationBarMetrics({ autoRefresh: false })
    expect(metrics.statusBarHeight.value).toBe(20)
    expect(metrics.navigationBarHeight.value).toBe(48)
    expect(metrics.navigationHeight.value).toBe(68)

    ;(globalThis as any).wx.getMenuButtonBoundingClientRect = () => ({ height: 30, top: 24 })
    metrics.refresh()
    expect(metrics.navigationBarHeight.value).toBe(38)
    expect(metrics.navigationHeight.value).toBe(58)
  })

  it('skips disabled element observers', () => {
    const enabled = ref(false)
    const instance = {
      createIntersectionObserver: vi.fn(),
    } as any

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    const controller = useElementIntersectionObserver({
      enabled,
      selector: '#disabled',
    })

    callHookList(instance, 'onReady')
    expect(instance.createIntersectionObserver).not.toHaveBeenCalled()
    expect(controller.observer).toBeNull()
  })

  it('stops pull-down refresh after async refresh callbacks', async () => {
    const instance = {} as any
    const refresh = vi.fn(async () => {})
    const stopPullDownRefresh = vi.fn(async () => {})

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    useAsyncPullDownRefresh(refresh, { stopPullDownRefresh })
    callHookList(instance, 'onPullDownRefresh')

    await flushAsyncHooks()

    expect(refresh).toHaveBeenCalledOnce()
    expect(stopPullDownRefresh).toHaveBeenCalledOnce()
  })

  it('reports pull-down refresh errors and still stops refresh state', async () => {
    const instance = {} as any
    const error = new Error('refresh failed')
    const onError = vi.fn()
    const stopPullDownRefresh = vi.fn()

    setCurrentInstance(instance)
    setCurrentSetupContext({ instance })

    useAsyncPullDownRefresh(() => {
      throw error
    }, {
      onError,
      stopPullDownRefresh,
    })
    callHookList(instance, 'onPullDownRefresh')

    await flushAsyncHooks()

    expect(onError).toHaveBeenCalledWith(error)
    expect(stopPullDownRefresh).toHaveBeenCalledOnce()
  })
})
