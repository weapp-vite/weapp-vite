import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('runtime request globals', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).wx
  })

  it('installs AbortController and AbortSignal on globalThis', async () => {
    const mod = await import('@/runtime/requestGlobals')

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

    await import('@/runtime/requestGlobals')

    expect(typeof (globalThis as any).wx.AbortController).toBe('function')
    expect(typeof (globalThis as any).wx.AbortSignal).toBe('function')
  })
})
