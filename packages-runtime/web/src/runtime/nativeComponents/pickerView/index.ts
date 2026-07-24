import type { PickerViewColumnChangeDetail } from './helpers'
import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { WeappPickerViewColumn } from './column'
import {
  normalizePickerViewValue,
  PICKER_VIEW_COLUMN_CHANGE_EVENT,
  PICKER_VIEW_COLUMN_READY_EVENT,
  PICKER_VIEW_PICK_END_EVENT,
  PICKER_VIEW_PICK_START_EVENT,
} from './helpers'
import { PICKER_VIEW_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function parsePickerViewValue(value: string | null) {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

export class WeappPickerView extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('picker-view')!.attributes]

  #value: unknown = []
  #valuePropertySet = false
  #columns: WeappPickerViewColumn[] = []
  #slot?: HTMLSlotElement
  #indicator?: HTMLDivElement
  #masks: HTMLDivElement[] = []
  #lastEmittedValue: number[] = []

  get value() {
    return this.#valuePropertySet ? this.#value : parsePickerViewValue(this.getAttribute('value'))
  }

  set value(value: unknown) {
    this.#valuePropertySet = true
    this.#value = value
    this.#syncColumns()
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.addEventListener(PICKER_VIEW_COLUMN_CHANGE_EVENT, this.#handleColumnChange as EventListener)
    this.addEventListener(PICKER_VIEW_COLUMN_READY_EVENT, this.#handleColumnReady)
    this.addEventListener(PICKER_VIEW_PICK_START_EVENT, this.#handlePickStart)
    this.addEventListener(PICKER_VIEW_PICK_END_EVENT, this.#handlePickEnd)
    this.#syncColumns()
    this.#syncStyles()
  }

  disconnectedCallback() {
    this.removeEventListener(PICKER_VIEW_COLUMN_CHANGE_EVENT, this.#handleColumnChange as EventListener)
    this.removeEventListener(PICKER_VIEW_COLUMN_READY_EVENT, this.#handleColumnReady)
    this.removeEventListener(PICKER_VIEW_PICK_START_EVENT, this.#handlePickStart)
    this.removeEventListener(PICKER_VIEW_PICK_END_EVENT, this.#handlePickEnd)
  }

  attributeChangedCallback(name: string) {
    if (name === 'value') {
      this.#syncColumns()
    }
    else {
      this.#syncStyles()
    }
  }

  #ensureStructure() {
    if (this.#slot || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = PICKER_VIEW_SHADOW_STYLE
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const slot = document.createElement('slot')
    const topMask = document.createElement('div')
    topMask.className = 'mask mask--top'
    const bottomMask = document.createElement('div')
    bottomMask.className = 'mask mask--bottom'
    const indicator = document.createElement('div')
    indicator.className = 'indicator'
    viewport.append(slot, topMask, bottomMask, indicator)
    root.append(style, viewport)
    slot.addEventListener('slotchange', () => this.#syncColumns())
    this.#slot = slot
    this.#indicator = indicator
    this.#masks = [topMask, bottomMask]
  }

  #syncColumns() {
    if (!this.#slot) {
      return
    }
    this.#columns = this.#slot.assignedElements({ flatten: true })
      .filter((element): element is WeappPickerViewColumn => element.tagName.toLowerCase() === 'weapp-picker-view-column')
    const next = normalizePickerViewValue(this.value, this.#columns.map(column => column.itemCount))
    this.#columns.forEach((column, index) => column.setSelectedIndex(next[index] ?? 0))
    const itemHeight = this.#columns[0]?.itemHeight
    if (itemHeight) {
      this.style.setProperty('--weapp-picker-view-item-height', `${itemHeight}px`)
    }
    this.#lastEmittedValue = [...next]
  }

  #syncStyles() {
    if (!this.#indicator) {
      return
    }
    this.#indicator.style.cssText = this.getAttribute('indicator-style') ?? ''
    this.#indicator.className = `indicator ${this.getAttribute('indicator-class') ?? ''}`.trim()
    const maskStyle = this.getAttribute('mask-style') ?? ''
    const maskClass = this.getAttribute('mask-class') ?? ''
    this.#masks.forEach((mask, index) => {
      mask.style.cssText = maskStyle
      mask.className = `mask mask--${index === 0 ? 'top' : 'bottom'} ${maskClass}`.trim()
    })
  }

  #handleColumnChange = (event: CustomEvent<PickerViewColumnChangeDetail>) => {
    event.stopPropagation()
    const column = event.target as WeappPickerViewColumn
    const columnIndex = this.#columns.indexOf(column)
    if (columnIndex < 0) {
      return
    }
    const next = normalizePickerViewValue(
      this.#columns.map(item => item.selectedIndex),
      this.#columns.map(item => item.itemCount),
    )
    next[columnIndex] = event.detail.value
    const immediate = readBooleanAttribute(this, 'immediate-change')
    if ((immediate && event.detail.phase === 'changing') || (!immediate && event.detail.phase === 'end')) {
      this.#emitChange(next)
    }
  }

  #handleColumnReady = (event: Event) => {
    event.stopPropagation()
    this.#syncColumns()
  }

  #emitChange(value: number[]) {
    if (value.length === this.#lastEmittedValue.length && value.every((item, index) => item === this.#lastEmittedValue[index])) {
      return
    }
    this.#lastEmittedValue = [...value]
    dispatchMiniProgramEvent(this, 'change', { value })
  }

  #handlePickStart = (event: Event) => {
    event.stopPropagation()
    dispatchMiniProgramEvent(this, 'pickstart', {})
  }

  #handlePickEnd = (event: Event) => {
    event.stopPropagation()
    dispatchMiniProgramEvent(this, 'pickend', {})
  }
}

export { WeappPickerViewColumn }
export * from './helpers'
