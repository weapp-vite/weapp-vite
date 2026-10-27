// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hideToastBridge, showToastBridge } from '../src/runtime/polyfill/uiFeedback'

function getToast() {
  const toast = document.querySelector<HTMLElement>('[data-weapp-web-toast]')
  expect(toast).not.toBeNull()
  return toast!
}

describe('toast timer ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    await hideToastBridge()
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('cancels the old timeout when hiding and showing another toast', async () => {
    await showToastBridge({ title: 'first', duration: 100 })
    const toast = getToast()
    expect(toast.hidden).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    await hideToastBridge()
    expect(toast.hidden).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await showToastBridge({ title: 'second', duration: 200 })
    vi.advanceTimersByTime(100)
    expect(toast.hidden).toBe(false)
    expect(toast.textContent).toContain('second')
    vi.advanceTimersByTime(100)
    expect(toast.hidden).toBe(true)
  })

  it('ignores an already queued old callback after a new toast takes ownership', async () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    await showToastBridge({ title: 'first', duration: 100 })
    const oldCallback = timeout.mock.calls[0]?.[0]
    expect(typeof oldCallback).toBe('function')
    await hideToastBridge()
    await showToastBridge({ title: 'newer', duration: 200 })
    if (typeof oldCallback === 'function') {
      oldCallback()
    }
    expect(getToast().hidden).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(200)
    expect(getToast().hidden).toBe(true)
  })

  it('closes only the element captured by its own show call', async () => {
    await showToastBridge({ title: 'removed owner', duration: 100 })
    const original = getToast()
    const replacement = original.cloneNode(true) as HTMLElement
    original.replaceWith(replacement)
    vi.advanceTimersByTime(100)
    expect(original.hidden).toBe(true)
    expect(replacement.hidden).toBe(false)
  })
})
