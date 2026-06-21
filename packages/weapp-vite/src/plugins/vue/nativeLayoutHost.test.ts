import { afterEach, describe, expect, it } from 'vitest'
import {
  registerLayoutHosts,
  resolveLayoutHost,
  unregisterLayoutHosts,
  waitForLayoutHost,
} from './nativeLayoutHost'

describe('native layout host runtime api', () => {
  afterEach(() => {
    delete (globalThis as any).getCurrentPages
  })

  it('registers and resolves native layout hosts on current page', () => {
    const page = {
      route: 'pages/index/index',
      __wxWebviewId__: 1,
    }
    const toastHost = { show: () => {} }

    ;(globalThis as any).getCurrentPages = () => [page]

    const bridge = registerLayoutHosts({
      'layout-toast': toastHost,
    })

    expect(bridge).toBeTruthy()
    expect(resolveLayoutHost('layout-toast')).toBe(toastHost)

    expect(unregisterLayoutHosts(bridge)).toBe(true)
    expect(resolveLayoutHost('layout-toast')).toBeNull()
  })

  it('keeps resolving hosts when current page proxy changes but page identity stays stable', () => {
    const registeredPage = {
      route: 'pages/index/index',
      __wxWebviewId__: 7,
    }
    const resolvedPage = {
      route: 'pages/index/index',
      __wxWebviewId__: 7,
    }
    const messageHost = { info: () => {} }
    let calls = 0

    ;(globalThis as any).getCurrentPages = () => {
      calls += 1
      return [calls === 1 ? registeredPage : resolvedPage]
    }

    const bridge = registerLayoutHosts({
      'layout-message': messageHost,
    })

    expect(resolveLayoutHost('layout-message')).toBe(messageHost)
    unregisterLayoutHosts(bridge)
  })

  it('supports selector based registration for native layout component instances', () => {
    const page = {
      route: 'pages/index/index',
    }
    const toastHost = { show: () => {} }
    const layoutContext = {
      selectComponent(selector: string) {
        return selector === '#t-toast' ? toastHost : null
      },
    }

    ;(globalThis as any).getCurrentPages = () => [page]

    const bridge = registerLayoutHosts(['#t-toast'], layoutContext)

    expect(resolveLayoutHost('#t-toast')).toBe(toastHost)
    unregisterLayoutHosts(bridge)
  })

  it('waits for a native layout host registered after the first lookup', async () => {
    const page = {
      route: 'pages/index/index',
    }
    const toastHost = { show: () => {} }

    ;(globalThis as any).getCurrentPages = () => [page]

    setTimeout(() => {
      registerLayoutHosts({
        'layout-toast': toastHost,
      })
    }, 0)

    await expect(waitForLayoutHost('layout-toast', {
      interval: 1,
      retries: 5,
    })).resolves.toBe(toastHost)
  })
})
