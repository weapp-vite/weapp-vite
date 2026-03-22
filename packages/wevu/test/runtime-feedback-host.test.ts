import { describe, expect, it, vi } from 'vitest'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { callHookList } from '@/runtime/hooks/base'
import { resolveLayoutBridge, useLayoutBridge } from '@/runtime/layoutBridge'

describe('layout bridge runtime api', () => {
  it('registers and unregisters feedback hosts with component lifetimes', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: (selector: string) => ({ selector }),
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutBridge(['#t-toast', '#t-dialog'])

    expect(resolveLayoutBridge('#t-toast', page)?.selectComponent('#t-toast')).toEqual({ selector: '#t-toast' })

    callHookList(layoutInstance, 'onAttached')
    expect(resolveLayoutBridge('#t-toast', page)?.selectComponent('#t-toast')).toEqual({ selector: '#t-toast' })
    expect(resolveLayoutBridge('#t-dialog', page)?.selectComponent('#t-dialog')).toEqual({ selector: '#t-dialog' })

    callHookList(layoutInstance, 'onDetached')
    expect(resolveLayoutBridge('#t-toast', page)).toBe(page)
    expect(resolveLayoutBridge('#t-dialog', page)).toBe(page)

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('resolves feedback hosts when current page proxies change across lookups', () => {
    const registeredPage = {
      route: 'pages/index/index',
      __wxWebviewId__: 7,
      __wevuSetPageLayout: () => {},
    }
    const resolvedPage = {
      route: 'pages/index/index',
      __wxWebviewId__: 7,
      __wevuSetPageLayout: () => {},
    }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: (selector: string) => ({ selector }),
    } as any

    let calls = 0
    ;(globalThis as any).getCurrentPages = () => {
      calls += 1
      return [calls === 1 ? registeredPage : resolvedPage]
    }

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutBridge('#t-toast')
    callHookList(layoutInstance, 'onAttached')

    expect(resolveLayoutBridge('#t-toast', resolvedPage)?.selectComponent('#t-toast')).toEqual({ selector: '#t-toast' })

    callHookList(layoutInstance, 'onDetached')
    expect(resolveLayoutBridge('#t-toast', resolvedPage)).toBe(resolvedPage)

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('keeps resolving feedback hosts after page keys upgrade from route to webview id', () => {
    const registeredPage = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const resolvedPage = {
      route: 'pages/index/index',
      __wxWebviewId__: 9,
      __wevuSetPageLayout: () => {},
    }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: (selector: string) => ({ selector }),
    } as any

    let calls = 0
    ;(globalThis as any).getCurrentPages = () => {
      calls += 1
      return [calls === 1 ? registeredPage : resolvedPage]
    }

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutBridge('#t-toast')
    callHookList(layoutInstance, 'onAttached')

    expect(resolveLayoutBridge('#t-toast', resolvedPage)?.selectComponent('#t-toast')).toEqual({ selector: '#t-toast' })

    callHookList(layoutInstance, 'onDetached')
    expect(resolveLayoutBridge('#t-toast', resolvedPage)).toBe(resolvedPage)

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('prefers explicit component resolvers over selector lookup', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const toastInstance = { show: () => {} }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: () => null,
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutBridge('#t-toast', {
      resolveComponent(selector) {
        return selector === '#t-toast' ? toastInstance : null
      },
    })

    expect(resolveLayoutBridge('#t-toast', page)?.selectComponent('#t-toast')).toBe(toastInstance)

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('does not fall back to native selectComponent when resolver returns null', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const nativeSelectComponent = vi.fn(() => ({ selector: 'layout-dialog' }))
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: nativeSelectComponent,
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutBridge('layout-dialog', {
      resolveComponent() {
        return null
      },
    })

    expect(resolveLayoutBridge('layout-dialog', page)?.selectComponent('layout-dialog')).toBeNull()
    expect(nativeSelectComponent).not.toHaveBeenCalled()

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })
})
