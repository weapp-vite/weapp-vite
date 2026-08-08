import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl } from './formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export function createSwitchEventDetail(checked: boolean) {
  return { value: checked }
}

export class WeappSwitch extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('switch')!.attributes]

  #input?: HTMLInputElement
  #initialChecked = false
  #initialCheckedCaptured = false

  get checked() {
    return this.#input?.checked ?? readBooleanAttribute(this, 'checked')
  }

  set checked(value: boolean) {
    this.toggleAttribute('checked', Boolean(value))
  }

  get disabled() {
    return readBooleanAttribute(this, 'disabled')
  }

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return this.checked
  }

  get formControlDisabled() {
    return this.disabled
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    if (!this.#initialCheckedCaptured) {
      this.#initialChecked = readBooleanAttribute(this, 'checked')
      this.#initialCheckedCaptured = true
    }
    this.#ensureStructure()
    this.#syncAttributes()
    connectFormControl(this)
  }

  disconnectedCallback() {
    disconnectFormControl(this)
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  formReset() {
    if (this.#input) {
      this.#input.checked = this.#initialChecked
    }
  }

  formActivate() {
    if (!this.disabled) {
      this.#input?.click()
    }
  }

  #ensureStructure() {
    if (this.#input || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { padding: 0 5px; --weapp-control-color: #07c160; }
      label { display: inline-flex; align-items: center; cursor: pointer; }
      input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .control {
        position: relative;
        box-sizing: border-box;
        width: 52px;
        height: 32px;
        border: 1px solid #dfdfdf;
        border-radius: 16px;
        background: #dfdfdf;
        transition: background 0.2s, border-color 0.2s;
      }
      .control::after {
        position: absolute;
        top: 1px;
        left: 1px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        content: '';
        transition: transform 0.2s;
      }
      input:checked + .control { border-color: var(--weapp-control-color); background: var(--weapp-control-color); }
      input:checked + .control::after { transform: translateX(20px); }
      input:disabled + .control { opacity: 0.5; cursor: not-allowed; }
      :host([type='checkbox']) .control {
        width: 23px;
        height: 23px;
        border-radius: 3px;
        background: #ffffff;
      }
      :host([type='checkbox']) .control::after { display: none; }
      :host([type='checkbox']) input:checked + .control { background: var(--weapp-control-color); }
      :host([type='checkbox']) input:checked + .control::before {
        position: absolute;
        top: 3px;
        left: 7px;
        width: 6px;
        height: 11px;
        border: solid #ffffff;
        border-width: 0 2px 2px 0;
        content: '';
        transform: rotate(45deg);
      }
    `
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.addEventListener('change', (event) => {
      event.stopPropagation()
      dispatchMiniProgramEvent(this, 'change', createSwitchEventDetail(input.checked))
    })
    const control = document.createElement('span')
    control.className = 'control'
    label.append(input, control)
    root.append(style, label)
    this.#input = input
  }

  #syncAttributes() {
    if (!this.#input) {
      return
    }
    this.#input.checked = readBooleanAttribute(this, 'checked')
    this.#input.disabled = this.disabled
    this.style.setProperty('--weapp-control-color', this.getAttribute('color') || '#07c160')
  }
}
