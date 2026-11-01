// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createScrollView, getViewport } from './scrollView/helpers'

function setup() {
  const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '', 'refresher-triggered': 'false' })
  const child = document.createElement('div')
  host.append(child)
  const events: Array<{ type: string, dy: number }> = []
  for (const type of ['refresherpulling', 'refresherrefresh', 'refresherabort', 'refresherrestore']) {
    host.addEventListener(type, (event) => {
      expect(event.bubbles).toBe(false)
      events.push({ type, dy: (event as CustomEvent).detail.dy })
    })
  }
  return { host, child, events, types: () => events.map(event => event.type) }
}

function touch(target: HTMLElement, type: string, x: number, y: number, cancelable = true) {
  const event = new Event(type, { bubbles: true, composed: true, cancelable })
  const point = { identifier: 1, clientX: x, clientY: y, pageX: x, pageY: y }
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] },
    changedTouches: { value: [point] },
  })
  target.dispatchEvent(event)
  return event
}

describe('scroll-view refresher native contract', () => {
  beforeAll(() => ensureNativeComponentsDefined())
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('aborts short pulls without a restore event and claims the first cancellable downward move', () => {
    const { host, child, types } = setup()
    touch(child, 'touchstart', 20, 10)
    const move = touch(child, 'touchmove', 20, 30)
    expect(move.defaultPrevented).toBe(true)
    expect(getViewport(host).style.transform).toBe('translateY(10px)')
    expect(host.scrollTop).toBe(0)
    touch(child, 'touchend', 20, 30)
    expect(types()).toEqual(['refresherpulling', 'refresherabort'])
    vi.runAllTimers()
    expect(getViewport(host).style.transform).toBe('')
    expect(types()).toEqual(['refresherpulling', 'refresherabort'])
  })

  it('refreshes after the threshold, accepts unchanged false commits and keeps scroll sessions separate', () => {
    const { host, child, events, types } = setup()
    const scroll = vi.fn()
    host.addEventListener('scrollstart', scroll)
    touch(child, 'touchstart', 20, 10)
    touch(child, 'touchmove', 20, 110)
    touch(child, 'touchend', 20, 110)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    expect(events[1]?.dy).toBe(50)
    expect(host.getAttribute('refresher-triggered')).toBe('false')
    host.setAttribute('refresher-triggered', 'false')
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    vi.runAllTimers()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('programmatic refresh emits pulling then refresh; restore reentry waits for a new explicit commit', () => {
    const { host, types } = setup()
    host.setAttribute('refresher-triggered', 'true')
    expect(types()).toEqual(['refresherpulling'])
    vi.advanceTimersByTime(180)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh'])
    host.addEventListener('refresherrestore', () => host.setAttribute('refresher-triggered', 'true'), { once: true })
    host.setAttribute('refresher-triggered', 'false')
    vi.advanceTimersByTime(500)
    expect(types()).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    host.setAttribute('refresher-triggered', 'true')
    vi.advanceTimersByTime(180)
    expect(types().slice(-2)).toEqual(['refresherpulling', 'refresherrefresh'])
  })

  it('cancels pending transitions on disable and disconnect without inventing terminal events', () => {
    const { host, types } = setup()
    host.setAttribute('refresher-triggered', 'true')
    host.setAttribute('refresher-enabled', 'false')
    vi.runAllTimers()
    expect(types()).toEqual(['refresherpulling'])
    expect(getViewport(host).style.transform).toBe('')
    host.setAttribute('refresher-triggered', 'false')
    host.setAttribute('refresher-enabled', 'true')
    host.setAttribute('refresher-triggered', 'true')
    host.remove()
    vi.runAllTimers()
    expect(types()).toEqual(['refresherpulling', 'refresherpulling'])
    host.setAttribute('refresher-triggered', 'false')
    document.body.append(host)
    host.setAttribute('refresher-triggered', 'true')
    vi.advanceTimersByTime(180)
    expect(types().slice(-2)).toEqual(['refresherpulling', 'refresherrefresh'])
  })

  it.each(['horizontal', 'upward', 'not-top', 'uncancellable', 'nested', 'swiper'] as const)('preserves %s native gestures', (scenario) => {
    const { host, child, types } = setup()
    if (scenario === 'not-top') {
      host.scrollTop = 30
    }
    let target = child
    if (scenario === 'nested' || scenario === 'swiper') {
      const nested = document.createElement(scenario === 'nested' ? 'weapp-scroll-view' : 'weapp-swiper')
      nested.append(child)
      host.append(nested)
      target = child
    }
    touch(target, 'touchstart', 50, 50)
    const move = touch(target, 'touchmove', scenario === 'horizontal' ? 150 : 50, scenario === 'upward' ? 0 : 150, scenario !== 'uncancellable')
    touch(target, 'touchend', 50, 150)
    expect(move.defaultPrevented).toBe(false)
    expect(types()).toEqual([])
  })

  it('keeps the custom refresher slot separate and applies default style and background', () => {
    const { host } = setup()
    const custom = document.createElement('div')
    custom.slot = 'refresher'
    host.append(custom)
    const slot = host.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="refresher"]')!
    expect(slot.assignedElements()).toEqual([custom])
    host.setAttribute('refresher-default-style', 'none')
    host.setAttribute('refresher-background', '#123456')
    expect(host.shadowRoot!.querySelector<HTMLElement>('.refresher-spinner')!.hidden).toBe(true)
    expect(host.shadowRoot!.querySelector<HTMLElement>('.refresher')!.style.background).toBe('#123456')
  })
})
