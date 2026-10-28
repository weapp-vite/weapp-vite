import { REQUEST_GLOBAL_ACTUALS_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const globalKeys = ['AbortController', 'AbortSignal', 'wx', 'global', 'self', 'window', REQUEST_GLOBAL_ACTUALS_KEY] as const
let descriptors: Map<string, PropertyDescriptor | undefined>

describe('runtime request globals', () => {
  beforeEach(() => {
    vi.resetModules()
    descriptors = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
    for (const key of ['AbortController', 'AbortSignal', 'wx', REQUEST_GLOBAL_ACTUALS_KEY]) {
      Reflect.deleteProperty(globalThis, key)
    }
  })

  afterEach(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      }
      else {
        Reflect.deleteProperty(globalThis, key)
      }
    }
  })

  it('exports an explicit fallback installer for abort globals', async () => {
    const mod = await import('@/runtime/requestGlobals')
    mod.installRuntimeAbortGlobals()

    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.AbortSignal).toBe('function')

    const controller = new globalThis.AbortController()
    controller.abort('demo')
    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBe('demo')

    expect(typeof mod.installRuntimeAbortGlobals).toBe('function')
  })

  it('also installs missing abort globals on mini program host objects', async () => {
    ;(globalThis as Record<string, any>).wx = {}

    const mod = await import('@/runtime/requestGlobals')
    mod.installRuntimeAbortGlobals()

    expect(typeof (globalThis as any).wx.AbortController).toBe('function')
    expect(typeof (globalThis as any).wx.AbortSignal).toBe('function')
  })

  it('no longer installs abort globals as a runtime entry side effect', async () => {
    await import('@/runtime')

    expect(globalThis.AbortController).toBeUndefined()
    expect(globalThis.AbortSignal).toBeUndefined()
  })
})
