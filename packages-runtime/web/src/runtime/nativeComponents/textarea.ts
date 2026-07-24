import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl } from './formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot, resolveMaxLength } from './helpers'
import { createInputEventDetail } from './input'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export function createTextareaLineChangeDetail(textarea: Pick<HTMLTextAreaElement, 'scrollHeight' | 'value'>) {
  const height = textarea.scrollHeight
  return {
    height,
    heightRpx: height * 2,
    lineCount: textarea.value.split('\n').length,
  }
}

export class WeappTextarea extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('textarea')!.attributes]

  #textarea?: HTMLTextAreaElement
  #initialValue = ''
  #initialValueCaptured = false
  #lastLineCount = 1
  #lastHeight = 0

  get value() {
    return this.#textarea?.value ?? this.getAttribute('value') ?? ''
  }

  set value(value: string) {
    this.setAttribute('value', value ?? '')
  }

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return this.value
  }

  get formControlDisabled() {
    return readBooleanAttribute(this, 'disabled')
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
    if (name === 'focus' || name === 'auto-focus') {
      this.#syncFocus()
    }
  }

  focus(options?: FocusOptions) {
    this.#textarea?.focus(options)
  }

  blur() {
    this.#textarea?.blur()
  }

  formReset() {
    if (!this.#textarea) {
      return
    }
    this.#textarea.value = this.#initialValue
    this.#updateLineMetrics(false)
  }

  formActivate() {
    this.focus()
  }

  #ensureStructure() {
    if (this.#textarea || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { cursor: text; }
      textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 100%;
        min-height: inherit;
        padding: 0;
        border: 0;
        outline: 0;
        resize: none;
        color: inherit;
        background: transparent;
        font: inherit;
        line-height: inherit;
      }
    `
    const textarea = document.createElement('textarea')
    textarea.addEventListener('input', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'input', createInputEventDetail(textarea))
      this.#updateLineMetrics(true)
    })
    textarea.addEventListener('focus', () => {
      dispatchMiniProgramEvent(this, 'focus', { value: textarea.value, height: textarea.scrollHeight })
    })
    textarea.addEventListener('blur', () => {
      dispatchMiniProgramEvent(this, 'blur', createInputEventDetail(textarea))
    })
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        dispatchMiniProgramEvent(this, 'confirm', { value: textarea.value })
      }
    })
    root.append(style, textarea)
    this.#textarea = textarea
  }

  #syncAttributes() {
    if (!this.#textarea) {
      return
    }
    const value = this.getAttribute('value') ?? ''
    if (this.#textarea.value !== value) {
      this.#textarea.value = value
    }
    this.#textarea.placeholder = this.getAttribute('placeholder') ?? ''
    this.#textarea.disabled = readBooleanAttribute(this, 'disabled')
    const maxlength = resolveMaxLength(this.getAttribute('maxlength'))
    if (maxlength === undefined) {
      this.#textarea.removeAttribute('maxlength')
    }
    else {
      this.#textarea.maxLength = maxlength
    }
    const confirmType = this.getAttribute('confirm-type')
    if (confirmType) {
      this.#textarea.enterKeyHint = confirmType === 'send' ? 'send' : confirmType as HTMLTextAreaElement['enterKeyHint']
    }
    this.#updateLineMetrics(false)
  }

  #syncFocus() {
    if (!readBooleanAttribute(this, 'focus') && !readBooleanAttribute(this, 'auto-focus')) {
      return
    }
    queueMicrotask(() => this.focus())
  }

  #updateLineMetrics(emit: boolean) {
    if (!this.#textarea) {
      return
    }
    const detail = createTextareaLineChangeDetail(this.#textarea)
    if (detail.lineCount === this.#lastLineCount && detail.height === this.#lastHeight) {
      return
    }
    this.#lastLineCount = detail.lineCount
    this.#lastHeight = detail.height
    if (readBooleanAttribute(this, 'auto-height') && detail.height > 0) {
      this.style.height = `${detail.height}px`
    }
    if (emit) {
      dispatchMiniProgramEvent(this, 'linechange', detail)
    }
  }
}
