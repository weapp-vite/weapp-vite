// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

describe('native form component boundaries', () => {
  beforeAll(() => {
    ensureNativeComponentsDefined()
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('supports detached and repeatedly connected checkboxes', () => {
    const checkbox = document.createElement('weapp-checkbox') as any
    expect(checkbox.value).toBe('')
    expect(checkbox.checked).toBe(false)
    checkbox.value = null
    checkbox.checked = true
    expect(checkbox.getAttribute('value')).toBe('')
    expect(checkbox.hasAttribute('checked')).toBe(true)

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    checkbox.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    document.body.append(checkbox)
    checkbox.connectedCallback()
    checkbox.shadowRoot!.querySelector('input')!.click()
    checkbox.formReset()
    checkbox.setCheckedFromGroup(true)
    expect(checkbox.checked).toBe(true)

    const group = document.createElement('weapp-checkbox-group') as any
    expect(group.formControlName).toBe('')
  })

  it('ignores prevented and nested-control label clicks and missing roots', () => {
    const label = document.createElement('weapp-label') as any
    document.body.append(label)
    label.connectedCallback()

    const prevented = new Event('click', { bubbles: true, cancelable: true })
    prevented.preventDefault()
    label.dispatchEvent(prevented)

    const input = document.createElement('weapp-input') as any
    const activate = vi.spyOn(input, 'formActivate')
    label.append(input)
    input.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(activate).not.toHaveBeenCalled()

    const missing = document.createElement('weapp-label') as any
    missing.setAttribute('for', 'unknown')
    Object.defineProperty(missing, 'getRootNode', { value: () => ({}) })
    missing.connectedCallback()
    missing.dispatchEvent(new Event('click'))
    expect(missing.isConnected).toBe(false)
  })

  it('initializes switches, forms, and navigators across detached host states', () => {
    const switchElement = document.createElement('weapp-switch') as any
    expect(switchElement.formControlName).toBe('')
    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    switchElement.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)
    document.body.append(switchElement)
    switchElement.connectedCallback()

    const form = document.createElement('weapp-form') as any
    vi.stubGlobal('document', undefined)
    form.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)
    document.body.append(form)
    form.connectedCallback()
    const submit = new Event('submit', { cancelable: true })
    form.shadowRoot!.querySelector('form')!.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(true)

    const detachedNavigator = document.createElement('weapp-navigator') as any
    vi.stubGlobal('document', undefined)
    detachedNavigator.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)
    document.body.append(detachedNavigator)
    detachedNavigator.connectedCallback()

    vi.useFakeTimers()
    detachedNavigator.setAttribute('hover-start-time', '100')
    detachedNavigator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    detachedNavigator.remove()
    vi.runAllTimers()
    expect(detachedNavigator.classList.contains('navigator-hover')).toBe(false)
    vi.useRealTimers()
  })

  it('skips structure creation for native elements without a document', () => {
    const elements = [
      document.createElement('weapp-image'),
      document.createElement('weapp-scroll-view'),
      document.createElement('weapp-canvas'),
      document.createElement('weapp-icon'),
      document.createElement('weapp-rich-text'),
    ] as any[]
    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    for (const element of elements) {
      element.connectedCallback()
    }
    vi.stubGlobal('document', runtimeDocument)
    for (const element of elements) {
      expect(element.shadowRoot).toBeNull()
    }

    vi.stubGlobal('customElements', undefined)
    expect(() => ensureNativeComponentsDefined()).not.toThrow()
  })

  it('omits unnamed controls from submitted form values', () => {
    const form = document.createElement('weapp-form') as any
    const input = document.createElement('weapp-input') as any
    input.setAttribute('value', 'ignored')
    form.append(input)
    document.body.append(form)
    const submit = vi.fn()
    form.addEventListener('submit', submit)
    form.requestSubmit()
    expect(submit.mock.calls[0]![0].detail).toEqual({ value: {} })
  })

  it('covers detached scroll, input, image, and canvas defaults', () => {
    const scroll = document.createElement('weapp-scroll-view') as any
    expect(scroll.scrollTop).toBe(0)
    expect(scroll.scrollLeft).toBe(0)
    scroll.scrollTop = 10
    scroll.scrollLeft = 20
    document.body.append(scroll)
    scroll.setAttribute('scroll-top', 'invalid')
    scroll.setAttribute('scroll-left', 'invalid')

    const input = document.createElement('weapp-input') as any
    expect(input.value).toBe('')
    input.setAttribute('type', 'email')
    input.setAttribute('confirm-type', 'done')
    document.body.append(input)
    expect(input.shadowRoot!.querySelector('input')!.enterKeyHint).toBe('done')

    const image = document.createElement('weapp-image') as any
    document.body.append(image)
    expect(image.shadowRoot!.querySelector('img')!.src).toBe('')
    image.setAttribute('mode', 'unknown')

    const canvas = document.createElement('weapp-canvas') as any
    canvas.disconnectedCallback()
    document.body.append(canvas)
    expect(canvas.shadowRoot!.querySelector('canvas')!.style.touchAction).toBe('')
  })
})
