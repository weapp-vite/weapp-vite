// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { setupRpx } from '../src/runtime/rpx'
import { createScrollView, getViewport, scrollTo, setMetrics } from './scrollView/helpers'

function listen(element: HTMLElement, name: string) {
  const directions: string[] = []
  element.addEventListener(name, event => directions.push((event as CustomEvent<{ direction: string }>).detail.direction))
  return directions
}

describe('scroll-view boundary changes', () => {
  beforeAll(() => ensureNativeComponentsDefined())
  afterEach(() => {
    setupRpx()
    document.documentElement.style.removeProperty('--custom-rpx')
    document.body.replaceChildren()
  })

  it.each(['y', 'x'] as const)('rearms scroll-%s after content grows without an intermediate scroll', (axis) => {
    const element = createScrollView({ [`scroll-${axis}`]: '' })
    const viewport = getViewport(element)
    const events = listen(element, 'scrolltolower')
    setMetrics(viewport, { scrollHeight: 1000, clientHeight: 300, scrollWidth: 1000, clientWidth: 300 })
    scrollTo(element, axis === 'y' ? { top: 700 } : { left: 700 })
    expect(events).toEqual([axis === 'y' ? 'bottom' : 'right'])

    setMetrics(viewport, { scrollHeight: 1100, scrollWidth: 1100 })
    expect(events).toHaveLength(1)
    scrollTo(element, axis === 'y' ? { top: 800 } : { left: 800 })
    scrollTo(element, axis === 'y' ? { top: 800 } : { left: 800 })
    expect(events).toEqual(Array.from({ length: 2 }).fill(axis === 'y' ? 'bottom' : 'right'))
  })

  it('rearms after the viewport shrinks and keeps latched boundaries after expansion or content removal', () => {
    const element = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(element)
    const events = listen(element, 'scrolltolower')
    setMetrics(viewport, { scrollHeight: 1000, clientHeight: 300 })
    scrollTo(element, { top: 700 })
    setMetrics(viewport, { clientHeight: 200 })
    scrollTo(element, { top: 800 })
    expect(events).toHaveLength(2)

    setMetrics(viewport, { clientHeight: 300 })
    scrollTo(element, { top: 700 })
    setMetrics(viewport, { scrollHeight: 900 })
    scrollTo(element, { top: 600 })
    expect(events).toHaveLength(2)
  })

  it('does not rearm when content growth stays inside the threshold', () => {
    const element = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(element)
    const events = listen(element, 'scrolltolower')
    setMetrics(viewport, { scrollHeight: 1000, clientHeight: 300 })
    scrollTo(element, { top: 700 })
    setMetrics(viewport, { scrollHeight: 1020 })
    scrollTo(element, { top: 720 })
    expect(events).toEqual(['bottom'])
  })

  it('tracks independent axes and reports the newly entered direction', () => {
    const element = createScrollView({ 'scroll-y': '', 'scroll-x': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300, scrollWidth: 1000, clientWidth: 300 })
    const lower = listen(element, 'scrolltolower')
    const upper = listen(element, 'scrolltoupper')
    scrollTo(element, { top: 700, left: 100 })
    scrollTo(element, { left: 700 })
    scrollTo(element, { top: 100 })
    scrollTo(element, { top: 700 })
    expect(lower).toEqual(['bottom', 'right', 'bottom'])

    scrollTo(element, { top: 0, left: 100 })
    scrollTo(element, { left: 0 })
    scrollTo(element, { top: 100 })
    scrollTo(element, { top: 0 })
    expect(upper).toEqual(['top', 'left', 'top'])
  })

  it('coalesces simultaneous axis entries with horizontal priority', () => {
    const element = createScrollView({ 'scroll-y': '', 'scroll-x': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300, scrollWidth: 1000, clientWidth: 300 })
    const lower = listen(element, 'scrolltolower')
    const upper = listen(element, 'scrolltoupper')
    scrollTo(element, { top: 100, left: 100 })
    scrollTo(element, { top: 700, left: 700 })
    scrollTo(element, { top: 0, left: 0 })
    expect(lower).toEqual(['right'])
    expect(upper).toEqual(['left'])
  })

  it('rearms when thresholds change and resolves rpx against the device width', () => {
    const app = document.createElement('div')
    app.id = 'app'
    Object.defineProperty(app, 'clientWidth', { configurable: true, value: 375 })
    document.body.append(app)
    const element = createScrollView({ 'scroll-y': '', 'lower-threshold': '200rpx', 'upper-threshold': '100px' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const lower = listen(element, 'scrolltolower')
    const upper = listen(element, 'scrolltoupper')
    scrollTo(element, { top: 599 })
    expect(lower).toEqual([])
    scrollTo(element, { top: 600 })
    expect(lower).toEqual(['bottom'])

    Object.defineProperty(app, 'clientWidth', { configurable: true, value: 300 })
    scrollTo(element, { top: 620 })
    expect(lower).toEqual(['bottom', 'bottom'])
    element.setAttribute('lower-threshold', '0')
    scrollTo(element, { top: 700 })
    expect(lower).toHaveLength(3)

    scrollTo(element, { top: 100 })
    element.setAttribute('upper-threshold', '0')
    scrollTo(element, { top: 0 })
    expect(upper).toEqual(['top', 'top'])
  })

  it('clears the state while an axis is disabled or content no longer scrolls', () => {
    const element = createScrollView({ 'scroll-y': '' })
    const viewport = getViewport(element)
    setMetrics(viewport, { scrollHeight: 1000, clientHeight: 300 })
    const lower = listen(element, 'scrolltolower')
    scrollTo(element, { top: 700 })
    element.setAttribute('scroll-y', 'false')
    scrollTo(element, { top: 700 })
    element.setAttribute('scroll-y', '')
    scrollTo(element, { top: 700 })
    setMetrics(viewport, { scrollHeight: 300 })
    scrollTo(element, { top: 0 })
    setMetrics(viewport, { scrollHeight: 1000 })
    scrollTo(element, { top: 700 })
    expect(lower).toEqual(['bottom', 'bottom', 'bottom'])
  })

  it('uses the configured runtime design width for rpx thresholds', () => {
    const app = document.createElement('div')
    app.id = 'app'
    Object.defineProperty(app, 'clientWidth', { configurable: true, value: 375 })
    document.body.append(app)
    setupRpx({ designWidth: 375, varName: '--custom-rpx' })
    const element = createScrollView({ 'scroll-y': '', 'lower-threshold': '100rpx' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const lower = listen(element, 'scrolltolower')
    scrollTo(element, { top: 599 })
    expect(lower).toEqual([])
    scrollTo(element, { top: 600 })
    expect(lower).toEqual(['bottom'])
    expect(document.documentElement.style.getPropertyValue('--custom-rpx')).toBe('1px')
  })

  it.each(['100vh', '100garbage', '-1', 'Infinity', '1e999px'])('falls back to 50px for invalid threshold %s', (threshold) => {
    const element = createScrollView({ 'scroll-y': '', 'lower-threshold': threshold })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const lower = listen(element, 'scrolltolower')
    scrollTo(element, { top: 649 })
    expect(lower).toEqual([])
    scrollTo(element, { top: 650 })
    expect(lower).toEqual(['bottom'])
  })

  it('commits boundary state before scroll handlers run and keeps event order', () => {
    const element = createScrollView({ 'scroll-y': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const calls: string[] = []
    let nested = false
    element.addEventListener('scroll', () => {
      calls.push('scroll')
      if (!nested) {
        nested = true
        scrollTo(element, { top: 700 })
      }
    })
    element.addEventListener('scrolltolower', () => calls.push('bottom'))
    scrollTo(element, { top: 700 })
    expect(calls).toEqual(['scroll', 'scroll', 'bottom'])
  })
})
