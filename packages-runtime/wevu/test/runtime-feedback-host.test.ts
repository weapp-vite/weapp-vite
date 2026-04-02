import { describe, expect, it, vi } from 'vitest'
import { ref } from '@/reactivity'
import { setCurrentInstance, setCurrentSetupContext } from '@/runtime/hooks'
import { callHookList } from '@/runtime/hooks/base'
import { registerRuntimeLayoutHosts, resolveLayoutBridge, resolveLayoutHost, unregisterRuntimeLayoutHosts, useLayoutBridge, useLayoutHosts, waitForLayoutHost } from '@/runtime/layoutBridge'

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

  it('registers layout hosts from template refs and resolves them by key', async () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const toastHost = { show: vi.fn() }
    const dialogHost = { close: vi.fn() }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: vi.fn(() => null),
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    setCurrentInstance(layoutInstance)
    setCurrentSetupContext({ instance: layoutInstance })

    useLayoutHosts({
      'layout-toast': ref(toastHost),
      'layout-dialog': () => dialogHost,
    })

    expect(resolveLayoutHost<{ show: typeof toastHost.show }>('layout-toast', { context: page }))
      .toMatchObject({ show: expect.any(Function) })
    expect(resolveLayoutHost<{ close: typeof dialogHost.close }>('layout-dialog', { context: page }))
      .toMatchObject({ close: expect.any(Function) })
    const resolvedDialogHost = await waitForLayoutHost<{ close: typeof dialogHost.close }>('layout-dialog', { context: page, retries: 0 })
    expect(resolvedDialogHost).toMatchObject({ close: expect.any(Function) })

    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
    delete (globalThis as any).getCurrentPages
  })

  it('registers declared layout hosts from runtime component selectors', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const toastHost = { show: vi.fn() }
    const dialogHost = { close: vi.fn() }
    const selectComponentThis: any[] = []
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: vi.fn(function (this: any, selector: string) {
        selectComponentThis.push(this)
        if (selector === '#__wv-layout-host-0') {
          return toastHost
        }
        if (selector === '#__wv-layout-host-1') {
          return dialogHost
        }
        return null
      }),
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    const bridge = registerRuntimeLayoutHosts([
      { key: 'layout-toast', refName: '__wevu_layout_host_0', selector: '#__wv-layout-host-0', kind: 'component' },
      { key: 'layout-dialog', refName: '__wevu_layout_host_1', selector: '#__wv-layout-host-1', kind: 'component' },
    ], layoutInstance)

    expect(bridge).toBeTruthy()
    expect(resolveLayoutBridge('layout-toast', page)?.selectComponent('layout-toast')).toBe(toastHost)
    expect(resolveLayoutBridge('layout-dialog', page)?.selectComponent('layout-dialog')).toBe(dialogHost)
    expect(selectComponentThis).toEqual([layoutInstance, layoutInstance])

    unregisterRuntimeLayoutHosts([
      { key: 'layout-toast', refName: '__wevu_layout_host_0', selector: '#__wv-layout-host-0', kind: 'component' },
      { key: 'layout-dialog', refName: '__wevu_layout_host_1', selector: '#__wv-layout-host-1', kind: 'component' },
    ], bridge as any)

    delete (globalThis as any).getCurrentPages
  })

  it('prefers cached template ref instances before selector lookup', () => {
    const page = {
      route: 'pages/index/index',
      __wevuSetPageLayout: () => {},
    }
    const toastHost = { show: vi.fn() }
    const layoutInstance = {
      is: 'layouts/default',
      selectComponent: vi.fn(() => {
        throw new Error('should not reach selector lookup')
      }),
      __wevu: {
        state: {
          $refs: {
            __wevu_layout_host_0: toastHost,
          },
        },
      },
    } as any

    ;(globalThis as any).getCurrentPages = () => [page]

    registerRuntimeLayoutHosts([
      { key: 'layout-toast', refName: '__wevu_layout_host_0', selector: '#__wv-layout-host-0', kind: 'component' },
    ], layoutInstance)

    expect(resolveLayoutHost('layout-toast', { context: page })).toBe(toastHost)
    expect(layoutInstance.selectComponent).not.toHaveBeenCalled()

    delete (globalThis as any).getCurrentPages
  })
})
