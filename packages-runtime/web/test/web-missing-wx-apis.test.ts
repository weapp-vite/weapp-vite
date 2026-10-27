// @vitest-environment happy-dom

import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared/platforms/runtime'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeKeys = getMiniProgramRuntimeGlobalKeys()
const trackedKeys = [...runtimeKeys, 'getApp', 'getCurrentPages']
const originalDescriptors = new Map(trackedKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let runtime: typeof import('../src/runtime')
let polyfill: typeof import('../src/runtime/polyfill')
let initialNativeEvents: string[]
let initialThemeQueries: number

describe('missing wx api public contracts', () => {
  beforeAll(async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const matchMedia = vi.spyOn(window, 'matchMedia')
    runtime = await import('../src/runtime')
    polyfill = await import('../src/runtime/polyfill')
    initialNativeEvents = add.mock.calls.map(([name]) => name)
    initialThemeQueries = matchMedia.mock.calls.length
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    polyfill.installMiniProgramGlobals()
  })

  afterEach(() => {
    polyfill.offError()
    polyfill.offUnhandledRejection()
    polyfill.offThemeChange()
    runtime.setRuntimeWarningOptions()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  afterAll(() => {
    for (const key of trackedKeys) {
      const descriptor = originalDescriptors.get(key)
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      }
      else {
        Reflect.deleteProperty(globalThis, key)
      }
    }
  })

  it('shares public functions across the runtime, polyfill and every global alias', () => {
    const names = [
      'hideToast',
      'hideShareMenu',
      'hideHomeButton',
      'onError',
      'offError',
      'onUnhandledRejection',
      'offUnhandledRejection',
      'onThemeChange',
      'offThemeChange',
      'reportEvent',
    ] as const
    for (const name of names) {
      expect(runtime[name]).toBe(polyfill[name])
      for (const key of runtimeKeys) {
        const bridge = (globalThis as Record<string, unknown>)[key] as typeof polyfill
        expect(bridge[name]).toBe(runtime[name])
      }
    }
  })

  it('does not eagerly install lifecycle listeners at import or repeated global installation', () => {
    expect(initialNativeEvents).not.toContain('error')
    expect(initialNativeEvents).not.toContain('unhandledrejection')
    expect(initialThemeQueries).toBe(0)
    const add = vi.spyOn(window, 'addEventListener')
    const matchMedia = vi.spyOn(window, 'matchMedia')
    polyfill.installMiniProgramGlobals()
    polyfill.installMiniProgramGlobals()
    expect(add.mock.calls.map(([name]) => name)).not.toContain('error')
    expect(add.mock.calls.map(([name]) => name)).not.toContain('unhandledrejection')
    expect(matchMedia).not.toHaveBeenCalled()
  })

  it.each(['hideToast', 'hideShareMenu', 'hideHomeButton'] as const)('%s resolves the same result passed to success and complete', async (name) => {
    const calls: unknown[] = []
    const success = vi.fn(result => calls.push(['success', result]))
    const complete = vi.fn(result => calls.push(['complete', result]))
    const fail = vi.fn()
    const result = await runtime[name]({ success, complete, fail })
    expect(result).toEqual({ errMsg: `${name}:ok` })
    expect(success).toHaveBeenCalledExactlyOnceWith(result)
    expect(complete).toHaveBeenCalledExactlyOnceWith(result)
    expect(calls).toEqual([['success', result], ['complete', result]])
    expect(fail).not.toHaveBeenCalled()
  })

  it('applies warning deduplication and level settings to reportEvent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(runtime.reportEvent('launch', { ready: true })).toBeUndefined()
    runtime.reportEvent('another')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('wx.reportEvent')

    runtime.setRuntimeWarningOptions({ level: 'off' })
    runtime.reportEvent('quiet')
    expect(warn).toHaveBeenCalledTimes(1)
    runtime.setRuntimeWarningOptions({ level: 'error', dedupe: false })
    runtime.reportEvent('one')
    runtime.reportEvent('two')
    expect(error).toHaveBeenCalledTimes(2)
  })
})
