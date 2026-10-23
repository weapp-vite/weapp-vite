// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installMiniProgramGlobals } from '../src/runtime/polyfill'
import { emitLifecycleEvent } from '../src/runtime/polyfill/lifecycleEvents'

function getWx() {
  const target = globalThis as any
  return target.wx ?? target.my ?? target.tt
}

describe('missing wx api shims', () => {
  beforeEach(() => {
    installMiniProgramGlobals()
  })

  it('exposes hideToast and settles the callback', async () => {
    const wx = getWx()
    const success = vi.fn()
    expect(typeof wx.hideToast).toBe('function')
    await wx.hideToast({ success })
    expect(success).toHaveBeenCalled()
  })

  it('exposes hideShareMenu as a resolved no-op', async () => {
    const wx = getWx()
    const success = vi.fn()
    expect(typeof wx.hideShareMenu).toBe('function')
    await wx.hideShareMenu({ success })
    expect(success).toHaveBeenCalled()
  })

  it('exposes hideHomeButton instead of throwing', () => {
    const wx = getWx()
    expect(typeof wx.hideHomeButton).toBe('function')
    expect(() => wx.hideHomeButton()).not.toThrow()
  })

  it('exposes reportEvent without interrupting app launch', () => {
    const wx = getWx()
    expect(typeof wx.reportEvent).toBe('function')
    expect(() => wx.reportEvent('launch', { a: 1 })).not.toThrow()
  })

  it('registers and removes error listeners', () => {
    const wx = getWx()
    const handler = vi.fn()

    wx.onError(handler)
    emitLifecycleEvent('error', { message: 'boom' })
    expect(handler).toHaveBeenCalledWith({ message: 'boom' })

    wx.offError(handler)
    handler.mockClear()
    emitLifecycleEvent('error', { message: 'again' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps other listeners alive when one throws', () => {
    const wx = getWx()
    const broken = vi.fn(() => {
      throw new Error('listener failed')
    })
    const healthy = vi.fn()

    wx.onError(broken)
    wx.onError(healthy)
    expect(() => emitLifecycleEvent('error', { message: 'x' })).not.toThrow()
    expect(healthy).toHaveBeenCalled()

    wx.offError(broken)
    wx.offError(healthy)
  })

  it('routes unhandledrejection listeners', () => {
    const wx = getWx()
    const handler = vi.fn()

    wx.onUnhandledRejection(handler)
    emitLifecycleEvent('unhandledRejection', { reason: 'nope' })
    expect(handler).toHaveBeenCalledWith({ reason: 'nope' })
    wx.offUnhandledRejection(handler)
  })
})
