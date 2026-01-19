import { injectStyle } from './style'

interface ButtonFormConfig {
  preventDefault?: boolean
}

const DEFAULT_FORM_CONFIG: Required<ButtonFormConfig> = {
  preventDefault: true,
}

const DEFAULT_HOVER_CLASS = 'button-hover'
const DEFAULT_HOVER_START = 20
const DEFAULT_HOVER_STAY = 70

const BUTTON_STYLE_ID = 'weapp-web-button-style'
const NAV_BUTTON_TAG = 'weapp-button'
const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

let formConfig: Required<ButtonFormConfig> = { ...DEFAULT_FORM_CONFIG }
let styleInjected = false

const BUTTON_STYLE = `
weapp-button {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

weapp-button.weapp-btn--mini {
  display: inline-block;
  width: auto;
}

weapp-button .weapp-btn {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 100%;
  border-radius: 6px;
  border: 1px solid #d7d7d7;
  padding: 0 16px;
  height: 44px;
  line-height: 44px;
  font-size: 17px;
  font-weight: 400;
  background-color: #f8f8f8;
  color: #000000;
  cursor: pointer;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

weapp-button.weapp-btn--primary .weapp-btn {
  background-color: #07c160;
  border-color: #07c160;
  color: #ffffff;
}

weapp-button.weapp-btn--warn .weapp-btn {
  background-color: #e64340;
  border-color: #e64340;
  color: #ffffff;
}

weapp-button.weapp-btn--plain .weapp-btn {
  background-color: transparent;
}

weapp-button.weapp-btn--plain.weapp-btn--default .weapp-btn {
  border-color: #353535;
  color: #353535;
}

weapp-button.weapp-btn--plain.weapp-btn--primary .weapp-btn {
  border-color: #07c160;
  color: #07c160;
}

weapp-button.weapp-btn--plain.weapp-btn--warn .weapp-btn {
  border-color: #e64340;
  color: #e64340;
}

weapp-button.weapp-btn--loading .weapp-btn,
weapp-button.weapp-btn--disabled .weapp-btn {
  opacity: 0.6;
  cursor: not-allowed;
}

weapp-button.button-hover .weapp-btn {
  opacity: 0.7;
}

weapp-button.button-hover.weapp-btn--plain .weapp-btn {
  background-color: rgba(0, 0, 0, 0.1);
}

weapp-button.weapp-btn--mini .weapp-btn {
  height: 28px;
  line-height: 28px;
  font-size: 13px;
  padding: 0 12px;
  border-radius: 4px;
}

weapp-button .weapp-btn__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

weapp-button .weapp-btn__loading {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: weapp-btn-spin 0.8s linear infinite;
}

weapp-button .weapp-btn__loading[hidden] {
  display: none;
}

@keyframes weapp-btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function ensureButtonStyle() {
  if (styleInjected) {
    return
  }
  injectStyle(BUTTON_STYLE, BUTTON_STYLE_ID)
  styleInjected = true
}

function toBoolean(value: string | null) {
  if (value === null) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'true') {
    return true
  }
  return normalized !== 'false' && normalized !== '0'
}

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value === '') {
    return fallback
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function isDisabled(element: HTMLElement) {
  return toBoolean(element.getAttribute('disabled')) || toBoolean(element.getAttribute('loading'))
}

function normalizeType(value: string | null) {
  if (!value) {
    return 'default'
  }
  const normalized = value.toLowerCase()
  if (normalized === 'primary' || normalized === 'warn') {
    return normalized
  }
  return 'default'
}

function getHoverClass(element: HTMLElement) {
  const hoverClass = element.getAttribute('hover-class')
  if (!hoverClass) {
    return DEFAULT_HOVER_CLASS
  }
  if (hoverClass === 'none') {
    return ''
  }
  return hoverClass
}

function isInternalNode(node: Node) {
  return node instanceof HTMLElement && node.dataset?.weappInternal === 'true'
}

function collectFormValues(form: HTMLFormElement) {
  const values: Record<string, any> = {}

  const appendValue = (name: string, value: any, multiple = false) => {
    if (multiple) {
      if (!Array.isArray(values[name])) {
        values[name] = values[name] === undefined ? [] : [values[name]]
      }
      values[name].push(value)
      return
    }
    values[name] = value
  }

  const formElements = Array.from(form.elements ?? [])
  for (const element of formElements) {
    if (!(element instanceof HTMLElement)) {
      continue
    }
    const name = element.getAttribute('name')?.trim()
    if (!name) {
      continue
    }
    const disabled = 'disabled' in element ? (element as any).disabled : toBoolean(element.getAttribute('disabled'))
    if (disabled) {
      continue
    }
    if (element instanceof HTMLInputElement) {
      const type = element.type?.toLowerCase()
      if (type === 'checkbox') {
        if (element.checked) {
          appendValue(name, element.value, true)
        }
        continue
      }
      if (type === 'radio') {
        if (element.checked) {
          appendValue(name, element.value)
        }
        continue
      }
      appendValue(name, element.value)
      continue
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      appendValue(name, (element as HTMLTextAreaElement | HTMLSelectElement).value)
      continue
    }
  }

  const customControls = form.querySelectorAll('switch, checkbox, radio, picker, slider, weapp-switch, weapp-checkbox, weapp-radio, weapp-picker, weapp-slider')
  for (const element of Array.from(customControls)) {
    const name = element.getAttribute('name')?.trim()
    if (!name) {
      continue
    }
    const disabled = toBoolean(element.getAttribute('disabled'))
    if (disabled) {
      continue
    }
    const tag = element.tagName.toLowerCase()
    const rawValue = (element as any).value ?? element.getAttribute('value')
    if (tag.includes('checkbox')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      if (checked) {
        appendValue(name, rawValue ?? true, true)
      }
      continue
    }
    if (tag.includes('radio')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      if (checked) {
        appendValue(name, rawValue ?? true)
      }
      continue
    }
    if (tag.includes('switch')) {
      const checked = (element as any).checked ?? toBoolean(element.getAttribute('checked'))
      appendValue(name, checked)
      continue
    }
    appendValue(name, rawValue ?? '')
  }

  return values
}

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
  #hoverTimer?: number
  #hoverRemoveTimer?: number
  #lastTouchTime = 0
  #observer?: MutationObserver

  connectedCallback() {
    ensureButtonStyle()
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
