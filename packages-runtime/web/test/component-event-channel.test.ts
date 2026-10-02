// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenRuntimeEvent, markComponentEvent, nameRuntimeEventHandler, registerComponentEventTarget } from '../src/runtime/componentEvents'

afterEach(() => document.body.replaceChildren())

describe('component event channels', () => {
  it('preserves custom-event detail, capture and composed bubbling without exposing the native duplicate', () => {
    const parent = document.createElement('div')
    const child = document.createElement('div')
    const button = document.createElement('button')
    child.attachShadow({ mode: 'open' }).append(button)
    parent.append(child)
    document.body.append(parent)
    registerComponentEventTarget(child)
    const calls: string[] = []
    const detail = { marker: 'custom' }
    const handler = vi.fn((event: Event) => {
      calls.push('component')
      expect((event as CustomEvent).detail).toBe(detail)
    })
    const stop = listenRuntimeEvent(child, 'click', handler)
    parent.addEventListener('click', event => calls.push(event instanceof CustomEvent ? 'custom-capture' : 'native-capture'), true)
    parent.addEventListener('click', event => calls.push(event instanceof CustomEvent ? 'custom-bubble' : 'native-bubble'))
    button.addEventListener('click', () => child.dispatchEvent(markComponentEvent(new CustomEvent('click', { detail, bubbles: true, composed: true }))))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(handler).toHaveBeenCalledOnce()
    expect(calls).toEqual(['native-capture', 'custom-capture', 'component', 'custom-bubble', 'native-bubble'])
    stop()
    stop()
    child.dispatchEvent(markComponentEvent(new CustomEvent('click', { detail })))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('keeps native tap aliases distinct from custom click and exact custom tap names', () => {
    const child = document.createElement('div')
    registerComponentEventTarget(child)
    const tap = vi.fn()
    const click = vi.fn()
    listenRuntimeEvent(child, 'click', nameRuntimeEventHandler(tap, 'tap'), true)
    listenRuntimeEvent(child, 'click', nameRuntimeEventHandler(click, 'click'))
    child.dispatchEvent(new MouseEvent('click'))
    expect(tap).toHaveBeenCalledOnce()
    expect(click).not.toHaveBeenCalled()
    child.dispatchEvent(markComponentEvent(new CustomEvent('click')))
    expect(tap).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    child.dispatchEvent(markComponentEvent(new CustomEvent('tap')))
    expect(tap).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenCalledOnce()
  })
})
