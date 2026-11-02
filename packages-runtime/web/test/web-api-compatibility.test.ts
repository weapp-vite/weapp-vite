// @vitest-environment happy-dom

import { Buffer } from 'node:buffer'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared/platforms/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as polyfill from '../src/runtime/polyfill'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

const runtime = { ...polyfill, setRuntimeWarningOptions }

afterEach(() => {
  runtime.setRuntimeWarningOptions()
  vi.restoreAllMocks()
})

describe('issue #1250 remaining public API contracts', () => {
  it('installs callable functions through all public and platform surfaces', async () => {
    const names = [
      'arrayBufferToBase64',
      'base64ToArrayBuffer',
      'getPerformance',
      'getRealtimeLogManager',
      'createInnerAudioContext',
      'reportMonitor',
      'setEnableDebug',
      'setKeepScreenOn',
      'onKeyboardHeightChange',
      'offKeyboardHeightChange',
      'onMemoryWarning',
      'offMemoryWarning',
    ] as const
    polyfill.installMiniProgramGlobals()
    for (const name of names) {
      expect(runtime[name], name).toBeTypeOf('function')
      expect(runtime[name]).toBe(polyfill[name])
      for (const key of getMiniProgramRuntimeGlobalKeys()) {
        expect(Reflect.get(globalThis, key)[name]).toBe(runtime[name])
      }
      expect(runtime.canIUse(`wx.${name}`)).toBe(true)
    }
    const publicRuntime = await import('../src/runtime')
    for (const name of names) {
      expect(publicRuntime[name]).toBe(runtime[name])
    }
    expect(runtime.canIUse('wx.unspecifiedFutureApi')).toBe(false)
    expect(Reflect.get(globalThis, 'wx').noConflict).toBeUndefined()
  })

  it('round trips every byte and large buffers synchronously without text encoding', () => {
    const bytes = Uint8Array.from({ length: 512 * 1024 }, (_, index) => index % 256)
    const encoded = runtime.arrayBufferToBase64(bytes.buffer)
    expect(typeof encoded).toBe('string')
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'))
    const decoded = runtime.base64ToArrayBuffer(encoded)
    expect(decoded).toBeInstanceOf(ArrayBuffer)
    expect(Buffer.from(decoded).equals(Buffer.from(bytes))).toBe(true)
    expect(runtime.arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
    expect(runtime.base64ToArrayBuffer('').byteLength).toBe(0)
    expect(() => runtime.base64ToArrayBuffer('%%%')).toThrow()
  })

  it.each(['setEnableDebug', 'setKeepScreenOn'] as const)('%s completes its compatibility call once in callback order', async (name) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const calls: unknown[] = []
    const fail = vi.fn()
    const callbacks = {
      success: (value: { errMsg: string }) => calls.push(['success', value]),
      complete: (value: { errMsg: string }) => calls.push(['complete', value]),
      fail,
    }
    const result = await (name === 'setEnableDebug'
      ? runtime.setEnableDebug({ enableDebug: true, ...callbacks })
      : runtime.setKeepScreenOn({ keepScreenOn: true, ...callbacks }))
    expect(result).toEqual({ errMsg: `${name}:ok` })
    expect(calls).toEqual([['success', result], ['complete', result]])
    expect(fail).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain(`wx.${name}`)
  })

  it('keeps unsupported subscriptions inert and respects warning settings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const callback = vi.fn()
    expect(runtime.onKeyboardHeightChange(callback)).toBeUndefined()
    runtime.onKeyboardHeightChange(callback)
    runtime.offKeyboardHeightChange(callback)
    runtime.offKeyboardHeightChange()
    runtime.offKeyboardHeightChange()
    expect(runtime.onMemoryWarning(callback)).toBeUndefined()
    runtime.offMemoryWarning(callback)
    runtime.offMemoryWarning()
    expect(runtime.reportMonitor('startup', 1)).toBeUndefined()
    runtime.reportMonitor('another', 2)
    expect(warn).toHaveBeenCalledTimes(3)
    expect(callback).not.toHaveBeenCalled()
    runtime.setRuntimeWarningOptions({ level: 'off' })
    runtime.onMemoryWarning(callback)
    runtime.reportMonitor('quiet', 1)
    expect(warn).toHaveBeenCalledTimes(3)
    runtime.setRuntimeWarningOptions({ level: 'error', dedupe: false })
    runtime.reportMonitor('one', 1)
    runtime.reportMonitor('two', 2)
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('provides the complete inert performance interface without invented measurements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const performance = runtime.getPerformance()
    const callback = vi.fn()
    const observer = performance.createObserver(callback)
    performance.setBufferSize(50)
    observer.observe({ entryTypes: ['render', 'navigation'] })
    observer.observe({ type: 'script' })
    expect(performance.getEntries()).toEqual([])
    expect(performance.getEntriesByName('appLaunch')).toEqual([])
    expect(performance.getEntriesByType('render')).toEqual([])
    expect(observer.supportedEntryTypes).toEqual([])
    observer.disconnect()
    observer.disconnect()
    expect(callback).not.toHaveBeenCalled()
    expect(Reflect.get(performance, 'now')).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps realtime log managers and tag state local to each manager', () => {
    runtime.setRuntimeWarningOptions({ level: 'off' })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = runtime.getRealtimeLogManager()
    const other = runtime.getRealtimeLogManager()
    logger.setFilterMsg('launch')
    logger.addFilterMsg('ready')
    logger.in({ route: 'pages/index' })
    logger.info('value', { count: 1 })
    logger.warn('notice')
    logger.error('failure')
    const tagged = logger.tag('network')
    tagged.setFilterMsg('request')
    tagged.addFilterMsg('done')
    tagged.info('status', 200)
    other.info('independent')
    expect(info).toHaveBeenCalledTimes(3)
    expect(info.mock.calls[0]).toContain('value')
    expect(info.mock.calls[1]?.join(' ')).toContain('network')
    expect(info.mock.calls[2]).toEqual(['independent'])
    expect(warn).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledOnce()
    expect(logger.getCurrentState()).toEqual({ logCount: 0, maxLogCount: 0, maxSize: 0, size: 0 })
  })
})
