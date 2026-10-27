// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createScrollView, getViewport, scrollTo, setMetrics } from './scrollView/helpers'

describe('scroll-view lifecycle state', () => {
  beforeAll(() => ensureNativeComponentsDefined())
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('commits the first scroll snapshot before reentrant start callbacks and uses one end timer', () => {
    const element = createScrollView({ 'scroll-y': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const values: Array<[string, number, number]> = []
    element.addEventListener('scrollstart', (event) => {
      const { scrollTop, deltaY } = (event as CustomEvent).detail
      values.push(['start', scrollTop, deltaY])
      scrollTo(element, { top: 200 })
    })
    element.addEventListener('scroll', (event) => {
      const { scrollTop, deltaY } = (event as CustomEvent).detail
      values.push(['scroll', scrollTop, deltaY])
    })
    const end = vi.fn()
    element.addEventListener('scrollend', end)
    scrollTo(element, { top: 100 })
    expect(values).toEqual([['start', 100, 100], ['scroll', 200, 100], ['scroll', 100, 100]])
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(150)
    expect(end).toHaveBeenCalledTimes(1)
    expect(end.mock.calls[0]?.[0].detail).toMatchObject({ scrollTop: 200, deltaY: 0 })
  })

  it('ends disconnected sessions and starts a fresh session after reconnecting', () => {
    const element = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(element)
    const start = vi.fn()
    const end = vi.fn()
    const scroll = vi.fn()
    element.addEventListener('scrollstart', start)
    element.addEventListener('scrollend', end)
    element.addEventListener('scroll', scroll)
    scrollTo(element, { top: 100 })
    element.remove()
    expect(vi.getTimerCount()).toBe(0)
    scrollTo(element, { top: 200 })
    expect(scroll).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    expect(end).not.toHaveBeenCalled()
    document.body.append(element)
    expect(getViewport(element)).toBe(viewport)
    scrollTo(element, { top: 250 })
    expect(start).toHaveBeenCalledTimes(2)
    expect(scroll.mock.lastCall?.[0].detail.deltaY).toBe(50)
    vi.advanceTimersByTime(150)
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('does not schedule an end after a scroll callback disconnects the owner', () => {
    const element = createScrollView()
    const end = vi.fn()
    element.addEventListener('scroll', () => element.remove())
    element.addEventListener('scrollend', end)
    scrollTo(element, { top: 100 })
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(200)
    expect(end).not.toHaveBeenCalled()
  })

  it('does not forward an old session after a start callback reconnects the owner', () => {
    const element = createScrollView()
    const scroll = vi.fn()
    element.addEventListener('scrollstart', () => {
      element.remove()
      document.body.append(element)
    }, { once: true })
    element.addEventListener('scroll', scroll)
    scrollTo(element, { top: 100 })
    expect(scroll).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    scrollTo(element, { top: 150 })
    expect(scroll).toHaveBeenCalledOnce()
    expect(scroll.mock.lastCall?.[0].detail.deltaY).toBe(50)
  })
})
