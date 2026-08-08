import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl, findClosestComposedElement } from './formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export function collectCheckboxGroupValue(checkboxes: ArrayLike<WeappCheckbox>) {
  return Array.from(checkboxes)
    .filter(checkbox => checkbox.checked && !checkbox.disabled)
    .map(checkbox => checkbox.value)
}

export class WeappCheckboxGroup extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('checkbox-group')!.attributes]

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return collectCheckboxGroupValue(this.querySelectorAll<WeappCheckbox>('weapp-checkbox'))
  }

  get formControlDisabled() {
    return false
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    connectFormControl(this)
  }

  disconnectedCallback() {
    disconnectFormControl(this)
  }

  formReset() {
    for (const checkbox of this.querySelectorAll<WeappCheckbox>('weapp-checkbox')) {
      checkbox.formReset()
    }
  }

  notifyCheckboxChange() {
    dispatchMiniProgramEvent(this, 'change', { value: this.formControlValue })
  }
}

export class WeappCheckbox extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('checkbox')!.attributes]

  #input?: HTMLInputElement
  #initialChecked = false
  #initialCheckedCaptured = false

  get value() {
    return this.getAttribute('value') ?? ''
  }

  set value(value: string) {
    this.setAttribute('value', value ?? '')
  }

  get checked() {
    return this.#input?.checked ?? readBooleanAttribute(this, 'checked')
  }

  set checked(value: boolean) {
    this.toggleAttribute('checked', Boolean(value))
  }

  get disabled() {
    return readBooleanAttribute(this, 'disabled')
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    if (!this.#initialCheckedCaptured) {
      this.#initialChecked = readBooleanAttribute(this, 'checked')
      this.#initialCheckedCaptured = true
    }
    this.#ensureStructure()
    this.#syncAttributes()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  formReset() {
    this.setCheckedFromGroup(this.#initialChecked)
  }

  formActivate() {
    if (!this.disabled) {
      this.#input?.click()
    }
  }

  setCheckedFromGroup(checked: boolean) {
    if (this.#input) {
      this.#input.checked = checked
    }
  }

  #ensureStructure() {
    if (this.#input || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { --weapp-control-color: #07c160; }
      label { display: inline-flex; align-items: center; cursor: pointer; }
      input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .control {
        position: relative;
        box-sizing: border-box;
        width: 23px;
        height: 23px;
        flex: 0 0 23px;
        border: 1px solid #d1d1d1;
        border-radius: 3px;
        background: #ffffff;
      }
      input:checked + .control { border-color: var(--weapp-control-color); background: var(--weapp-control-color); }
      input:checked + .control::after {
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
      input:disabled + .control { border-color: #d8d8d8; background: #eeeeee; opacity: 0.7; }
      .content { margin-left: 8px; }
    `
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    const control = document.createElement('span')
    control.className = 'control'
    const content = document.createElement('span')
    content.className = 'content'
    content.append(document.createElement('slot'))
    input.addEventListener('change', (event) => {
      event.stopPropagation()
      const group = findClosestComposedElement(this, 'weapp-checkbox-group') as WeappCheckboxGroup | null
      group?.notifyCheckboxChange()
    })
    label.append(input, control, content)
    root.append(style, label)
    this.#input = input
  }

  #syncAttributes() {
    if (!this.#input) {
      return
    }
    this.#input.checked = readBooleanAttribute(this, 'checked')
    this.#input.disabled = this.disabled
    this.#input.value = this.value
    this.style.setProperty('--weapp-control-color', this.getAttribute('color') || '#07c160')
  }
}
