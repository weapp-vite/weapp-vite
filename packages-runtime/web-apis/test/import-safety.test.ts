import { REQUEST_GLOBAL_ACTUALS_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NativeResponse = globalThis.Response
const globalKeys = ['Response', 'AbortController', 'AbortSignal', 'global', 'self', 'window', REQUEST_GLOBAL_ACTUALS_KEY] as const
let descriptors: Map<string, PropertyDescriptor | undefined>

beforeEach(() => {
  vi.resetModules()
  descriptors = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Reflect.deleteProperty(globalThis, REQUEST_GLOBAL_ACTUALS_KEY)
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
  vi.resetModules()
})

describe('runtime import safety', () => {
  it('installs abort globals when a lazy native Response getter requires the missing AbortSignal', async () => {
    Reflect.deleteProperty(globalThis, 'AbortController')
    Reflect.deleteProperty(globalThis, 'AbortSignal')
    const getter = vi.fn(() => {
      if (typeof AbortSignal === 'undefined') {
        throw new ReferenceError('AbortSignal is not defined')
      }
      return NativeResponse
    })
    Object.defineProperty(globalThis, 'Response', { configurable: true, get: getter })

    const runtime = await import('../src')
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(false)
    runtime.installAbortGlobals()
    const controller = new AbortController()
    controller.abort('demo')
    expect(controller.signal.aborted).toBe(true)
    expect(controller.signal.reason).toBe('demo')
    expect(await new runtime.ResponsePolyfill('ready').text()).toBe('ready')
    expect(getter).toHaveBeenCalledTimes(1)
  })

  it('keeps the successfully selected native Body constructors when global getters later fail', async () => {
    const getter = vi.fn(() => {
      if (getter.mock.calls.length > 1) {
        throw new Error('Response getter is no longer available')
      }
      return NativeResponse
    })
    Object.defineProperty(globalThis, 'Response', { configurable: true, get: getter })

    const runtime = await import('../src')
    const streams = await import('../src/streams')
    expect(streams.usesNativeStreams).toBe(true)
    const body = new streams.ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array([65]))
      controller.close()
    } })
    const response = new runtime.ResponsePolyfill(body)
    expect(response.bodyUsed).toBe(false)
    expect(await response.text()).toBe('A')
    expect(response.bodyUsed).toBe(true)
    expect(getter).toHaveBeenCalledTimes(1)
  })
})
