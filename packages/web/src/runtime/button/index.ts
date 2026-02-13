import {
  collectFormValues,
  DEFAULT_HOVER_START,
  DEFAULT_HOVER_STAY,
  getHoverClass,
  isDisabled,
  isInternalNode,
  normalizeType,
  parseNumber,
  toBoolean,
} from './helpers'
import { ensureButtonStyle } from './style'

interface ButtonFormConfig {
  preventDefault?: boolean
}

const DEFAULT_FORM_CONFIG: Required<ButtonFormConfig> = {
  preventDefault: true,
}

const NAV_BUTTON_TAG = 'weapp-button'
const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

let formConfig: Required<ButtonFormConfig> = { ...DEFAULT_FORM_CONFIG }

class WeappButton extends BaseElement {
  static get observedAttributes() {
    return [
      'type',
      'plain',
      'size',
      'loading',
      'disabled',
      'hover-class',
      'hover-start-time',
      'hover-stay-time',
      'form-type',
      'open-type',
    ]
  }

  #button?: HTMLButtonElement
  #content?: HTMLSpanElement
  #text?: HTMLSpanElement
  #loading?: HTMLSpanElement
  #hoverTimer?: ReturnType<typeof globalThis.setTimeout>
  #hoverRemoveTimer?: ReturnType<typeof globalThis.setTimeout>
  #lastTouchTime = 0
  #observer?: MutationObserver

  connectedCallback() {
    const root = this.getRootNode()
    if (root instanceof ShadowRoot) {
      ensureButtonStyle(root)
    }
    else {
      ensureButtonStyle()
    }
    this.#ensureStructure()
    this.#applyState()
    this.#bindEvents()
  }

  disconnectedCallback() {
    this.#clearHoverTimers()
    this.#observer?.disconnect()
    this.#observer = undefined
  }

  attributeChangedCallback() {
    this.#applyState()
  }

  #ensureStructure() {
    if (this.#button) {
      return
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'weapp-btn'
    button.dataset.weappInternal = 'true'
    const content = document.createElement('span')
    content.className = 'weapp-btn__content'
    content.dataset.weappInternal = 'true'
    const loading = document.createElement('span')
    loading.className = 'weapp-btn__loading'
    loading.dataset.weappInternal = 'true'
    loading.setAttribute('hidden', '')
    const text = document.createElement('span')
    text.className = 'weapp-btn__text'
    text.dataset.weappInternal = 'true'
    content.append(loading, text)
    button.append(content)

    const existing = Array.from(this.childNodes).filter(node => !isInternalNode(node))
    for (const node of existing) {
      text.appendChild(node)
    }
    this.appendChild(button)

    this.#button = button
    this.#content = content
    this.#text = text
    this.#loading = loading

    if (typeof MutationObserver !== 'undefined') {
      this.#observer = new MutationObserver((records) => {
        if (!this.#text) {
          return
        }
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (isInternalNode(node)) {
              continue
            }
            if (node === this.#button) {
              continue
            }
            this.#text.appendChild(node)
          }
        }
      })
      this.#observer.observe(this, { childList: true })
    }
  }

  #applyState() {
    if (!this.#button || !this.#loading) {
      return
    }
    const type = normalizeType(this.getAttribute('type'))
    const plain = toBoolean(this.getAttribute('plain'))
    const size = (this.getAttribute('size') ?? 'default').toLowerCase()
    const loading = toBoolean(this.getAttribute('loading'))
    const disabled = toBoolean(this.getAttribute('disabled'))
    const openType = this.getAttribute('open-type')

    this.classList.toggle('weapp-btn--primary', type === 'primary')
    this.classList.toggle('weapp-btn--warn', type === 'warn')
    this.classList.toggle('weapp-btn--default', type === 'default')
    this.classList.toggle('weapp-btn--plain', plain)
    this.classList.toggle('weapp-btn--mini', size === 'mini')
    this.classList.toggle('weapp-btn--loading', loading)
    this.classList.toggle('weapp-btn--disabled', disabled)

    if (openType) {
      const openTypeClass = `weapp-btn--open-type-${openType}`
      for (const className of Array.from(this.classList)) {
        if (className.startsWith('weapp-btn--open-type-') && className !== openTypeClass) {
          this.classList.remove(className)
        }
      }
      this.classList.add(openTypeClass)
    }
    else {
      for (const className of Array.from(this.classList)) {
        if (className.startsWith('weapp-btn--open-type-')) {
          this.classList.remove(className)
        }
      }
    }

    const locked = disabled || loading
    this.#button.disabled = locked
    if (locked) {
      this.#button.setAttribute('aria-disabled', 'true')
    }
    else {
      this.#button.removeAttribute('aria-disabled')
    }
    this.#loading.toggleAttribute('hidden', !loading)
  }

  #bindEvents() {
    if ((this as any).__weappButtonBound) {
      return
    }
    ;(this as any).__weappButtonBound = true
    this.addEventListener('click', this.#handleClickCapture, true)
    this.addEventListener('click', this.#handleClick)
    this.addEventListener('touchstart', this.#handlePressStart, { passive: true })
    this.addEventListener('mousedown', this.#handlePressStart)
    this.addEventListener('touchend', this.#handlePressEnd)
    this.addEventListener('touchcancel', this.#handlePressEnd)
    this.addEventListener('mouseup', this.#handlePressEnd)
    this.addEventListener('mouseleave', this.#handlePressEnd)
  }

  #handleClickCapture = (event: Event) => {
    if (isDisabled(this)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  #handleClick = (event: Event) => {
    if (isDisabled(this)) {
      return
    }
    const formType = this.getAttribute('form-type')
    if (!formType) {
      return
    }
    const form = this.closest('form') as HTMLFormElement | null
    if (!form) {
      return
    }
    if (formType === 'submit') {
      const detail = { value: collectFormValues(form) }
      const submitEvent = new CustomEvent('submit', {
        detail,
        bubbles: true,
        cancelable: true,
      })
      const shouldSubmit = form.dispatchEvent(submitEvent)
      if (shouldSubmit && !formConfig.preventDefault) {
        form.submit()
      }
      event.preventDefault()
      return
    }
    if (formType === 'reset') {
      form.reset()
      event.preventDefault()
    }
  }

  #handlePressStart = (event: Event) => {
    if (isDisabled(this)) {
      return
    }
    const hoverClass = getHoverClass(this)
    if (!hoverClass) {
      return
    }
    if (event.type === 'touchstart') {
      this.#lastTouchTime = Date.now()
    }
    if (event.type === 'mousedown' && Date.now() - this.#lastTouchTime < 400) {
      return
    }
    const startTime = parseNumber(this.getAttribute('hover-start-time'), DEFAULT_HOVER_START)
    this.#clearHoverTimers()
    this.#hoverTimer = globalThis.setTimeout(() => {
      this.classList.add(hoverClass)
    }, startTime)
  }

  #handlePressEnd = (event: Event) => {
    const hoverClass = getHoverClass(this)
    if (!hoverClass) {
      return
    }
    if (event.type === 'mouseup' && Date.now() - this.#lastTouchTime < 400) {
      return
    }
    const stayTime = parseNumber(this.getAttribute('hover-stay-time'), DEFAULT_HOVER_STAY)
    if (this.#hoverTimer) {
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = undefined
    }
    if (this.classList.contains(hoverClass)) {
      this.#hoverRemoveTimer = globalThis.setTimeout(() => {
        this.classList.remove(hoverClass)
      }, stayTime)
    }
  }

  #clearHoverTimers() {
    if (this.#hoverTimer) {
      clearTimeout(this.#hoverTimer)
      this.#hoverTimer = undefined
    }
    if (this.#hoverRemoveTimer) {
      clearTimeout(this.#hoverRemoveTimer)
      this.#hoverRemoveTimer = undefined
    }
  }
}

export function ensureButtonDefined() {
  if (typeof customElements === 'undefined') {
    return
  }
  if (!customElements.get(NAV_BUTTON_TAG)) {
    customElements.define(NAV_BUTTON_TAG, WeappButton)
  }
}

export function setButtonFormConfig(next: ButtonFormConfig) {
  formConfig = {
    ...formConfig,
    ...next,
  }
}

export type { ButtonFormConfig }
