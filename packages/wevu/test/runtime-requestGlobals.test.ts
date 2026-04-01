import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('runtime request globals', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).wx
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
