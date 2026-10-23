// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

import { createScrollView, getViewport, scrollTo, setMetrics } from './scrollView/helpers'

describe('scroll-view boundary events', () => {
  beforeAll(() => ensureNativeComponentsDefined())

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('reports scrolltolower once per approach to the bottom', () => {
    const element = createScrollView({ 'scroll-y': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const events: CustomEvent[] = []
    element.addEventListener('scrolltolower', event => events.push(event as CustomEvent))

    scrollTo(element, { top: 640 })
    expect(events).toHaveLength(0)

    scrollTo(element, { top: 650 })
    expect(events).toHaveLength(1)
    expect(events[0]?.detail).toEqual({ direction: 'bottom' })
    expect(events[0]?.bubbles).toBe(false)
    expect(events[0]?.composed).toBe(false)

    scrollTo(element, { top: 700 })
    expect(events).toHaveLength(1)

    scrollTo(element, { top: 100 })
    scrollTo(element, { top: 700 })
    expect(events).toHaveLength(2)
  })

  it('reports scrolltoupper once per approach to the top', () => {
    const element = createScrollView({ 'scroll-y': '' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const events: CustomEvent[] = []
    element.addEventListener('scrolltoupper', event => events.push(event as CustomEvent))

    scrollTo(element, { top: 200 })
    expect(events).toHaveLength(0)

    scrollTo(element, { top: 50 })
    expect(events).toHaveLength(1)
    expect(events[0]?.detail).toEqual({ direction: 'top' })
    expect(events[0]?.bubbles).toBe(false)
    expect(events[0]?.composed).toBe(false)

    scrollTo(element, { top: 0 })
    expect(events).toHaveLength(1)
  })

  it('honours lower-threshold and upper-threshold attributes', () => {
    const element = createScrollView({ 'scroll-y': '', 'lower-threshold': '100', 'upper-threshold': '120' })
    setMetrics(getViewport(element), { scrollHeight: 1000, clientHeight: 300 })
    const lowerEvents: CustomEvent[] = []
    const upperEvents: CustomEvent[] = []
    element.addEventListener('scrolltolower', event => lowerEvents.push(event as CustomEvent))
    element.addEventListener('scrolltoupper', event => upperEvents.push(event as CustomEvent))

    scrollTo(element, { top: 590 })
    scrollTo(element, { top: 130 })
    expect(lowerEvents).toHaveLength(0)
    expect(upperEvents).toHaveLength(0)

    scrollTo(element, { top: 600 })
    expect(lowerEvents).toHaveLength(1)

    scrollTo(element, { top: 120 })
    expect(upperEvents).toHaveLength(1)
  })

  it('reports the horizontal boundary for scroll-x', () => {
    const element = createScrollView({ 'scroll-x': '' })
    setMetrics(getViewport(element), { scrollWidth: 800, clientWidth: 300 })
    const lowerEvents: CustomEvent[] = []
    const upperEvents: CustomEvent[] = []
    element.addEventListener('scrolltolower', event => lowerEvents.push(event as CustomEvent))
    element.addEventListener('scrolltoupper', event => upperEvents.push(event as CustomEvent))

    scrollTo(element, { left: 100 })
    expect(upperEvents).toHaveLength(0)

    scrollTo(element, { left: 450 })
    expect(lowerEvents).toHaveLength(1)
    expect(lowerEvents[0]?.detail).toEqual({ direction: 'right' })

    scrollTo(element, { left: 0 })
    expect(upperEvents).toHaveLength(1)
    expect(upperEvents[0]?.detail).toEqual({ direction: 'left' })
  })

  it('keeps the boundary state of disabled axes idle', () => {
    const element = createScrollView({ 'scroll-y': '' })
    setMetrics(getViewport(element), { scrollHeight: 0, clientHeight: 0, scrollWidth: 800, clientWidth: 300 })
    const events: CustomEvent[] = []
    element.addEventListener('scrolltolower', event => events.push(event as CustomEvent))

    scrollTo(element, { top: 0, left: 700 })

    expect(events).toHaveLength(0)
  })
})
