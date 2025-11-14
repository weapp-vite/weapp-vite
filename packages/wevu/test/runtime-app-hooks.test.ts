import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, onAppHide, onAppShow } from '@/index'

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
  it('onAppShow/onAppHide via wevu hooks', async () => {
    const logs: string[] = []
    createApp({
      data: () => ({}),
      setup() {
        onAppShow(() => logs.push('show'))
        onAppHide(() => logs.push('hide'))
      },
    })
    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    const appInst: any = {}
    appOptions.onLaunch.call(appInst)
    appOptions.onShow.call(appInst)
    appOptions.onHide.call(appInst)
    expect(logs).toEqual(['show', 'hide'])
  })
})
