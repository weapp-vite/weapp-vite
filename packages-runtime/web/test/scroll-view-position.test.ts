// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createScrollView, getViewport, setMetrics } from './scrollView/helpers'

function createTarget(element: HTMLElement, id = 'target', top = 300, left = 400) {
  const viewport = getViewport(element)
  setMetrics(viewport, { clientHeight: 200, clientWidth: 200, scrollHeight: 2000, scrollWidth: 2000 })
  Object.defineProperties(viewport, { clientTop: { configurable: true, value: 2 }, clientLeft: { configurable: true, value: 2 } })
  viewport.getBoundingClientRect = () => ({ top: 40, left: 20, bottom: 244, right: 224 }) as DOMRect
  const target = document.createElement('div')
  target.id = id
  target.getBoundingClientRect = () => ({
    top: 42 + top - viewport.scrollTop,
    bottom: 82 + top - viewport.scrollTop,
    left: 22 + left - viewport.scrollLeft,
    right: 62 + left - viewport.scrollLeft,
    height: 40,
    width: 40,
  }) as DOMRect
  return target
}

describe('scroll-view target positioning', () => {
  beforeAll(() => ensureNativeComponentsDefined())
  afterEach(() => document.body.replaceChildren())

  it.each([
    ['start', 300, 400],
    ['center', 220, 320],
    ['end', 140, 240],
    ['nearest', 140, 240],
  ] as const)('supports %s alignment on both axes without counting the viewport border', (alignment, top, left) => {
    const element = createScrollView({ 'scroll-y': '', 'scroll-x': '', 'scroll-into-view-alignment': alignment })
    element.append(createTarget(element))
    element.setAttribute('scroll-into-view', 'target')
    expect(element.scrollTop).toBe(top)
    expect(element.scrollLeft).toBe(left)
  })

  it('leaves fully visible targets in place only for nearest alignment', () => {
    const element = createScrollView({ 'scroll-y': '', 'scroll-into-view-alignment': 'nearest' })
    element.scrollTop = 200
    element.append(createTarget(element))
    element.setAttribute('scroll-into-view', 'target')
    expect(element.scrollTop).toBe(200)
    element.setAttribute('scroll-into-view-alignment', 'start')
    expect(element.scrollTop).toBe(300)
  })

  it('reapplies alignment and offsets without scrolling disabled axes', () => {
    const element = createScrollView({ 'scroll-y': '' })
    element.scrollLeft = 25
    element.append(createTarget(element))
    element.setAttribute('scroll-into-view', 'target')
    element.setAttribute('scroll-into-view-alignment', 'center')
    element.setAttribute('scroll-into-view-offset', '20')
    expect(element.scrollTop).toBe(200)
    expect(element.scrollLeft).toBe(25)
  })

  it('gives target positioning priority over the scroll-top attribute until the target is cleared', () => {
    const element = createScrollView({ 'scroll-y': '' })
    element.append(createTarget(element))
    element.setAttribute('scroll-into-view', 'target')
    element.setAttribute('scroll-top', '50')
    expect(element.scrollTop).toBe(300)
    element.removeAttribute('scroll-into-view')
    element.setAttribute('scroll-top', '60')
    expect(element.scrollTop).toBe(60)
  })

  it('finds a target added or renamed after the target attribute was set', async () => {
    const element = createScrollView({ 'scroll-y': '' })
    const target = createTarget(element, 'later')
    element.setAttribute('scroll-into-view', 'target')
    element.append(target)
    expect(element.scrollTop).toBe(0)
    target.id = 'target'
    await vi.waitFor(() => expect(element.scrollTop).toBe(300))
    element.scrollTop = 20
    const unrelated = document.createElement('div')
    element.append(unrelated)
    await Promise.resolve()
    expect(element.scrollTop).toBe(20)
  })

  it('treats ids as exact values and ignores targets outside the host', () => {
    const element = createScrollView({ 'scroll-y': '' })
    const target = createTarget(element, 'quote"slash\\bracket]')
    const wrapper = document.createElement('div')
    wrapper.append(target)
    element.append(wrapper)
    expect(() => element.setAttribute('scroll-into-view', target.id)).not.toThrow()
    expect(element.scrollTop).toBe(300)
    element.scrollTop = 40
    const outside = createTarget(element, 'outside')
    document.body.append(outside)
    element.setAttribute('scroll-into-view', outside.id)
    expect(element.scrollTop).toBe(40)
  })

  it('positions a replacement with the same id and falls back for invalid values', async () => {
    const element = createScrollView({ 'scroll-y': '', 'scroll-into-view-alignment': 'invalid', 'scroll-into-view-offset': 'invalid' })
    const original = createTarget(element)
    element.append(original)
    element.setAttribute('scroll-into-view', 'target')
    expect(element.scrollTop).toBe(300)
    original.remove()
    element.append(createTarget(element, 'target', 600))
    await vi.waitFor(() => expect(element.scrollTop).toBe(600))
  })
})
