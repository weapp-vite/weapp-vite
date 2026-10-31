// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenRuntimeEvent, markComponentEvent, registerComponentEventTarget } from '../src/runtime/componentEvents'

const disposers: Array<() => void> = []

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose()
  }
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 7,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    isPrimary: true,
    clientX: 25,
    clientY: 40,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('desktop touch compatibility', () => {
  it('delivers mouse drag events once and follows the original target outside its bounds', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const calls: string[] = []
    for (const name of ['touchstart', 'touchmove', 'touchend']) {
      disposers.push(listenRuntimeEvent(target, name, event => calls.push(event.type)))
    }
    pointer(target, 'pointerdown')
    pointer(document.body, 'pointermove')
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['touchstart', 'touchmove', 'touchend'])
  })

  it('dispatches one logical stream through capture and bubble without stopping source pointers', () => {
    const parent = document.createElement('div')
    const target = document.createElement('div')
    parent.append(target)
    document.body.append(parent)
    const calls: string[] = []
    disposers.push(listenRuntimeEvent(parent, 'touchmove', () => calls.push('capture'), true))
    disposers.push(listenRuntimeEvent(target, 'touchmove', (event) => {
      calls.push('target')
      event.stopPropagation()
      event.preventDefault()
    }))
    disposers.push(listenRuntimeEvent(parent, 'touchmove', () => calls.push('bubble')))
    target.addEventListener('pointermove', () => calls.push('pointer'))
    pointer(target, 'pointerdown')
    const move = pointer(target, 'pointermove')
    expect(calls).toEqual(['capture', 'target', 'pointer'])
    expect(move.defaultPrevented).toBe(true)
  })

  it('works for mouse on hybrid devices and leaves native touch and pen pointers alone', () => {
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(5)
    const target = document.createElement('div')
    document.body.append(target)
    const handler = vi.fn()
    disposers.push(listenRuntimeEvent(target, 'touchstart', handler))
    pointer(target, 'pointermove')
    pointer(target, 'pointerdown', { button: 2 })
    pointer(target, 'pointerdown', { pointerType: 'touch' })
    pointer(target, 'pointerdown', { pointerType: 'pen' })
    expect(handler).not.toHaveBeenCalled()
    const nativeTouch = new TouchEvent('touchstart', { bubbles: true, composed: true })
    target.dispatchEvent(nativeTouch)
    expect(handler).toHaveBeenCalledExactlyOnceWith(nativeTouch)
    pointer(target, 'pointerdown')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('keeps component custom touches separate and accepts native gestures on a component host', () => {
    const target = document.createElement('div')
    document.body.append(target)
    registerComponentEventTarget(target)
    const handler = vi.fn()
    disposers.push(listenRuntimeEvent(target, 'touchstart', handler))
    const detail = { own: true }
    const event = markComponentEvent(new CustomEvent('touchstart', { detail }))
    target.dispatchEvent(event)
    expect(handler).toHaveBeenCalledExactlyOnceWith(event)
    pointer(target, 'pointerdown')
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler.mock.calls[0]?.[0].detail).toBe(detail)
  })

  it('cancels on blur, ignores unrelated pointers and releases temporary subscriptions on disposal', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const calls: string[] = []
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      disposers.push(listenRuntimeEvent(target, name, event => calls.push(event.type)))
    }
    pointer(target, 'pointerdown')
    pointer(document.body, 'pointerup', { pointerId: 99 })
    window.dispatchEvent(new Event('blur'))
    pointer(document.body, 'pointermove')
    expect(calls).toEqual(['touchstart', 'touchcancel'])
    pointer(target, 'pointerdown')
    for (const dispose of disposers.splice(0)) {
      dispose()
      dispose()
    }
    pointer(document.body, 'pointerup')
    pointer(target, 'pointerdown')
    expect(calls).toEqual(['touchstart', 'touchcancel', 'touchstart'])
    for (const name of ['pointermove', 'pointerup', 'pointercancel', 'blur']) {
      expect(add.mock.calls.filter(([type]) => type === name)).toHaveLength(2)
      expect(remove.mock.calls.filter(([type]) => type === name)).toHaveLength(2)
    }
  })

  it('does not retain a session when a touchstart handler synchronously removes its origin', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const start = vi.fn(() => target.remove())
    const move = vi.fn()
    disposers.push(listenRuntimeEvent(target, 'touchstart', start))
    disposers.push(listenRuntimeEvent(target, 'touchmove', move))
    pointer(target, 'pointerdown')
    pointer(document.body, 'pointermove')
    pointer(document.body, 'pointerup')
    expect(start).toHaveBeenCalledOnce()
    expect(move).not.toHaveBeenCalled()
    document.body.append(target)
    pointer(document.body, 'pointermove')
    expect(move).not.toHaveBeenCalled()
  })

  it('ends a missed release before a fresh press and cancels when the mouse returns without a pressed button', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const calls: string[] = []
    for (const name of ['touchstart', 'touchcancel']) {
      disposers.push(listenRuntimeEvent(target, name, event => calls.push(event.type)))
    }
    pointer(target, 'pointerdown')
    pointer(target, 'pointerdown')
    pointer(document.body, 'pointermove', { buttons: 0 })
    pointer(document.body, 'pointermove', { buttons: 0 })
    expect(calls).toEqual(['touchstart', 'touchcancel', 'touchstart', 'touchcancel'])
  })

  it('finishes a fresh caught gesture after a blurred session without retaining its previous cancellation', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const calls: string[] = []
    for (const name of ['touchstart', 'touchend', 'touchcancel']) {
      disposers.push(listenRuntimeEvent(target, name, (event) => {
        event.stopPropagation()
        calls.push(event.type)
      }))
    }
    const source = vi.fn()
    target.addEventListener('pointerdown', source)
    pointer(target, 'pointerdown')
    window.dispatchEvent(new Event('blur'))
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['touchstart', 'touchcancel'])
    calls.length = 0
    pointer(target, 'pointerdown')
    pointer(target, 'pointerup')
    expect(calls).toEqual(['touchstart', 'touchend'])
    expect(source).toHaveBeenCalledTimes(2)
  })
})
