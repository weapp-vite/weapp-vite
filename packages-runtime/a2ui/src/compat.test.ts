import { afterEach, describe, expect, it } from 'vitest'
import { installA2uiRuntimeCompat } from './compat'

const host = globalThis as Record<string, any>
const originals = {
  AbortController: host.AbortController,
  AbortSignal: host.AbortSignal,
}

afterEach(() => {
  host.AbortController = originals.AbortController
  host.AbortSignal = originals.AbortSignal
})

describe('installA2uiRuntimeCompat', () => {
  it('provides an abortable signal when the host lacks AbortController', () => {
    delete host.AbortController
    delete host.AbortSignal
    installA2uiRuntimeCompat()
    const controller = new host.AbortController()
    expect(typeof host.AbortSignal).toBe('function')
    expect(controller.signal.aborted).toBe(false)
    controller.abort()
    expect(controller.signal.aborted).toBe(true)
    expect(() => controller.signal.throwIfAborted()).toThrowError(/aborted/i)
    installA2uiRuntimeCompat()
    expect(host.AbortController).toBe(controller.constructor)
  })

  it('keeps a native AbortController untouched', () => {
    const native = function NativeAbortController() {}
    host.AbortController = native
    host.AbortSignal = native
    installA2uiRuntimeCompat()
    expect(host.AbortController).toBe(native)
    expect(host.AbortSignal).toBe(native)
  })
})
