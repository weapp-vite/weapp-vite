// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  offError,
  offThemeChange,
  offUnhandledRejection,
  onError,
  onThemeChange,
  onUnhandledRejection,
} from '../src/runtime/polyfill/lifecycleEvents'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

function createHost() {
  const media = Object.assign(new EventTarget(), { matches: false })
  const target = Object.assign(new EventTarget(), { matchMedia: vi.fn(() => media) })
  return {
    target,
    media,
    add: vi.spyOn(target, 'addEventListener'),
    remove: vi.spyOn(target, 'removeEventListener'),
    mediaAdd: vi.spyOn(media, 'addEventListener'),
    mediaRemove: vi.spyOn(media, 'removeEventListener'),
  }
}

describe('browser lifecycle subscriptions', () => {
  let host: ReturnType<typeof createHost>

  beforeEach(() => {
    host = createHost()
    vi.stubGlobal('window', host.target)
  })

  afterEach(() => {
    offError()
    offUnhandledRejection()
    offThemeChange()
    setRuntimeWarningOptions()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('binds only the first error subscription and removes its exact native handler after the last off', () => {
    const first = vi.fn()
    const second = vi.fn()
    onError(first)
    onError(first)
    onError(second)
    expect(host.add).toHaveBeenCalledTimes(1)
    expect(host.add.mock.calls[0]?.[0]).toBe('error')
    expect(host.target.matchMedia).not.toHaveBeenCalled()

    host.target.dispatchEvent(new ErrorEvent('error', { message: 'startup failed' }))
    expect(first).toHaveBeenCalledExactlyOnceWith('startup failed')
    expect(second).toHaveBeenCalledExactlyOnceWith('startup failed')
    offError(first)
    expect(host.remove).not.toHaveBeenCalled()
    offError(second)
    expect(host.remove.mock.calls).toEqual(host.add.mock.calls)
    offError()
    expect(host.remove).toHaveBeenCalledTimes(1)

    onError(first)
    host.target.dispatchEvent(new ErrorEvent('error', { error: new Error('stacked') }))
    expect(first.mock.lastCall?.[0]).toContain('Error: stacked')
  })

  it('preserves promise and arbitrary rejection reasons without forwarding them to onError', () => {
    const handler = vi.fn()
    const errorHandler = vi.fn()
    onUnhandledRejection(handler)
    onError(errorHandler)
    const promise = Promise.resolve()
    const reason = { code: 'network', retry: true }
    const event = new Event('unhandledrejection')
    Object.defineProperties(event, { promise: { value: promise }, reason: { value: reason } })
    host.target.dispatchEvent(event)
    expect(handler).toHaveBeenCalledExactlyOnceWith({ promise, reason })
    vi.stubGlobal('window', createHost().target)
    offUnhandledRejection(handler)
    const rejectionBinding = host.add.mock.calls.find(([name]) => name === 'unhandledrejection')
    expect(host.remove).toHaveBeenCalledExactlyOnceWith(...rejectionBinding!)
    host.target.dispatchEvent(event)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(errorHandler).not.toHaveBeenCalled()
  })

  it('binds the theme media query lazily and removes the handler from its original owner', () => {
    const first = vi.fn()
    const second = vi.fn()
    onThemeChange(first)
    onThemeChange(second)
    expect(host.target.matchMedia).toHaveBeenCalledExactlyOnceWith('(prefers-color-scheme: dark)')
    expect(host.mediaAdd).toHaveBeenCalledTimes(1)
    expect(host.add).not.toHaveBeenCalled()
    const event = new Event('change')
    Object.defineProperty(event, 'matches', { value: true, configurable: true })
    host.media.dispatchEvent(event)
    expect(first).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' })
    Object.defineProperty(event, 'matches', { value: false })
    host.media.dispatchEvent(event)
    expect(second).toHaveBeenLastCalledWith({ theme: 'light' })
    offThemeChange(first)
    expect(host.mediaRemove).not.toHaveBeenCalled()
    vi.stubGlobal('window', createHost().target)
    offThemeChange()
    expect(host.mediaRemove.mock.calls).toEqual(host.mediaAdd.mock.calls)
  })

  it('unsubscribes from the captured window and can subscribe again after SSR', () => {
    const handler = vi.fn()
    vi.stubGlobal('window', undefined)
    expect(() => onError(handler)).not.toThrow()
    vi.stubGlobal('window', host.target)
    onError(handler)
    expect(host.add).toHaveBeenCalledTimes(1)
    vi.stubGlobal('window', createHost().target)
    offError(handler)
    expect(host.remove.mock.calls).toEqual(host.add.mock.calls)
  })

  it('supports legacy media queries and detaches the exact callback on the last off', () => {
    const media = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('window', { matchMedia: () => media })
    const handler = vi.fn()
    onThemeChange(handler)
    onThemeChange(handler)
    expect(media.addListener).toHaveBeenCalledTimes(1)
    const listener = media.addListener.mock.calls[0]?.[0] as (event: { matches: boolean }) => void
    listener({ matches: true })
    expect(handler).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' })
    const modernRemove = vi.fn()
    Object.assign(media, { addEventListener: vi.fn(), removeEventListener: modernRemove })
    offThemeChange(handler)
    expect(media.removeListener.mock.calls).toEqual(media.addListener.mock.calls)
    expect(modernRemove).not.toHaveBeenCalled()
  })

  it('can bind theme changes after subscribing without a supported browser host', () => {
    const handler = vi.fn()
    vi.stubGlobal('window', undefined)
    expect(() => onThemeChange(handler)).not.toThrow()
    vi.stubGlobal('window', {})
    expect(() => onThemeChange(handler)).not.toThrow()
    vi.stubGlobal('window', { matchMedia: () => ({}) })
    expect(() => onThemeChange(handler)).not.toThrow()
    vi.stubGlobal('window', host.target)
    onThemeChange(handler)
    expect(host.mediaAdd).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid subscriptions and unknown removals, and clears all callbacks with off()', () => {
    const subscribe = onError as (handler: unknown) => void
    subscribe(undefined)
    subscribe({})
    expect(host.add).not.toHaveBeenCalled()
    const first = vi.fn()
    const second = vi.fn()
    onError(first)
    onError(second)
    offError(vi.fn())
    expect(host.remove).not.toHaveBeenCalled()
    offError()
    expect(host.remove.mock.calls).toEqual(host.add.mock.calls)
    host.target.dispatchEvent(new ErrorEvent('error', { message: 'removed' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
  })

  it('dispatches the callback snapshot when listeners change during an event', () => {
    const calls: string[] = []
    const second = () => calls.push('second')
    const added = () => calls.push('added')
    onError(() => {
      calls.push('first')
      offError(second)
      onError(added)
    })
    onError(second)
    const event = new ErrorEvent('error', { message: 'snapshot' })
    host.target.dispatchEvent(event)
    expect(calls).toEqual(['first', 'second'])
    host.target.dispatchEvent(event)
    expect(calls).toEqual(['first', 'second', 'first', 'added'])
    expect(host.add).toHaveBeenCalledTimes(1)
    offError()
    expect(host.remove.mock.calls).toEqual(host.add.mock.calls)
  })

  it('isolates failing callbacks and obeys the existing warning policy', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setRuntimeWarningOptions({ level: 'off' })
    onError(() => {
      throw new Error('listener failed')
    })
    const healthy = vi.fn()
    onError(healthy)
    expect(() => host.target.dispatchEvent(new ErrorEvent('error', { message: 'boom' }))).not.toThrow()
    expect(healthy).toHaveBeenCalledExactlyOnceWith('boom')
    expect(warn).not.toHaveBeenCalled()
  })

  it('deduplicates callback failures and honors error-level logging', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    onError(() => {
      throw new Error('listener failed')
    })
    const event = new ErrorEvent('error', { message: 'boom' })
    host.target.dispatchEvent(event)
    host.target.dispatchEvent(event)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('onError')
    setRuntimeWarningOptions({ level: 'error', dedupe: false })
    host.target.dispatchEvent(event)
    host.target.dispatchEvent(event)
    expect(error).toHaveBeenCalledTimes(2)
  })
})
