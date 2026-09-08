// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

type ScrollViewElement = HTMLElement & {
  scrollLeft: number
  scrollTop: number
}

function createScrollView() {
  return document.createElement('weapp-scroll-view') as ScrollViewElement
}

describe('scroll-view event ownership', () => {
  beforeAll(() => ensureNativeComponentsDefined())

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('notifies only the nested scrolling owner with two-axis deltas', () => {
    const outer = createScrollView()
    const inner = createScrollView()
    inner.append(document.createElement('div'))
    outer.append(inner)
    document.body.append(outer)

    const innerViewport = inner.shadowRoot!.querySelector('.viewport') as HTMLDivElement
    Object.defineProperties(innerViewport, {
      scrollHeight: { configurable: true, value: 960 },
      scrollWidth: { configurable: true, value: 640 },
    })
    outer.scrollLeft = 9
    outer.scrollTop = 13

    const innerEvents: CustomEvent[] = []
    const outerEvents: CustomEvent[] = []
    inner.addEventListener('scroll', event => innerEvents.push(event as CustomEvent))
    outer.addEventListener('scroll', event => outerEvents.push(event as CustomEvent))

    inner.scrollLeft = 24
    inner.scrollTop = 48
    innerViewport.dispatchEvent(new Event('scroll'))

    expect(innerEvents).toHaveLength(1)
    expect(innerEvents[0]?.target).toBe(inner)
    expect(innerEvents[0]?.bubbles).toBe(false)
    expect(innerEvents[0]?.composed).toBe(false)
    expect(innerEvents[0]?.detail).toEqual({
      deltaX: 24,
      deltaY: 48,
      scrollHeight: 960,
      scrollLeft: 24,
      scrollTop: 48,
      scrollWidth: 640,
    })
    expect(outerEvents).toHaveLength(0)
    expect(outer.scrollLeft).toBe(9)
    expect(outer.scrollTop).toBe(13)
  })

  it('does not rewrap a descendant scroll source as an owner event', () => {
    const outer = createScrollView()
    const descendant = document.createElement('div')
    document.body.append(outer)
    outer.shadowRoot!.querySelector('.viewport')!.append(descendant)

    const observedEvents: Event[] = []
    outer.addEventListener('scroll', event => observedEvents.push(event))
    const descendantEvent = new Event('scroll', { bubbles: true, composed: true })
    descendant.dispatchEvent(descendantEvent)

    expect(observedEvents).toEqual([descendantEvent])
  })
})
