// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { html, nothing } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { listenRuntimeEvent } from '../src/runtime/componentEvents'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'
import { WeappMovableView } from '../src/runtime/nativeComponents/movable'
import { WeappPickerViewColumn } from '../src/runtime/nativeComponents/pickerView/column'
import { PICKER_VIEW_PICK_START_EVENT } from '../src/runtime/nativeComponents/pickerView/helpers'
import { WeappSwiper } from '../src/runtime/nativeComponents/swiper'
import { createTemplate } from '../src/runtime/template'

let sequence = 0
const disposers: Array<() => void> = []

afterEach(() => {
  document.body.replaceChildren()
  for (const dispose of disposers.splice(0)) {
    dispose()
  }
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function pointer(target: EventTarget, name: string, init: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(name, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: name === 'pointerup' ? 0 : 1,
    clientX: 20,
    clientY: 30,
    ...init,
  }))
}

describe.each(['compiled', 'legacy'] as const)('%s touch owner lifecycle', (mode) => {
  it('releases document interests on disconnect and reconnects a retained template once', async () => {
    const calls: string[] = []
    const tag = `touch-lifecycle-${++sequence}`
    defineComponent(tag, {
      template: mode === 'legacy'
        ? createTemplate('<view id="drag" bindtouchstart="start" bindtouchend="end" />')
        : (_scope, context) => html`<div id="drag" ${bindRuntimeEvent('touchstart', context.event('touchstart', 'start', {}))} ${bindRuntimeEvent('touchend', context.event('touchend', 'end', {}))}></div>`,
      component: {
        methods: {
          start() { calls.push('start') },
          end() { calls.push('end') },
        },
      },
    })
    const owner = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
    document.body.append(owner)
    await owner.updateComplete
    const original = owner.shadowRoot!.querySelector('#drag')!
    const remove = vi.spyOn(document, 'removeEventListener')
    pointer(original, 'pointerdown')
    owner.remove()
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['start'])
    expect(remove.mock.calls.filter(([name]) => name === 'pointerdown')).toHaveLength(1)
    document.body.append(owner)
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('#drag')).toBe(original)
    pointer(original, 'pointerdown')
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['start', 'start', 'end'])
  })

  it('terminates a drag when setData removes its origin and starts cleanly on a later render', async () => {
    const calls: string[] = []
    const tag = `touch-lifecycle-${++sequence}`
    defineComponent(tag, {
      template: mode === 'legacy'
        ? createTemplate('<view wx:if="{{visible}}" id="drag" bindtouchstart="start" bindtouchmove="move" bindtouchend="end" />')
        : (scope, context) => scope.visible
            ? html`<div id="drag" ${bindRuntimeEvent('touchstart', context.event('touchstart', 'start', {}))} ${bindRuntimeEvent('touchmove', context.event('touchmove', 'move', {}))} ${bindRuntimeEvent('touchend', context.event('touchend', 'end', {}))}></div>`
            : nothing,
      component: {
        data: { visible: true },
        methods: {
          start() { calls.push('start') },
          move() {
            calls.push('move')
            this.setData({ visible: false })
          },
          end() { calls.push('end') },
        },
      },
    })
    const owner = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
    document.body.append(owner)
    await owner.updateComplete
    const original = owner.shadowRoot!.querySelector('#drag')!
    pointer(original, 'pointerdown')
    pointer(document.body, 'pointermove')
    await owner.updateComplete
    expect(owner.shadowRoot!.querySelector('#drag')).toBeNull()
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['start', 'move'])
    owner.setData({ visible: true })
    await owner.updateComplete
    pointer(owner.shadowRoot!.querySelector('#drag')!, 'pointerdown')
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['start', 'move', 'start', 'end'])
  })
})

it.each(['blur', 'buttons'] as const)('cancels a movable drag on %s and ignores later movement without a pressed button', (cause) => {
  if (!customElements.get('weapp-movable-view')) {
    customElements.define('weapp-movable-view', WeappMovableView)
  }
  const owner = document.createElement('weapp-movable-view')
  owner.setAttribute('direction', 'all')
  owner.setAttribute('out-of-bounds', 'true')
  document.body.append(owner)
  const changed = vi.fn()
  owner.addEventListener('change', changed)
  pointer(owner, 'pointerdown')
  pointer(owner, 'pointermove', { clientX: 40 })
  const transform = owner.style.transform
  if (cause === 'blur') {
    window.dispatchEvent(new Event('blur'))
  }
  pointer(owner, 'pointermove', { buttons: 0, clientX: 100 })
  pointer(owner, 'pointerup', { clientX: 100 })
  expect(owner.style.transform).toBe(transform)
  expect(changed).toHaveBeenCalledOnce()
  pointer(owner, 'pointerdown')
  pointer(owner, 'pointermove', { clientX: 50 })
  expect(owner.style.transform).not.toBe(transform)
})

it.each([
  ['weapp-movable-view', WeappMovableView, 'change'],
  ['weapp-swiper', WeappSwiper, 'transition'],
] as const)('keeps %s dragging when browser focus moves away from another button', (tag, Constructor, eventName) => {
  if (!customElements.get(tag)) {
    customElements.define(tag, Constructor)
  }
  const previous = document.createElement('button')
  const owner = document.createElement(tag)
  owner.setAttribute('direction', 'all')
  owner.setAttribute('out-of-bounds', 'true')
  if (tag === 'weapp-swiper') {
    owner.append(document.createElement('weapp-swiper-item'), document.createElement('weapp-swiper-item'))
  }
  document.body.append(previous, owner)
  const source = (owner.shadowRoot?.querySelector('.viewport') ?? owner) as HTMLElement
  source.tabIndex = 0
  const moved = vi.fn()
  const blurred = vi.fn()
  owner.addEventListener(eventName, moved)
  previous.addEventListener('blur', blurred)
  previous.focus()
  pointer(source, 'pointerdown')
  source.focus()
  expect(blurred).toHaveBeenCalledOnce()
  pointer(source, 'pointermove', { clientX: -40 })
  expect(moved).toHaveBeenCalledOnce()
  pointer(source, 'pointerup')
})

it('cancels a swiper gesture on blur, resumes autoplay and ignores stale pointer motion', async () => {
  vi.useFakeTimers()
  if (!customElements.get('weapp-swiper')) {
    customElements.define('weapp-swiper', WeappSwiper)
  }
  const owner = document.createElement('weapp-swiper')
  owner.setAttribute('autoplay', 'true')
  owner.setAttribute('interval', '20')
  owner.setAttribute('duration', '0')
  owner.append(document.createElement('weapp-swiper-item'), document.createElement('weapp-swiper-item'))
  document.body.append(owner)
  const source = owner.shadowRoot!.querySelector('.viewport')!
  const changed = vi.fn()
  const transitioned = vi.fn()
  owner.addEventListener('change', changed)
  owner.addEventListener('transition', transitioned)
  pointer(source, 'pointerdown')
  pointer(source, 'pointermove', { clientX: -40 })
  await vi.advanceTimersByTimeAsync(25)
  expect(changed).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('blur'))
  pointer(source, 'pointermove', { clientX: -200, buttons: 0 })
  pointer(source, 'pointerup', { clientX: -200 })
  expect(transitioned).toHaveBeenCalledOnce()
  expect(changed).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(25)
  expect(changed).toHaveBeenCalledOnce()
  expect(changed.mock.calls[0]?.[0].detail.source).toBe('autoplay')
})

it.each([
  ['weapp-movable-view', WeappMovableView],
  ['weapp-swiper', WeappSwiper],
] as const)('does not restart a removed %s while the original pointerdown is still propagating', (tag, Constructor) => {
  if (!customElements.get(tag)) {
    customElements.define(tag, Constructor)
  }
  const owner = document.createElement(tag)
  if (tag === 'weapp-swiper') {
    owner.append(document.createElement('weapp-swiper-item'), document.createElement('weapp-swiper-item'))
  }
  document.body.append(owner)
  const source = owner.shadowRoot?.querySelector('.viewport') ?? owner
  const capture = vi.fn()
  Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: capture })
  disposers.push(listenRuntimeEvent(owner, 'touchstart', () => owner.remove()))
  pointer(source, 'pointerdown')
  expect(owner.isConnected).toBe(false)
  expect(capture).not.toHaveBeenCalled()
})

it('does not restart a removed picker column or retain its previous picking session on reconnect', async () => {
  if (!customElements.get('weapp-picker-view-column')) {
    customElements.define('weapp-picker-view-column', WeappPickerViewColumn)
  }
  const owner = document.createElement('weapp-picker-view-column')
  owner.append(document.createElement('div'))
  document.body.append(owner)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const started = vi.fn()
  owner.addEventListener(PICKER_VIEW_PICK_START_EVENT, started)
  const source = owner.shadowRoot!.querySelector('.scroller')!
  const dispose = listenRuntimeEvent(owner, 'touchstart', () => owner.remove())
  disposers.push(dispose)
  pointer(source, 'pointerdown')
  expect(owner.isConnected).toBe(false)
  expect(started).not.toHaveBeenCalled()
  dispose()
  document.body.append(owner)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  pointer(source, 'pointerdown')
  expect(started).toHaveBeenCalledOnce()
  owner.remove()
  document.body.append(owner)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  pointer(source, 'pointerdown')
  expect(started).toHaveBeenCalledTimes(2)
})
