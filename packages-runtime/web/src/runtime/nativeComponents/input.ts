import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl } from './formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot, resolveMaxLength } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function resolveInputType(element: Element) {
  if (readBooleanAttribute(element, 'password')) {
    return 'password'
  }
  const type = element.getAttribute('type')
  return type === 'number' || type === 'digit' || type === 'idcard' ? 'text' : (type ?? 'text')
}

export function createInputEventDetail(input: Pick<HTMLInputElement, 'selectionStart' | 'value'>) {
  return {
    value: input.value,
    cursor: input.selectionStart ?? input.value.length,
  }
}

export class WeappInput extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('input')!.attributes]

  #input?: HTMLInputElement
  #initialValue = ''
  #initialValueCaptured = false

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return this.value
  }

  get formControlDisabled() {
    return readBooleanAttribute(this, 'disabled')
  }

  get value() {
    return this.#input?.value ?? this.getAttribute('value') ?? ''
  }

  set value(value: string) {
    this.setAttribute('value', value ?? '')
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    if (!this.#initialValueCaptured) {
      this.#initialValue = this.getAttribute('value') ?? ''
      this.#initialValueCaptured = true
    }
    this.#ensureStructure()
    this.#syncAttributes()
    connectFormControl(this)
    this.#syncFocus()
  }

  disconnectedCallback() {
    disconnectFormControl(this)
  }

  attributeChangedCallback(name: string) {
    this.#syncAttributes()
    if (name === 'focus') {
      this.#syncFocus()
    }
  }

  focus(options?: FocusOptions) {
    this.#input?.focus(options)
  }

  blur() {
    this.#input?.blur()
  }

  formReset() {
    if (this.#input) {
      this.#input.value = this.#initialValue
    }
  }

  formActivate() {
    this.focus()
  }

  #ensureStructure() {
    if (this.#input || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { cursor: text; }
      input {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        color: inherit;
        background: transparent;
        font: inherit;
        line-height: inherit;
      }
    `
    const input = document.createElement('input')
    input.addEventListener('input', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'input', createInputEventDetail(input))
    })
    input.addEventListener('focus', () => {
      dispatchMiniProgramEvent(this, 'focus', { value: input.value, height: 0 })
    })
    input.addEventListener('blur', () => {
      dispatchMiniProgramEvent(this, 'blur', createInputEventDetail(input))
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        dispatchMiniProgramEvent(this, 'confirm', { value: input.value })
      }
    })
    root.append(style, input)
    this.#input = input
  }

  #syncAttributes() {
    if (!this.#input) {
      return
    }
    const value = this.getAttribute('value') ?? ''
    if (this.#input.value !== value) {
      this.#input.value = value
    }
    this.#input.type = resolveInputType(this)
    this.#input.placeholder = this.getAttribute('placeholder') ?? ''
    this.#input.disabled = readBooleanAttribute(this, 'disabled')
    const maxlength = resolveMaxLength(this.getAttribute('maxlength'))
    if (maxlength === undefined) {
      this.#input.removeAttribute('maxlength')
    }
    else {
      this.#input.maxLength = maxlength
    }
    const confirmType = this.getAttribute('confirm-type')
    if (confirmType) {
      this.#input.enterKeyHint = confirmType === 'send' ? 'send' : confirmType as HTMLInputElement['enterKeyHint']
    }
  }

  #syncFocus() {
    if (!readBooleanAttribute(this, 'focus')) {
      return
    }
    queueMicrotask(() => this.focus())
  }
}
