// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { setFormConfig } from '../src/runtime/nativeComponents/form'

function appendElement<T extends HTMLElement>(tagName: string, attributes: Record<string, string> = {}) {
  const element = document.createElement(tagName) as T
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  document.body.append(element)
  return element
}

describe('native custom elements', () => {
  beforeAll(() => {
    ensureNativeComponentsDefined()
  })

  afterEach(() => {
    document.body.replaceChildren()
    setFormConfig({ preventDefault: true })
  })

  it('synchronizes input attributes, methods and mini-program events', async () => {
    const element = appendElement<any>('weapp-input', {
      'confirm-type': 'send',
      'maxlength': '12',
      'name': 'title',
      'password': '',
      'placeholder': 'Title',
      'value': 'initial',
    })
    const input = element.shadowRoot!.querySelector('input')!
    const events: CustomEvent[] = []
    for (const name of ['input', 'focus', 'blur', 'confirm']) {
      element.addEventListener(name, (event: Event) => events.push(event as CustomEvent))
    }

    expect(element.formControlName).toBe('title')
    expect(element.formControlDisabled).toBe(false)
    expect(input.type).toBe('password')
    expect(input.placeholder).toBe('Title')
    expect(input.maxLength).toBe(12)
    expect(input.enterKeyHint).toBe('send')

    input.value = 'changed'
    input.setSelectionRange(3, 3)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('focus'))
    input.dispatchEvent(new Event('blur'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(events.map(event => event.type)).toEqual(['input', 'focus', 'blur', 'confirm'])
    expect(events[0]?.detail).toEqual({ cursor: 3, value: 'changed' })

    element.value = 'next'
    expect(input.value).toBe('next')
    element.value = null
    expect(input.value).toBe('')
    element.setAttribute('maxlength', '-1')
    expect(input.hasAttribute('maxlength')).toBe(false)
    element.setAttribute('type', 'number')
    element.removeAttribute('password')
    expect(input.type).toBe('text')
    element.setAttribute('focus', '')
    await Promise.resolve()
    expect(document.activeElement).toBe(element)
    element.blur()

    input.value = 'temporary'
    element.formReset()
    expect(input.value).toBe('initial')
    element.formActivate()
    element.remove()
  })

  it('synchronizes textarea metrics, focus and reset behavior', async () => {
    const element = appendElement<any>('weapp-textarea', {
      'auto-height': '',
      'confirm-type': 'done',
      'maxlength': '20',
      'name': 'bio',
      'placeholder': 'Bio',
      'value': 'first',
    })
    const textarea = element.shadowRoot!.querySelector('textarea')!
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 48 })
    const events: CustomEvent[] = []
    for (const name of ['input', 'linechange', 'focus', 'blur', 'confirm']) {
      element.addEventListener(name, (event: Event) => events.push(event as CustomEvent))
    }

    textarea.value = 'first\nsecond'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('focus'))
    textarea.dispatchEvent(new Event('blur'))
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }))
    expect(events.map(event => event.type)).toEqual(['input', 'linechange', 'focus', 'blur', 'confirm'])
    expect(element.style.height).toBe('48px')

    element.value = 'updated'
    expect(textarea.value).toBe('updated')
    element.value = null
    expect(textarea.value).toBe('')
    element.setAttribute('maxlength', '-1')
    expect(textarea.hasAttribute('maxlength')).toBe(false)
    element.setAttribute('auto-focus', '')
    await Promise.resolve()
    expect(document.activeElement).toBe(element)
    element.blur()
    textarea.value = 'temporary'
    element.formReset()
    expect(textarea.value).toBe('first')
    element.formActivate()
    element.remove()
  })

  it('coordinates checkbox and radio groups with form control state', () => {
    const checkboxGroup = appendElement<any>('weapp-checkbox-group', { name: 'features' })
    const checkboxA = document.createElement('weapp-checkbox') as any
    checkboxA.setAttribute('checked', '')
    checkboxA.setAttribute('value', 'web')
    const checkboxB = document.createElement('weapp-checkbox') as any
    checkboxB.setAttribute('value', 'native')
    checkboxGroup.append(checkboxA, checkboxB)
    expect(checkboxGroup.formControlName).toBe('features')
    expect(checkboxGroup.formControlDisabled).toBe(false)
    expect(checkboxGroup.formControlValue).toEqual(['web'])
    const checkboxChange = vi.fn()
    checkboxGroup.addEventListener('change', checkboxChange)
    checkboxB.shadowRoot!.querySelector('input')!.click()
    expect(checkboxChange).toHaveBeenCalledTimes(1)
    checkboxGroup.formReset()
    checkboxA.formActivate()
    checkboxA.setAttribute('disabled', '')
    checkboxA.formActivate()
    checkboxGroup.remove()

    const radioGroup = appendElement<any>('weapp-radio-group', { name: 'runtime' })
    const radioA = document.createElement('weapp-radio') as any
    radioA.setAttribute('checked', '')
    radioA.setAttribute('value', 'web')
    const radioB = document.createElement('weapp-radio') as any
    radioB.setAttribute('checked', '')
    radioB.setAttribute('value', 'native')
    radioGroup.append(radioA, radioB)
    radioGroup.connectedCallback()
    expect(radioGroup.formControlValue).toBe('web')
    expect(radioB.checked).toBe(false)
    const radioChange = vi.fn()
    radioGroup.addEventListener('change', radioChange)
    radioB.shadowRoot!.querySelector('input')!.click()
    expect(radioA.checked).toBe(false)
    expect(radioChange).toHaveBeenCalledTimes(1)
    radioGroup.formReset()
    radioB.setAttribute('disabled', '')
    radioB.formActivate()
    radioGroup.remove()
  })

  it('covers radio detached, standalone, empty-group, and host capability boundaries', () => {
    const detached = document.createElement('weapp-radio') as any
    expect(detached.value).toBe('')
    expect(detached.checked).toBe(false)
    detached.value = null
    detached.checked = true
    detached.setCheckedFromGroup(false)
    detached.formActivate()

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const group = appendElement<any>('weapp-radio-group')
    const unchecked = document.createElement('weapp-radio') as any
    const standalone = appendElement<any>('weapp-radio')
    group.append(unchecked)
    expect(group.formControlName).toBe('')
    expect(group.formControlValue).toBe('')
    expect(group.formControlDisabled).toBe(false)
    expect(standalone.style.getPropertyValue('--weapp-control-color')).toBe('#07c160')

    standalone.connectedCallback()
    standalone.setAttribute('color', '#123456')
    standalone.shadowRoot!.querySelector('input')!.click()
    standalone.formActivate()
    expect(standalone.style.getPropertyValue('--weapp-control-color')).toBe('#123456')
    group.formReset()
    group.remove()
    standalone.remove()
  })

  it('covers textarea detached state, metric guards, and host capability boundaries', async () => {
    const detached = document.createElement('weapp-textarea') as any
    expect(detached.value).toBe('')
    expect(detached.formControlName).toBe('')
    expect(detached.formControlValue).toBe('')
    expect(detached.formControlDisabled).toBe(false)
    detached.focus()
    detached.blur()
    detached.formReset()
    detached.setAttribute('placeholder', 'before-connect')
    detached.setAttribute('focus', '')
    await Promise.resolve()

    const runtimeDocument = document
    vi.stubGlobal('document', undefined)
    detached.connectedCallback()
    detached.disconnectedCallback()
    vi.stubGlobal('document', runtimeDocument)

    const element = appendElement<any>('weapp-textarea')
    element.connectedCallback()
    const textarea = element.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    element.setAttribute('confirm-type', 'send')
    expect(textarea.enterKeyHint).toBe('send')
    element.removeAttribute('confirm-type')

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 12 })
    element.setAttribute('placeholder', 'updated')
    expect(element.style.height).toBe('')
    textarea.value = 'one\ntwo'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    const zeroHeight = appendElement<any>('weapp-textarea', { 'auto-height': '' })
    const zeroTextarea = zeroHeight.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement
    zeroTextarea.value = 'one\ntwo'
    zeroTextarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(zeroHeight.style.height).toBe('')
  })

  it('submits and resets forms and activates controls through labels', () => {
    const form = appendElement<any>('weapp-form')
    const input = document.createElement('weapp-input') as any
    input.id = 'profile-name'
    input.setAttribute('name', 'name')
    input.setAttribute('value', 'Ada')
    form.append(input)
    const submit = vi.fn()
    form.addEventListener('submit', submit)
    form.requestSubmit()
    expect(submit.mock.calls[0]?.[0].detail).toEqual({ value: { name: 'Ada' } })

    setFormConfig({ preventDefault: false })
    const nativeForm = form.shadowRoot!.querySelector('form')!
    const nativeSubmit = vi.spyOn(nativeForm, 'submit').mockImplementation(() => {})
    form.requestSubmit()
    expect(nativeSubmit).toHaveBeenCalledTimes(1)

    const reset = vi.fn()
    form.addEventListener('reset', reset)
    form.reset()
    expect(reset).toHaveBeenCalledTimes(1)

    const label = appendElement<any>('weapp-label', { for: 'profile-name' })
    const activate = vi.spyOn(input, 'formActivate')
    label.click()
    expect(activate).toHaveBeenCalledTimes(1)
    label.connectedCallback()

    const nestedLabel = appendElement<any>('weapp-label')
    nestedLabel.append(input)
    nestedLabel.click()
    expect(activate).toHaveBeenCalledTimes(2)
  })

  it('synchronizes switch, image and scroll-view browser state', () => {
    const switchElement = appendElement<any>('weapp-switch', {
      checked: '',
      color: '#123456',
      name: 'enabled',
    })
    const switchInput = switchElement.shadowRoot!.querySelector('input')!
    expect(switchElement.checked).toBe(true)
    expect(switchElement.formControlValue).toBe(true)
    expect(switchElement.formControlDisabled).toBe(false)
    expect(switchElement.style.getPropertyValue('--weapp-control-color')).toBe('#123456')
    const change = vi.fn()
    switchElement.addEventListener('change', change)
    switchInput.click()
    expect(change).toHaveBeenCalledTimes(1)
    switchElement.formReset()
    switchElement.formActivate()
    switchElement.setAttribute('disabled', '')
    switchElement.formActivate()
    switchElement.checked = false
    switchElement.remove()

    const image = appendElement<any>('weapp-image', {
      'alt': 'cover',
      'lazy-load': '',
      'mode': 'widthFix',
      'src': '/cover.png',
    })
    const nativeImage = image.shadowRoot!.querySelector('img')!
    expect(nativeImage.loading).toBe('lazy')
    expect(nativeImage.style.height).toBe('auto')
    const load = vi.fn()
    const error = vi.fn()
    image.addEventListener('load', load)
    image.addEventListener('error', error)
    nativeImage.dispatchEvent(new Event('load'))
    nativeImage.dispatchEvent(new Event('error'))
    expect(load).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
    image.setAttribute('mode', 'heightFix')
    expect(nativeImage.style.width).toBe('auto')
    image.setAttribute('mode', 'aspectFit')
    expect(nativeImage.style.objectFit).toBe('contain')
    image.removeAttribute('lazy-load')
    expect(nativeImage.loading).toBe('eager')

    const scroll = appendElement<any>('weapp-scroll-view', {
      'scroll-left': '4',
      'scroll-top': '8',
      'scroll-x': '',
      'scroll-y': '',
    })
    const viewport = scroll.shadowRoot!.querySelector('.viewport') as HTMLDivElement
    expect(scroll.scrollLeft).toBe(4)
    expect(scroll.scrollTop).toBe(8)
    scroll.scrollLeft = 12
    scroll.scrollTop = 16
    const scrollEvent = vi.fn()
    scroll.addEventListener('scroll', scrollEvent)
    viewport.dispatchEvent(new Event('scroll'))
    expect(scrollEvent).toHaveBeenCalledTimes(1)
    scroll.removeAttribute('scroll-x')
    scroll.removeAttribute('scroll-y')
    expect(viewport.style.overflowX).toBe('hidden')
    expect(viewport.style.overflowY).toBe('hidden')
  })
})
