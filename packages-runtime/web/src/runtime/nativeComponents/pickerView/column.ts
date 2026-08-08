import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import {
  PICKER_VIEW_COLUMN_CHANGE_EVENT,
  PICKER_VIEW_COLUMN_READY_EVENT,
  PICKER_VIEW_PICK_END_EVENT,
  PICKER_VIEW_PICK_START_EVENT,
} from './helpers'
import { PICKER_VIEW_COLUMN_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappPickerViewColumn extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('picker-view-column')!.attributes]

  #scroller?: HTMLDivElement
  #slot?: HTMLSlotElement
  #itemHeight = 34
  #selectedIndex = 0
  #scrollTimer?: ReturnType<typeof globalThis.setTimeout>
  #resizeObserver?: ResizeObserver
  #picking = false
  #suppressScroll = false

  get itemCount() {
    return this.#items.length
  }

  get itemHeight() {
    return this.#itemHeight
  }

  get selectedIndex() {
    if (!this.#scroller) {
      return this.#selectedIndex
    }
    return this.#clampIndex(Math.round(this.#scroller.scrollTop / this.#itemHeight))
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncMetrics()
    this.#observeSize()
  }

  disconnectedCallback() {
    if (this.#scrollTimer) {
      clearTimeout(this.#scrollTimer)
      this.#scrollTimer = undefined
    }
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = undefined
  }

  setSelectedIndex(value: number) {
    this.#selectedIndex = this.#clampIndex(value)
    if (!this.#scroller) {
      return
    }
    this.#suppressScroll = true
    this.#scroller.scrollTop = this.#selectedIndex * this.#itemHeight
    requestAnimationFrame(() => {
      this.#suppressScroll = false
    })
  }

  get #items() {
    return this.#slot?.assignedElements({ flatten: true }) ?? []
  }

  #ensureStructure() {
    if (this.#scroller || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = PICKER_VIEW_COLUMN_SHADOW_STYLE
    const scroller = document.createElement('div')
    scroller.className = 'scroller'
    const leading = document.createElement('div')
    leading.className = 'spacer'
    const slot = document.createElement('slot')
    const trailing = document.createElement('div')
    trailing.className = 'spacer'
    scroller.append(leading, slot, trailing)
    root.append(style, scroller)
    slot.addEventListener('slotchange', () => this.#syncMetrics())
    scroller.addEventListener('pointerdown', this.#handlePickStart)
    scroller.addEventListener('pointerup', this.#schedulePickEnd)
    scroller.addEventListener('pointercancel', this.#schedulePickEnd)
    scroller.addEventListener('scroll', this.#handleScroll, { passive: true })
    this.#scroller = scroller
    this.#slot = slot
  }

  #syncMetrics() {
    const first = this.#items[0] as HTMLElement | undefined
    const height = first?.getBoundingClientRect().height
    this.#itemHeight = height && Number.isFinite(height) && height > 0 ? height : 34
    this.style.setProperty('--weapp-picker-view-item-height', `${this.#itemHeight}px`)
    this.setSelectedIndex(this.#selectedIndex)
    this.#dispatchInternal(PICKER_VIEW_COLUMN_READY_EVENT)
  }

  #observeSize() {
    if (typeof ResizeObserver === 'undefined' || !this.#scroller || this.#resizeObserver) {
      return
    }
    this.#resizeObserver = new ResizeObserver(() => this.#syncMetrics())
    this.#resizeObserver.observe(this.#scroller)
  }

  #clampIndex(value: number) {
    const index = Number.isFinite(value) ? Math.trunc(value) : 0
    return Math.min(Math.max(0, index), Math.max(0, this.itemCount - 1))
  }

  #dispatchInternal(name: string, detail: unknown = {}) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail,
    }))
  }

  #handlePickStart = () => {
    if (this.#picking || this.#suppressScroll) {
      return
    }
    this.#picking = true
    this.#dispatchInternal(PICKER_VIEW_PICK_START_EVENT)
  }

  #handleScroll = () => {
    if (this.#suppressScroll) {
      return
    }
    this.#handlePickStart()
    this.#selectedIndex = this.selectedIndex
    this.#dispatchInternal(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
      value: this.#selectedIndex,
      phase: 'changing',
    })
    this.#schedulePickEnd()
  }

  #schedulePickEnd = () => {
    if (this.#scrollTimer) {
      clearTimeout(this.#scrollTimer)
    }
    this.#scrollTimer = globalThis.setTimeout(() => {
      this.#scrollTimer = undefined
      this.#selectedIndex = this.selectedIndex
      this.setSelectedIndex(this.#selectedIndex)
      this.#dispatchInternal(PICKER_VIEW_COLUMN_CHANGE_EVENT, {
        value: this.#selectedIndex,
        phase: 'end',
      })
      if (this.#picking) {
        this.#picking = false
        this.#dispatchInternal(PICKER_VIEW_PICK_END_EVENT)
      }
    }, 100)
  }
}
