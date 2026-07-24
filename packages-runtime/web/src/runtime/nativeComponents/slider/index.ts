import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl } from '../formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { createSliderEventDetail, resolveSliderConfig } from './helpers'
import { SLIDER_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappSlider extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('slider')!.attributes]

  #input?: HTMLInputElement
  #output?: HTMLOutputElement
  #initialValue = 0
  #initialValueCaptured = false

  get value() {
    return this.#input?.valueAsNumber ?? this.#config.value
  }

  set value(value: number) {
    this.setAttribute('value', String(value))
  }

  get disabled() {
    return readBooleanAttribute(this, 'disabled')
  }

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return this.value
  }

  get formControlDisabled() {
    return this.disabled
  }

  get #config() {
    return resolveSliderConfig({
      min: this.getAttribute('min'),
      max: this.getAttribute('max'),
      step: this.getAttribute('step'),
      value: this.getAttribute('value'),
      blockSize: this.getAttribute('block-size'),
    })
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
    if (!this.#initialValueCaptured) {
      this.#initialValue = this.#config.value
      this.#initialValueCaptured = true
    }
    connectFormControl(this)
  }

  disconnectedCallback() {
    disconnectFormControl(this)
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  formReset() {
    if (!this.#input) {
      return
    }
    this.#input.valueAsNumber = this.#initialValue
    this.#syncVisual()
  }

  formActivate() {
    this.#input?.focus()
  }

  #ensureStructure() {
    if (this.#input || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = SLIDER_SHADOW_STYLE
    const wrapper = document.createElement('div')
    wrapper.className = 'slider'
    const input = document.createElement('input')
    input.type = 'range'
    const output = document.createElement('output')
    input.addEventListener('input', (event) => {
      event.stopPropagation()
      this.#syncVisual()
      dispatchMiniProgramEvent(this, 'changing', createSliderEventDetail(input.valueAsNumber))
    })
    input.addEventListener('change', (event) => {
      event.stopPropagation()
      this.#syncVisual()
      dispatchMiniProgramEvent(this, 'change', createSliderEventDetail(input.valueAsNumber))
    })
    wrapper.append(input, output)
    root.append(style, wrapper)
    this.#input = input
    this.#output = output
  }

  #syncAttributes() {
    if (!this.#input || !this.#output) {
      return
    }
    const config = this.#config
    this.#input.min = String(config.min)
    this.#input.max = String(config.max)
    this.#input.step = String(config.step)
    this.#input.valueAsNumber = config.value
    this.#input.disabled = this.disabled
    this.#output.hidden = !readBooleanAttribute(this, 'show-value')
    this.style.setProperty('--weapp-slider-active-color', this.getAttribute('active-color') ?? this.getAttribute('selected-color') ?? '#1aad19')
    this.style.setProperty('--weapp-slider-background-color', this.getAttribute('background-color') ?? this.getAttribute('color') ?? '#e9e9e9')
    this.style.setProperty('--weapp-slider-block-color', this.getAttribute('block-color') ?? '#ffffff')
    this.style.setProperty('--weapp-slider-block-size', `${config.blockSize}px`)
    this.#syncVisual()
  }

  #syncVisual() {
    if (!this.#input || !this.#output) {
      return
    }
    const min = this.#input.min ? Number(this.#input.min) : 0
    const max = this.#input.max ? Number(this.#input.max) : 100
    const value = this.#input.valueAsNumber
    const progress = max === min ? 0 : ((value - min) / (max - min)) * 100
    this.style.setProperty('--weapp-slider-progress', `${Math.min(100, Math.max(0, progress))}%`)
    this.#output.value = String(value)
    this.#output.textContent = String(value)
  }
}

export * from './helpers'
