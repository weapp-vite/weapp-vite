import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { connectFormControl, disconnectFormControl } from '../formControl'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { currentDateValue, renderPickerEditors } from './editors'
import {
  createPickerChangeDetail,
  normalizePickerIndex,
  normalizePickerIndexes,
  resolvePickerColumns,
  resolvePickerMode,
} from './helpers'
import { PICKER_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function parsePickerAttribute(value: string | null): unknown {
  if (value === null || value === '') {
    return value ?? undefined
  }
  try {
    return JSON.parse(value) as unknown
  }
  catch {
    return value
  }
}

function clonePickerValue(value: unknown): unknown {
  return Array.isArray(value) ? value.map(item => clonePickerValue(item)) : value
}

export class WeappPicker extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('picker')!.attributes]

  #rangeValue: unknown = []
  #rangePropertySet = false
  #valueValue: unknown
  #valuePropertySet = false
  #committedValue: unknown
  #draftValue: unknown
  #initialValue: unknown
  #initialValueCaptured = false
  #backdrop?: HTMLDivElement
  #panel?: HTMLDivElement
  #editors?: HTMLDivElement
  #title?: HTMLDivElement
  #open = false

  get range() {
    return this.#rangePropertySet
      ? this.#rangeValue
      : parsePickerAttribute(this.getAttribute('range')) ?? []
  }

  set range(value: unknown) {
    this.#rangePropertySet = true
    this.#rangeValue = value
    this.#syncExternalValue()
  }

  get value() {
    return this.#valuePropertySet
      ? this.#valueValue
      : parsePickerAttribute(this.getAttribute('value'))
  }

  set value(value: unknown) {
    this.#valuePropertySet = true
    this.#valueValue = value
    this.#syncExternalValue()
  }

  get disabled() {
    return readBooleanAttribute(this, 'disabled')
  }

  get formControlName() {
    return this.getAttribute('name') ?? ''
  }

  get formControlValue() {
    return clonePickerValue(this.#committedValue)
  }

  get formControlDisabled() {
    return this.disabled
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncExternalValue()
    if (!this.#initialValueCaptured) {
      this.#initialValue = clonePickerValue(this.#committedValue)
      this.#initialValueCaptured = true
    }
    this.addEventListener('click', this.#handleHostClick)
    this.addEventListener('keydown', this.#handleHostKeydown)
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0
    }
    connectFormControl(this)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#handleHostClick)
    this.removeEventListener('keydown', this.#handleHostKeydown)
    disconnectFormControl(this)
  }

  attributeChangedCallback() {
    this.#syncExternalValue()
  }

  formActivate() {
    this.open()
  }

  formReset() {
    this.#committedValue = clonePickerValue(this.#initialValue)
    this.#close(false)
  }

  open() {
    if (this.disabled || this.#open || !this.#backdrop) {
      return
    }
    this.#draftValue = clonePickerValue(this.#committedValue)
    this.#renderEditors()
    this.#backdrop.hidden = false
    this.#open = true
  }

  #ensureStructure() {
    if (this.#backdrop || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = PICKER_SHADOW_STYLE
    const slot = document.createElement('slot')
    const backdrop = document.createElement('div')
    backdrop.className = 'backdrop'
    backdrop.hidden = true
    const panel = document.createElement('div')
    panel.className = 'panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    const toolbar = document.createElement('div')
    toolbar.className = 'toolbar'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = '取消'
    const title = document.createElement('div')
    title.className = 'title'
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.textContent = '确定'
    const editors = document.createElement('div')
    editors.className = 'editors'
    toolbar.append(cancel, title, confirm)
    panel.append(toolbar, editors)
    backdrop.append(panel)
    root.append(style, slot, backdrop)
    cancel.addEventListener('click', () => this.#close(true))
    confirm.addEventListener('click', () => this.#confirm())
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        event.stopPropagation()
        this.#close(true)
      }
    })
    this.#backdrop = backdrop
    this.#panel = panel
    this.#editors = editors
    this.#title = title
  }

  #syncExternalValue() {
    const mode = resolvePickerMode(this.getAttribute('mode'))
    const external = this.value
    if (mode === 'selector') {
      const columns = resolvePickerColumns(this.range, mode, this.getAttribute('range-key') ?? undefined)
      this.#committedValue = normalizePickerIndex(external, columns[0]?.length ?? 0)
    }
    else if (mode === 'multiSelector') {
      const columns = resolvePickerColumns(this.range, mode, this.getAttribute('range-key') ?? undefined)
      this.#committedValue = normalizePickerIndexes(external, columns.map(column => column.length))
    }
    else if (mode === 'date') {
      this.#committedValue = typeof external === 'string' && external
        ? external
        : currentDateValue(this.getAttribute('fields') ?? undefined)
    }
    else if (mode === 'time') {
      this.#committedValue = typeof external === 'string' ? external : ''
    }
    else {
      this.#committedValue = Array.isArray(external) ? external.map(item => String(item ?? '')) : []
    }
    if (this.#open) {
      this.#draftValue = clonePickerValue(this.#committedValue)
      this.#renderEditors()
    }
  }

  #renderEditors() {
    if (!this.#editors || typeof document === 'undefined') {
      return
    }
    const mode = resolvePickerMode(this.getAttribute('mode'))
    this.#title!.textContent = this.getAttribute('header-text') ?? ''
    const controls = renderPickerEditors({
      mode,
      range: this.range,
      rangeKey: this.getAttribute('range-key') ?? undefined,
      value: this.#draftValue,
      fields: this.getAttribute('fields') ?? undefined,
      start: this.getAttribute('start') ?? undefined,
      end: this.getAttribute('end') ?? undefined,
      customItem: this.getAttribute('custom-item') ?? undefined,
      level: this.getAttribute('level') ?? undefined,
      onValueChange: (value) => {
        this.#draftValue = value
      },
      onColumnChange: (column, value) => {
        dispatchMiniProgramEvent(this, 'columnchange', { column, value })
      },
    })
    this.#editors.replaceChildren(...controls)
  }

  #confirm() {
    const mode = resolvePickerMode(this.getAttribute('mode'))
    this.#committedValue = clonePickerValue(this.#draftValue)
    this.#close(false)
    dispatchMiniProgramEvent(this, 'change', createPickerChangeDetail(mode, clonePickerValue(this.#committedValue)))
  }

  #close(cancelled: boolean) {
    if (!this.#open || !this.#backdrop) {
      return
    }
    this.#backdrop.hidden = true
    this.#open = false
    if (cancelled) {
      dispatchMiniProgramEvent(this, 'cancel', {})
    }
  }

  #handleHostClick = (event: MouseEvent) => {
    if (this.#panel && event.composedPath().includes(this.#panel)) {
      return
    }
    this.open()
  }

  #handleHostKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.preventDefault()
    this.open()
  }
}

export * from './helpers'
