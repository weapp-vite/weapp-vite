// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindRuntimeEvents, releaseRuntimeEvents } from '../src/runtime/component/events'
import { listenRuntimeEvent } from '../src/runtime/componentEvents'
import { createRenderContext } from '../src/runtime/renderContext'

interface TouchPayload {
  type: string
  touches: Array<{ identifier: number, clientX?: number, clientY?: number, pageX?: number, pageY?: number, x?: number, y?: number }>
  changedTouches: TouchPayload['touches']
  currentTarget?: unknown
  originalEvent: Event
}

type Mode = 'compiled' | 'legacy'
const names = ['touchstart', 'touchmove', 'touchend', 'touchcancel']
const disposers: Array<() => void> = []

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose()
  }
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function pointer(target: EventTarget, name: string, init: PointerEventInit = {}) {
  const event = new PointerEvent(name, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 3,
    isPrimary: true,
    button: 0,
    buttons: name === 'pointerup' ? 0 : 1,
    clientX: 25,
    clientY: 40,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function bind(mode: Mode, root: HTMLElement | ShadowRoot, target: HTMLElement, records: TouchPayload[], caught = false) {
  const methods = Object.fromEntries(names.map(name => [name, (event: TouchPayload) => records.push(event)]))
  const instance = {} as ComponentPublicInstance
  if (mode === 'compiled') {
    const context = createRenderContext(instance, methods)
    for (const name of names) {
      disposers.push(listenRuntimeEvent(target, name, context.event(name, name, {}, undefined, { catch: caught })))
    }
  }
  else {
    for (const name of names) {
      target.setAttribute(`data-mp-on-${name}`, name)
      target.setAttribute(`data-mp-on-flags-${name}`, caught ? 'catch' : '')
    }
    bindRuntimeEvents(root, methods, instance)
    disposers.push(() => releaseRuntimeEvents(root))
  }
  return { methods, instance }
}

describe.each<Mode>(['compiled', 'legacy'])('%s touch payloads', (mode) => {
  it('exposes active and changed coordinates while dragging outside a shadow root', () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    const target = document.createElement('div')
    root.append(target)
    document.body.append(host)
    const records: TouchPayload[] = []
    bind(mode, root, target, records)
    const down = pointer(target, 'pointerdown')
    pointer(document.body, 'pointermove', { clientX: 70, clientY: 90 })
    pointer(document.body, 'pointerup', { clientX: 80, clientY: 100 })
    expect(records.map(event => event.type)).toEqual(['touchstart', 'touchmove', 'touchend'])
    expect(records[0]?.originalEvent).toBe(down)
    expect(records[0]?.touches).toMatchObject([{ identifier: 3, pageX: down.pageX, pageY: down.pageY, clientX: 25, clientY: 40 }])
    expect(records[1]?.touches).toMatchObject([{ identifier: 3, clientX: 70, clientY: 90 }])
    expect(records[2]?.touches).toEqual([])
    expect(records[2]?.changedTouches).toMatchObject([{ identifier: 3, clientX: 80, clientY: 100 }])
  })

  it('preserves real touch coordinates and cancels native touchmove for catch bindings', () => {
    const root = document.createElement('div')
    const target = document.createElement('div')
    root.append(target)
    document.body.append(root)
    const records: TouchPayload[] = []
    bind(mode, root, target, records, true)
    const point = new Touch({ identifier: 15, target, clientX: 4, clientY: 5, pageX: 8, pageY: 9 })
    const event = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [point], changedTouches: [point] })
    const parent = vi.fn()
    root.addEventListener('touchmove', parent)
    target.dispatchEvent(event)
    expect(records[0]?.touches).toMatchObject([{ identifier: 15, clientX: 4, clientY: 5, pageX: 8, pageY: 9 }])
    expect(event.defaultPrevented).toBe(true)
    expect(parent).not.toHaveBeenCalled()
  })

  it('returns canvas x/y in CSS pixels and excludes ancestor touch bindings', () => {
    const root = document.createElement('div')
    const host = document.createElement('weapp-canvas')
    const canvas = document.createElement('canvas')
    host.attachShadow({ mode: 'open' }).append(canvas)
    root.append(host)
    document.body.append(root)
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 200, 100))
    const records: TouchPayload[] = []
    bind(mode, root, host, records)
    const ancestor = vi.fn()
    disposers.push(listenRuntimeEvent(root, 'touchstart', ancestor, true))
    pointer(canvas, 'pointerdown')
    expect(records[0]?.touches).toEqual([{ identifier: 3, x: 15, y: 20 }])
    expect(records[0]).not.toHaveProperty('currentTarget')
    expect(ancestor).not.toHaveBeenCalled()
    pointer(document.body, 'pointerup')
    const point = new Touch({ identifier: 9, target: canvas, clientX: 60, clientY: 70 })
    canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [point], changedTouches: [point] }))
    expect(records.at(-1)?.touches).toEqual([{ identifier: 9, x: 50, y: 50 }])
    expect(ancestor).not.toHaveBeenCalled()
  })

  it('keeps modern 2d canvas propagation and target metadata with standard and relative coordinates', () => {
    const root = document.createElement('div')
    const host = document.createElement('weapp-canvas')
    host.setAttribute('type', '2d')
    host.id = 'drawing'
    host.dataset.kind = 'drawing'
    const canvas = document.createElement('canvas')
    canvas.width = 600
    host.attachShadow({ mode: 'open' }).append(canvas)
    root.append(host)
    document.body.append(root)
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 200, 100))
    const records: TouchPayload[] = []
    bind(mode, root, host, records)
    const ancestor = vi.fn()
    disposers.push(listenRuntimeEvent(root, 'touchstart', ancestor))
    const down = pointer(canvas, 'pointerdown', { pressure: 0.5 })
    expect(records[0]?.touches).toMatchObject([{
      identifier: 3,
      clientX: 25,
      clientY: 40,
      pageX: down.pageX,
      pageY: down.pageY,
      force: 0.5,
      x: 15,
      y: 20,
    }])
    expect(records[0]?.currentTarget).toMatchObject({ id: 'drawing', offsetLeft: host.offsetLeft, offsetTop: host.offsetTop, dataset: { kind: 'drawing' } })
    expect(ancestor).toHaveBeenCalledOnce()
    pointer(document.body, 'pointerup')
    const point = new Touch({ identifier: 9, target: canvas, clientX: 60, clientY: 70, force: 0.7 })
    canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [point], changedTouches: [point] }))
    expect(records.at(-1)?.touches).toMatchObject([{ identifier: 9, clientX: 60, clientY: 70, force: 0.7, x: 50, y: 50 }])
    expect(ancestor).toHaveBeenCalledTimes(2)
  })
})

it('releases removed legacy nodes, whole roots and rebinds a retained root without duplicates', () => {
  const root = document.createElement('div')
  const target = document.createElement('div')
  root.append(target)
  document.body.append(root)
  const records: TouchPayload[] = []
  const { methods, instance } = bind('legacy', root, target, records)
  pointer(target, 'pointerdown')
  releaseRuntimeEvents(root)
  releaseRuntimeEvents(root)
  pointer(document.body, 'pointerup')
  expect(records).toHaveLength(1)
  bindRuntimeEvents(root, methods, instance)
  pointer(target, 'pointerdown')
  pointer(document.body, 'pointerup')
  expect(records.map(event => event.type)).toEqual(['touchstart', 'touchstart', 'touchend'])
  const remove = vi.spyOn(document, 'removeEventListener')
  target.remove()
  bindRuntimeEvents(root, methods, instance)
  expect(remove.mock.calls.filter(([name]) => name === 'pointerdown')).toHaveLength(1)
})
