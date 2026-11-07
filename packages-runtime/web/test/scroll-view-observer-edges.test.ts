// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { scrollToTarget } from '../src/runtime/nativeComponents/scrollView/position'
import { scrollViewport } from '../src/runtime/nativeComponents/scrollView/scroll'
import { createScrollView, getViewport, scrollTo, setMetrics } from './scrollView/helpers'

beforeAll(() => ensureNativeComponentsDefined())
afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('scroll-view observer and callback boundaries', () => {
  it('keeps scrolling available on hosts without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const host = createScrollView({ 'scroll-y': '' })
    host.scrollTop = 37
    expect(host.scrollTop).toBe(37)
    host.remove()
    document.body.append(host)
    expect(host.scrollTop).toBe(37)
  })

  it('retries target alignment when ResizeObserver reports the initial viewport size', () => {
    const callbacks: ResizeObserverCallback[] = []
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback)
      }

      observe = vi.fn()
      disconnect = disconnect
    })
    const host = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(host)
    const target = document.createElement('div')
    target.id = 'pending-target'
    target.getBoundingClientRect = () => ({ top: 200, bottom: 240, left: 0, right: 40 }) as DOMRect
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0 }) as DOMRect
    setMetrics(viewport, { clientHeight: 0, clientWidth: 0 })
    host.append(target)
    host.setAttribute('scroll-into-view', target.id)
    expect(host.scrollTop).toBe(0)
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100 }) as DOMRect
    callbacks[0]!([], {} as ResizeObserver)
    expect(host.scrollTop).toBe(200)
    host.remove()
    expect(disconnect).toHaveBeenCalledOnce()
    host.setAttribute('scroll-into-view-offset', '20')
    expect(host.scrollTop).toBe(200)
  })

  it('ignores a stale scroll-end callback and stops boundary dispatch after a scroll handler detaches the host', () => {
    vi.useFakeTimers()
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const host = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(host)
    setMetrics(viewport, { scrollHeight: 1000, clientHeight: 100 })
    const lower = vi.fn()
    const end = vi.fn()
    host.addEventListener('scrolltolower', lower)
    host.addEventListener('scrollend', end)
    host.addEventListener('scroll', () => host.remove(), { once: true })
    scrollTo(host, { top: 900 })
    const callback = timers.mock.calls.find(([, delay]) => delay === 150)![0]
    expect(lower).not.toHaveBeenCalled()
    document.body.append(host)
    if (typeof callback === 'function') {
      callback()
    }
    expect(end).not.toHaveBeenCalled()
    scrollTo(host, { top: 850 })
    vi.advanceTimersByTime(150)
    expect(end).toHaveBeenCalledOnce()
  })

  it('runs child-list alignment callbacks without changing an already aligned target', () => {
    const callbacks: MutationCallback[] = []
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: MutationCallback) {
        callbacks.push(callback)
      }

      observe = vi.fn()
      disconnect = vi.fn()
    })
    const host = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(host)
    setMetrics(viewport, { clientHeight: 100 })
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100 }) as DOMRect
    const target = document.createElement('div')
    target.id = 'observed-target'
    target.getBoundingClientRect = () => ({ top: 200, bottom: 240, left: 0, right: 40 }) as DOMRect
    host.append(target)
    host.setAttribute('scroll-into-view', target.id)
    expect(host.scrollTop).toBe(200)
    host.scrollTop = 25
    callbacks.at(-1)!([], {} as MutationObserver)
    expect(host.scrollTop).toBe(25)
  })

  it.each([
    [-20, 50, 180],
    [-200, 80, 180],
    [-20, 200, 200],
    [20, 220, 220],
  ])('uses nearest alignment for target bounds %i..%i', (top, bottom, expected) => {
    const host = document.createElement('div')
    host.setAttribute('scroll-y', '')
    host.setAttribute('scroll-into-view-alignment', 'nearest')
    const viewport = document.createElement('div')
    const target = document.createElement('div')
    viewport.scrollTop = 200
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100 }) as DOMRect
    target.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 40 }) as DOMRect
    setMetrics(viewport, { clientHeight: 100 })
    expect(scrollToTarget(host, viewport, target)).toBe(true)
    expect(viewport.scrollTop).toBe(expected)
  })

  it('preserves the untouched horizontal native position when there is no pending programmatic target', async () => {
    const host = document.createElement('div')
    const viewport = document.createElement('div')
    viewport.scrollTop = 12
    viewport.scrollLeft = 34
    const scroll = vi.spyOn(viewport, 'scrollTo')
    scrollViewport(host, viewport, { top: 56 })
    expect(scroll).toHaveBeenLastCalledWith({ top: 56, left: 34, behavior: 'auto' })
    await Promise.resolve()
    scrollViewport(host, viewport, { left: 78 })
    expect(scroll).toHaveBeenLastCalledWith({ top: 56, left: 78, behavior: 'auto' })
  })
})
