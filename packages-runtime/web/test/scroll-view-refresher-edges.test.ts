// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createScrollViewRefresher } from '../src/runtime/nativeComponents/scrollView/refresher'
import { createTemplate } from '../src/runtime/template'
import { createScrollView, getViewport } from './scrollView/helpers'

let sequence = 0

function touch(target: HTMLElement, type: string, points?: Array<{ identifier: number, clientX: number, clientY: number }>, cancelable = true) {
  const event = new Event(type, { bubbles: true, composed: true, cancelable })
  if (points) {
    Object.defineProperty(event, 'touches', { value: points })
  }
  target.dispatchEvent(event)
  return event
}

function point(y: number, identifier = 1) {
  return { identifier, clientX: 10, clientY: y }
}

beforeAll(() => ensureNativeComponentsDefined())
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('scroll-view refresher input and commit edges', () => {
  it('ignores invalid starts, sub-threshold motion and end events which still contain the active touch', () => {
    const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '' })
    const pulling = vi.fn()
    const refresh = vi.fn()
    host.addEventListener('refresherpulling', pulling)
    host.addEventListener('refresherrefresh', refresh)
    touch(host, 'touchstart')
    touch(host, 'touchstart', [])
    touch(host, 'touchstart', [point(0), point(0, 2)])
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(2)])
    expect(pulling).not.toHaveBeenCalled()
    touch(host, 'touchend', [point(2)])
    touch(host, 'touchmove', [point(100)])
    touch(host, 'touchend')
    expect(pulling).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('aborts a claimed pull on cancel or a missing tracked touch without inventing refreshes', () => {
    const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '' })
    const abort = vi.fn()
    const refresh = vi.fn()
    host.addEventListener('refresherabort', abort)
    host.addEventListener('refresherrefresh', refresh)
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(20)])
    touch(host, 'touchcancel', [])
    expect(abort).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(180)
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(20)])
    touch(host, 'touchmove', [point(30, 2)])
    expect(abort).toHaveBeenCalledTimes(2)
    touch(host, 'touchmove')
    touch(host, 'touchend', [])
    expect(refresh).not.toHaveBeenCalled()
  })

  it('uses the default threshold for invalid values and supports the white default indicator', () => {
    const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '', 'refresher-threshold': '-1', 'refresher-default-style': 'white' })
    const refresh = vi.fn()
    host.addEventListener('refresherrefresh', refresh)
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(100)])
    touch(host, 'touchend', [])
    expect(refresh).toHaveBeenCalledOnce()
    expect((refresh.mock.calls[0]![0] as CustomEvent).detail.dy).toBe(50)
    expect(host.shadowRoot!.querySelector<HTMLElement>('.refresher-spinner')!.style.color).toBe('#fff')
  })

  it('honors an unchanged false controlled data commit while a native pull is active', async () => {
    const tag = `refresher-commit-edge-${++sequence}`
    defineComponent(tag, {
      template: createTemplate('<scroll-view scroll-y="true" refresher-enabled="true" refresher-triggered="{{triggered}}" />'),
      component: { data: { triggered: false } },
    })
    const owner = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
    document.body.append(owner)
    await owner.updateComplete
    const host = owner.shadowRoot!.querySelector<HTMLElement>('weapp-scroll-view')!
    const abort = vi.fn()
    host.addEventListener('refresherabort', abort)
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(20)])
    owner.setData({ triggered: false })
    await owner.updateComplete
    expect(abort).toHaveBeenCalledOnce()
    expect(getViewport(host).style.transform).toBe('')
  })

  it('ignores destroyed refresher commits and stale programmatic completion callbacks', () => {
    const host = document.createElement('div')
    host.setAttribute('scroll-y', '')
    host.setAttribute('refresher-enabled', '')
    const root = host.attachShadow({ mode: 'open' })
    const viewport = document.createElement('div')
    root.append(viewport)
    document.body.append(host)
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const refresher = createScrollViewRefresher(host, viewport)
    const refresh = vi.fn()
    host.addEventListener('refresherrefresh', refresh)
    refresher.sync()
    refresher.commit(true)
    const callback = timers.mock.calls.find(([, delay]) => delay === 180)![0]
    refresher.destroy()
    refresher.commit(true)
    if (typeof callback === 'function') {
      callback()
    }
    expect(refresh).not.toHaveBeenCalled()
    expect(root.querySelector('.refresher')).toBeNull()
  })

  it('ignores an unclaimed touch end and continues a claimed pull through later moves', () => {
    const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '' })
    const pulling = vi.fn()
    const abort = vi.fn()
    host.addEventListener('refresherpulling', pulling)
    host.addEventListener('refresherabort', abort)
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchend', [])
    touch(host, 'touchmove', [point(20)])
    expect(pulling).not.toHaveBeenCalled()
    expect(abort).not.toHaveBeenCalled()
    touch(host, 'touchstart', [point(0)])
    touch(host, 'touchmove', [point(20)])
    touch(host, 'touchmove', [point(40)])
    expect(pulling.mock.calls.map(([event]) => (event as CustomEvent).detail.dy)).toEqual([10, 20])
    touch(host, 'touchend', [])
    expect(abort).toHaveBeenCalledOnce()
  })

  it('coalesces repeated true commits during refreshing and ignores a restore callback after disconnection', () => {
    const host = createScrollView({ 'scroll-y': '', 'refresher-enabled': '' })
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const refresh = vi.fn()
    const restored = vi.fn()
    host.addEventListener('refresherrefresh', refresh)
    host.addEventListener('refresherrestore', restored)
    host.setAttribute('refresher-triggered', 'true')
    host.setAttribute('refresher-triggered', 'true')
    vi.advanceTimersByTime(180)
    expect(refresh).toHaveBeenCalledOnce()
    host.setAttribute('refresher-triggered', 'false')
    expect(restored).toHaveBeenCalledOnce()
    const callback = timers.mock.calls.filter(([, delay]) => delay === 180).at(-1)![0]
    host.remove()
    if (typeof callback === 'function') {
      callback()
    }
    expect(restored).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(host.shadowRoot!.querySelector('.refresher')).toBeNull()
  })
})
