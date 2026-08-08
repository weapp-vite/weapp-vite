import { collectFormControlValues, resetFormControls } from './formControl'
import { dispatchMiniProgramEvent, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

export interface FormConfig {
  preventDefault?: boolean
}

const DEFAULT_FORM_CONFIG: Required<FormConfig> = {
  preventDefault: true,
}

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
let formConfig: Required<FormConfig> = { ...DEFAULT_FORM_CONFIG }

export class WeappForm extends BaseElement {
  #form?: HTMLFormElement

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
  }

  requestSubmit() {
    const submitEvent = new CustomEvent('submit', {
      detail: { value: collectFormControlValues(this) },
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    const shouldSubmit = this.dispatchEvent(submitEvent)
    if (shouldSubmit && !formConfig.preventDefault) {
      this.#form?.submit()
    }
  }

  reset() {
    resetFormControls(this)
    dispatchMiniProgramEvent(this, 'reset', {})
  }

  #ensureStructure() {
    if (this.#form || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = ':host { display: inline; box-sizing: border-box; } form { display: block; margin: 3px 0 0; }'
    const form = document.createElement('form')
    form.addEventListener('submit', event => event.preventDefault())
    const slot = document.createElement('slot')
    form.append(slot)
    root.append(style, form)
    this.#form = form
  }
}

export function setFormConfig(next: FormConfig) {
  formConfig = {
    ...formConfig,
    ...next,
  }
}
