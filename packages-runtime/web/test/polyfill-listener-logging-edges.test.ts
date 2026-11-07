// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { offError, onError } from '../src/runtime/polyfill/lifecycleEvents'
import { getRealtimeLogManager } from '../src/runtime/polyfill/realtimeLog'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

afterEach(() => {
  offError()
  setRuntimeWarningOptions()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('polyfill logging host boundaries', () => {
  it('isolates listeners which throw arbitrary values and retains a healthy error subscription', () => {
    setRuntimeWarningOptions({ level: 'off' })
    const host = new EventTarget()
    vi.stubGlobal('window', host)
    onError(() => {
      // eslint-disable-next-line no-throw-literal -- 模拟监听器抛出非 Error 值，验证异常隔离与原始事件转发。
      throw 'non Error failure'
    })
    const healthy = vi.fn()
    onError(healthy)
    expect(() => host.dispatchEvent(new ErrorEvent('error', { message: 'original failure' }))).not.toThrow()
    expect(healthy).toHaveBeenCalledExactlyOnceWith('original failure')
  })

  it('keeps realtime logging inert when a host method is missing and resumes when the host provides it', () => {
    setRuntimeWarningOptions({ level: 'off' })
    const info = vi.fn()
    const logger = { info: undefined as unknown, warn: vi.fn(), error: vi.fn() }
    vi.stubGlobal('console', logger)
    const manager = getRealtimeLogManager()
    manager.setFilterMsg('parent')
    const tag = manager.tag('worker')
    tag.addFilterMsg('child')
    expect(() => tag.info('discarded', { status: 'missing-handler' })).not.toThrow()
    logger.info = info
    tag.info('ready', { status: 'available' })
    expect(info).toHaveBeenCalledExactlyOnceWith('[worker]', '[parent]', '[child]', 'ready', { status: 'available' })
    expect(info.mock.contexts[0]).toBe(logger)
  })
})
