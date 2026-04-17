import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createApp,
  onError,
  onHide,
  onLaunch,
  onMemoryWarning,
  onPageNotFound,
  onShow,
  onThemeChange,
  onUnhandledRejection,
} from '@/index'

const registeredApps: Record<string, any>[] = []

beforeEach(() => {
  registeredApps.length = 0
  ;(globalThis as any).App = vi.fn((options: Record<string, any>) => {
    registeredApps.push(options)
  })
})

afterEach(() => {
  delete (globalThis as any).App
  delete (globalThis as any).wx
  delete (globalThis as any).my
  delete (globalThis as any).tt
})

describe('runtime: app-level hooks', () => {
  it('onShow/onHide via wevu hooks', async () => {
    const logs: string[] = []
    createApp({
      data: () => ({}),
      setup() {
        onShow(() => logs.push('show'))
        onHide(() => logs.push('hide'))
      },
    })
    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    const appInst: any = {}
    appOptions.onLaunch.call(appInst)
    appOptions.onShow.call(appInst, {})
    appOptions.onHide.call(appInst)
    expect(logs).toEqual(['show', 'hide'])
  })

  it('onLaunch/onShow/onPageNotFound/onUnhandledRejection/onThemeChange via wevu hooks', async () => {
    const logs: string[] = []
    let errorListener: ((...args: any[]) => void) | undefined
    let pageNotFoundListener: ((...args: any[]) => void) | undefined
    let unhandledRejectionListener: ((...args: any[]) => void) | undefined
    let themeChangeListener: ((...args: any[]) => void) | undefined
    const offError = vi.fn()
    const offPageNotFound = vi.fn()
    const offUnhandledRejection = vi.fn()
    const offThemeChange = vi.fn()
    ;(globalThis as any).wx = {
      onError: vi.fn((fn: (...args: any[]) => void) => {
        errorListener = fn
      }),
      offError,
      onPageNotFound: vi.fn((fn: (...args: any[]) => void) => {
        pageNotFoundListener = fn
      }),
      offPageNotFound,
      onUnhandledRejection: vi.fn((fn: (...args: any[]) => void) => {
        unhandledRejectionListener = fn
      }),
      offUnhandledRejection,
      onThemeChange: vi.fn((fn: (...args: any[]) => void) => {
        themeChangeListener = fn
      }),
      offThemeChange,
    }

    createApp({
      data: () => ({}),
      setup() {
        onLaunch(() => logs.push('launch'))
        onShow(() => logs.push('show'))
        onHide(() => logs.push('hide'))
        onError(() => logs.push('error'))
        onPageNotFound(() => logs.push('notFound'))
        onUnhandledRejection(() => logs.push('unhandled'))
        onThemeChange(() => logs.push('theme'))
      },
    })

    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    const appInst: any = {}

    appOptions.onLaunch.call(appInst, {})
    expect(appOptions.onError).toBeUndefined()
    expect(appOptions.onPageNotFound).toBeUndefined()
    expect(appOptions.onUnhandledRejection).toBeUndefined()
    expect(appOptions.onThemeChange).toBeUndefined()
    appOptions.onShow.call(appInst, {})
    appOptions.onHide.call(appInst)
    errorListener?.('boom')
    pageNotFoundListener?.({ path: '/missing', query: {}, isEntryPage: true })
    unhandledRejectionListener?.({ promise: Promise.resolve(), reason: 'oops' })
    themeChangeListener?.({ theme: 'dark' })

    expect(logs).toEqual(['launch', 'show', 'hide', 'error', 'notFound', 'unhandled', 'theme'])

    appOptions.onLaunch.call(appInst, {})
    expect(offError).toHaveBeenCalledTimes(1)
    expect(offPageNotFound).toHaveBeenCalledTimes(1)
    expect(offUnhandledRejection).toHaveBeenCalledTimes(1)
    expect(offThemeChange).toHaveBeenCalledTimes(1)
  })

  it('binds wx.onMemoryWarning and dispatches onMemoryWarning hook', async () => {
    const logs: string[] = []
    let listener: ((res: WechatMiniprogram.OnMemoryWarningListenerResult) => void) | undefined
    const onMemoryWarningApi = vi.fn((fn: (res: WechatMiniprogram.OnMemoryWarningListenerResult) => void) => {
      listener = fn
    })
    const offMemoryWarningApi = vi.fn()
    ;(globalThis as any).wx = {
      onMemoryWarning: onMemoryWarningApi,
      offMemoryWarning: offMemoryWarningApi,
    }

    createApp({
      data: () => ({}),
      setup() {
        onMemoryWarning(() => logs.push('memoryWarning'))
      },
    })

    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    const appInst: any = {}

    appOptions.onLaunch.call(appInst, {})
    expect(onMemoryWarningApi).toHaveBeenCalledTimes(1)
    listener?.({ level: 10 } as WechatMiniprogram.OnMemoryWarningListenerResult)
    expect(logs).toEqual(['memoryWarning'])

    // 重复绑定时会先注销旧监听，避免内存告警监听累积。
    appOptions.onLaunch.call(appInst, {})
    expect(offMemoryWarningApi).toHaveBeenCalledTimes(1)
    expect(onMemoryWarningApi).toHaveBeenCalledTimes(2)
  })

  it('avoids duplicate App registration when host global exists without runtime host config', async () => {
    ;(globalThis as any).wx = {}

    createApp({
      data: () => ({}),
    })
    createApp({
      data: () => ({}),
    })

    expect(registeredApps).toHaveLength(1)
    expect((globalThis as any).wx.__wevuAppRegistered).toBe(true)
  })

  it('does not bind theme change listener on alipay host even if host object exposes the method', async () => {
    const onThemeChangeApi = vi.fn()
    const offThemeChangeApi = vi.fn()
    ;(globalThis as any).my = {
      onThemeChange: onThemeChangeApi,
      offThemeChange: offThemeChangeApi,
    }

    createApp({
      data: () => ({}),
      setup() {
        onThemeChange(() => {})
      },
    })

    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    const appInst: any = {}
    appOptions.onLaunch.call(appInst, {})

    expect(onThemeChangeApi).not.toHaveBeenCalled()
    expect(offThemeChangeApi).not.toHaveBeenCalled()
  })
})
