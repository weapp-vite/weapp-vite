import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createApp,
  onError,
  onHide,
  onLaunch,
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
    appOptions.onShow.call(appInst, {})
    appOptions.onHide.call(appInst)
    appOptions.onError.call(appInst, 'boom')
    appOptions.onPageNotFound.call(appInst, { path: '/missing', query: {}, isEntryPage: true })
    appOptions.onUnhandledRejection.call(appInst, { promise: Promise.resolve(), reason: 'oops' })
    appOptions.onThemeChange.call(appInst, { theme: 'dark' })

    expect(logs).toEqual(['launch', 'show', 'hide', 'error', 'notFound', 'unhandled', 'theme'])
  })
})
