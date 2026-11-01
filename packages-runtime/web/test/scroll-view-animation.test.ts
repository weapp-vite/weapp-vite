// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createScrollView, getViewport, setMetrics } from './scrollView/helpers'

describe('scroll-view programmatic animation', () => {
  beforeAll(() => ensureNativeComponentsDefined())
  afterEach(() => document.body.replaceChildren())

  it('uses the same animated entry for attributes and public properties', () => {
    const host = createScrollView({ 'scroll-y': '', 'scroll-with-animation': '' })
    const viewport = getViewport(host)
    const scroll = vi.spyOn(viewport, 'scrollTo')
    host.setAttribute('scroll-top', '120')
    expect(scroll).toHaveBeenLastCalledWith({ top: 120, left: 0, behavior: 'smooth' })
    host.scrollLeft = 80
    expect(scroll).toHaveBeenLastCalledWith({ top: 120, left: 80, behavior: 'smooth' })
    host.setAttribute('scroll-with-animation', 'false')
    host.scrollTop = 40
    expect(scroll).toHaveBeenLastCalledWith({ top: 40, left: 80, behavior: 'auto' })
  })

  it('aligns both axes with a single scroll operation', () => {
    const host = createScrollView({ 'scroll-y': '', 'scroll-x': '', 'scroll-with-animation': '' })
    const viewport = getViewport(host)
    setMetrics(viewport, { clientHeight: 100, clientWidth: 100 })
    viewport.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 100 }) as DOMRect
    const target = document.createElement('div')
    target.id = 'target'
    target.getBoundingClientRect = () => ({ top: 200, left: 300, right: 340, bottom: 240 }) as DOMRect
    host.append(target)
    const scroll = vi.spyOn(viewport, 'scrollTo')
    host.setAttribute('scroll-into-view', 'target')
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 200, left: 300, behavior: 'smooth' })
  })

  it('preserves the requested other axis before native smooth scrolling advances', () => {
    const host = createScrollView({ 'scroll-y': '', 'scroll-x': '', 'scroll-with-animation': '' })
    const viewport = getViewport(host)
    const scroll = vi.spyOn(viewport, 'scrollTo').mockImplementation(() => {})
    host.setAttribute('scroll-top', '120')
    host.setAttribute('scroll-left', '80')
    expect(viewport.scrollTop).toBe(0)
    expect(scroll).toHaveBeenLastCalledWith({ top: 120, left: 80, behavior: 'smooth' })
  })
})
