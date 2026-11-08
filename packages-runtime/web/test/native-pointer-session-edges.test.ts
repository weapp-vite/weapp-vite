// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { registerNativeComponentNode, resolveNativeComponentNode } from '../src/runtime/nativeComponents/nodeRegistry'
import { watchNativePointerSession } from '../src/runtime/nativeComponents/pointerSession'
import { registerRuntimeTouchTarget } from '../src/runtime/touchEvents/coordinator'
import { resolveTouchCanvas } from '../src/runtime/touchEvents/data'
import { createRuntimeEventPayload } from '../src/runtime/touchEvents/payload'

const disposers: Array<() => void> = []

function pointer(target: EventTarget, name: string, init: PointerEventInit = {}) {
  const event = new PointerEvent(name, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 10,
    clientY: 20,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

beforeAll(() => ensureNativeComponentsDefined())

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose()
  }
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('native pointer ownership boundaries', () => {
  it('preserves non-object native node inputs and resolves registered hosts independently', () => {
    for (const value of [undefined, null, false, 0, 'node']) {
      expect(resolveNativeComponentNode(value)).toBe(value)
    }
    const host = {}
    const node = {}
    registerNativeComponentNode(host, node)
    expect(resolveNativeComponentNode(host)).toBe(node)
    const other = {}
    expect(resolveNativeComponentNode(other)).toBe(other)
  })

  it.each([undefined, false, true])('releases capture only when the capture API is absent or reports ownership: %s', (captured) => {
    const element = document.createElement('div')
    document.body.append(element)
    const release = vi.fn()
    Object.defineProperties(element, {
      hasPointerCapture: { configurable: true, value: captured === undefined ? undefined : () => captured },
      releasePointerCapture: { configurable: true, value: release },
    })
    const cancel = vi.fn()
    const dispose = watchNativePointerSession(element, new PointerEvent('pointerdown', { pointerId: 1 }), cancel)
    dispose()
    dispose()
    expect(release).toHaveBeenCalledTimes(captured === false ? 0 : 1)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('cancels a mouse session on a new mouse pointer while ignoring unrelated touch pointers', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const cancel = vi.fn()
    disposers.push(watchNativePointerSession(element, new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse' }), cancel))
    pointer(window, 'pointerdown', { pointerId: 2, pointerType: 'touch' })
    expect(cancel).not.toHaveBeenCalled()
    pointer(window, 'pointerdown', { pointerId: 2 })
    pointer(window, 'pointerdown', { pointerId: 3 })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('normalizes non-finite pointer identities and ignores a different pointer interruption', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const initial = new PointerEvent('pointerdown', { pointerType: 'touch' })
    Object.defineProperty(initial, 'pointerId', { value: Number.NaN })
    const cancel = vi.fn()
    disposers.push(watchNativePointerSession(element, initial, cancel))
    pointer(window, 'pointercancel', { pointerId: 9 })
    pointer(window, 'pointerdown', { pointerId: 9, pointerType: 'touch' })
    expect(cancel).not.toHaveBeenCalled()
    const interrupted = new Event('pointercancel')
    window.dispatchEvent(interrupted)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('ignores secondary-button movable drags and detached picker scroll events', async () => {
    const movable = document.createElement('weapp-movable-view')
    movable.setAttribute('direction', 'all')
    movable.setAttribute('out-of-bounds', 'true')
    document.body.append(movable)
    const changed = vi.fn()
    movable.addEventListener('change', changed)
    pointer(movable, 'pointerdown', { button: 1 })
    pointer(movable, 'pointermove', { clientX: 40 })
    expect(changed).not.toHaveBeenCalled()

    const column = document.createElement('weapp-picker-view-column')
    document.body.append(column)
    const scroller = column.shadowRoot!.querySelector('.scroller')!
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    column.remove()
    const selection = vi.fn()
    column.addEventListener('change', selection)
    scroller.dispatchEvent(new Event('scroll'))
    pointer(scroller, 'pointerup')
    expect(selection).not.toHaveBeenCalled()
  })
})

describe('shared mouse touch coordinator boundaries', () => {
  it('reference-counts repeated interests and makes each release idempotent', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const first = registerRuntimeTouchTarget(element)
    const second = registerRuntimeTouchTarget(element)
    disposers.push(first, second)
    const names: string[] = []
    for (const name of ['touchstart', 'touchend', 'touchcancel']) {
      element.addEventListener(name, () => names.push(name))
    }
    first()
    first()
    pointer(element, 'pointerdown')
    pointer(window, 'pointerup')
    expect(names).toEqual(['touchstart', 'touchend'])
    second()
    pointer(element, 'pointerdown')
    expect(names).toEqual(['touchstart', 'touchend'])
  })

  it('ignores unregistered origins and cancels a matching session when the mouse button was released', () => {
    const element = document.createElement('div')
    document.body.append(element)
    disposers.push(registerRuntimeTouchTarget(element))
    const cancel = vi.fn()
    element.addEventListener('touchcancel', cancel)
    pointer(document, 'pointerdown')
    pointer(document.body, 'pointerdown')
    pointer(element, 'pointerdown')
    pointer(window, 'pointermove', { pointerId: 2 })
    pointer(window, 'pointermove', { buttons: 0 })
    expect(cancel).toHaveBeenCalledOnce()
    pointer(window, 'pointermove', { buttons: 0 })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('forwards pointer cancellation and releases sessions removed during start or move', () => {
    const element = document.createElement('div')
    document.body.append(element)
    disposers.push(registerRuntimeTouchTarget(element))
    const cancel = vi.fn()
    element.addEventListener('touchcancel', cancel)
    pointer(element, 'pointerdown')
    pointer(window, 'pointercancel', { pointerId: 2 })
    pointer(window, 'pointercancel')
    expect(cancel).toHaveBeenCalledOnce()
    element.addEventListener('touchstart', () => element.remove(), { once: true })
    pointer(element, 'pointerdown')
    pointer(window, 'pointerup')
    document.body.append(element)
    element.addEventListener('touchmove', () => element.remove(), { once: true })
    pointer(element, 'pointerdown')
    pointer(window, 'pointermove')
    pointer(window, 'pointerup')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('drops a detached origin before movement and returns a harmless release without a window', () => {
    const element = document.createElement('div')
    document.body.append(element)
    disposers.push(registerRuntimeTouchTarget(element))
    const moved = vi.fn()
    element.addEventListener('touchmove', moved)
    pointer(element, 'pointerdown')
    element.remove()
    pointer(window, 'pointermove')
    expect(moved).not.toHaveBeenCalled()
    const detached = document.implementation.createHTMLDocument().createElement('div')
    const release = registerRuntimeTouchTarget(detached)
    expect(() => release()).not.toThrow()
  })

  it('uses the canvas host when no inner surface exists and preserves touch points without force', () => {
    const canvas = document.createElement('weapp-canvas')
    expect(resolveTouchCanvas([canvas])).toMatchObject({ canvas, surface: canvas, legacyCanvas: true })
    canvas.attachShadow({ mode: 'open' })
    expect(resolveTouchCanvas([canvas])).toMatchObject({ canvas, surface: canvas })
    const point = { identifier: 1, pageX: 10, pageY: 20, clientX: 10, clientY: 20 }
    const event = new Event('touchmove')
    Object.defineProperties(event, { touches: { value: [point] }, changedTouches: { value: [point] } })
    const payload = createRuntimeEventPayload('touchmove', event, document.createElement('div'))
    expect(payload).toMatchObject({ touches: [point], changedTouches: [point] })
    expect('force' in (payload as { touches: Array<Record<string, unknown>> }).touches[0]!).toBe(false)
  })
})
