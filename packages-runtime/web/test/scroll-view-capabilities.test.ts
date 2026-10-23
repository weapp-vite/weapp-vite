// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

type ScrollViewElement = HTMLElement & {
  scrollLeft: number
  scrollTop: number
}

function createScrollView() {
  return document.createElement('weapp-scroll-view') as ScrollViewElement
}

function getViewport(element: HTMLElement) {
  return element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
}

function mockScrollMetrics(viewport: HTMLDivElement, metrics: { scrollHeight?: number, scrollWidth?: number } = {}) {
  Object.defineProperties(viewport, {
    scrollHeight: { configurable: true, value: metrics.scrollHeight ?? 1000 },
    scrollWidth: { configurable: true, value: metrics.scrollWidth ?? 1000 },
  })
}

describe('scroll-view capabilities', () => {
  beforeAll(() => ensureNativeComponentsDefined())

  afterEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('exposes the extended attribute set', () => {
    expect((createScrollView().constructor as typeof HTMLElement).observedAttributes).toEqual(
      expect.arrayContaining([
        'scroll-into-view',
        'scroll-into-view-offset',
        'enable-flex',
        'show-scrollbar',
      ]),
    )
  })

  it('applies enable-flex to the inner viewport', () => {
    const element = createScrollView()
    document.body.append(element)
    const viewport = getViewport(element)

    expect(viewport.classList.contains('flex')).toBe(false)
    element.setAttribute('enable-flex', 'true')
    expect(viewport.classList.contains('flex')).toBe(true)
  })

  it('hides the scrollbar unless show-scrollbar is set', () => {
    const element = createScrollView()
    document.body.append(element)
    const viewport = getViewport(element)

    expect(viewport.classList.contains('no-scrollbar')).toBe(true)
    element.setAttribute('show-scrollbar', 'true')
    expect(viewport.classList.contains('no-scrollbar')).toBe(false)
  })

  it('emits scrollstart once and scrollend after scrolling stops', () => {
    vi.useFakeTimers()
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    const target = document.createElement('div')
    element.append(target)
    document.body.append(element)
    const viewport = getViewport(element)
    mockScrollMetrics(viewport)

    const onStart = vi.fn()
    const onEnd = vi.fn()
    element.addEventListener('scrollstart', onStart)
    element.addEventListener('scrollend', onEnd)

    viewport.dispatchEvent(new Event('scroll'))
    viewport.dispatchEvent(new Event('scroll'))

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('still emits the plain scroll event', () => {
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    element.append(document.createElement('div'))
    document.body.append(element)
    const viewport = getViewport(element)
    mockScrollMetrics(viewport)

    const onScroll = vi.fn()
    element.addEventListener('scroll', onScroll)
    viewport.dispatchEvent(new Event('scroll'))

    expect(onScroll).toHaveBeenCalledTimes(1)
  })

  it('scrolls to the element referenced by scroll-into-view', () => {
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    const section = document.createElement('div')
    section.id = 'section-3'
    element.append(section)
    document.body.append(element)

    const viewport = getViewport(element)
    mockScrollMetrics(viewport)
    let scrollTop = 0
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    // 目标在视口下方，需要滚动才能看到
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 600, left: 0, right: 400 }) as DOMRect
    section.getBoundingClientRect = () => ({ top: 700, bottom: 800, left: 0, right: 400 }) as DOMRect

    element.setAttribute('scroll-into-view', 'section-3')

    expect(scrollTop).toBe(700)
  })

  it('applies scroll-into-view-offset when scrolling', () => {
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    const section = document.createElement('div')
    section.id = 'target'
    element.append(section)
    document.body.append(element)

    const viewport = getViewport(element)
    mockScrollMetrics(viewport)
    let scrollTop = 0
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 600, left: 0, right: 400 }) as DOMRect
    section.getBoundingClientRect = () => ({ top: 700, bottom: 800, left: 0, right: 400 }) as DOMRect

    element.setAttribute('scroll-into-view-offset', '40')
    element.setAttribute('scroll-into-view', 'target')

    expect(scrollTop).toBe(660)
  })

  it('ignores scroll-into-view when the target is missing', () => {
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    element.append(document.createElement('div'))
    document.body.append(element)

    const viewport = getViewport(element)
    mockScrollMetrics(viewport)
    expect(() => element.setAttribute('scroll-into-view', 'not-exist')).not.toThrow()
  })

  it('does not scroll when the target is already visible', () => {
    const element = createScrollView()
    element.setAttribute('scroll-y', 'true')
    const section = document.createElement('div')
    section.id = 'visible'
    element.append(section)
    document.body.append(element)

    const viewport = getViewport(element)
    mockScrollMetrics(viewport)
    let scrollTop = 120
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
    })
    viewport.getBoundingClientRect = () => ({ top: 0, bottom: 600, left: 0, right: 400 }) as DOMRect
    section.getBoundingClientRect = () => ({ top: 200, bottom: 260, left: 0, right: 400 }) as DOMRect

    element.setAttribute('scroll-into-view', 'visible')

    expect(scrollTop).toBe(120)
  })
})
