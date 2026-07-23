import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export function createScrollEventDetail(
  viewport: Pick<HTMLDivElement, 'scrollHeight' | 'scrollLeft' | 'scrollTop' | 'scrollWidth'>,
  previous: { scrollLeft: number, scrollTop: number },
) {
  return {
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    scrollWidth: viewport.scrollWidth,
    scrollHeight: viewport.scrollHeight,
    deltaX: viewport.scrollLeft - previous.scrollLeft,
    deltaY: viewport.scrollTop - previous.scrollTop,
  }
}

export class WeappScrollView extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('scroll-view')!.attributes]

  #viewport?: HTMLDivElement
  #lastScrollLeft = 0
  #lastScrollTop = 0

  get scrollTop() {
    return this.#viewport?.scrollTop ?? 0
  }

  set scrollTop(value: number) {
    if (this.#viewport) {
      this.#viewport.scrollTop = value
    }
  }

  get scrollLeft() {
    return this.#viewport?.scrollLeft ?? 0
  }

  set scrollLeft(value: number) {
    if (this.#viewport) {
      this.#viewport.scrollLeft = value
    }
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#viewport || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { min-width: 0; min-height: 0; }
      .viewport { width: 100%; height: 100%; overscroll-behavior: contain; }
    `
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const slot = document.createElement('slot')
    viewport.append(slot)
    viewport.addEventListener('scroll', () => {
      const detail = createScrollEventDetail(viewport, {
        scrollLeft: this.#lastScrollLeft,
        scrollTop: this.#lastScrollTop,
      })
      this.#lastScrollLeft = viewport.scrollLeft
      this.#lastScrollTop = viewport.scrollTop
      dispatchMiniProgramEvent(this, 'scroll', detail)
    })
    root.append(style, viewport)
    this.#viewport = viewport
  }

  #syncAttributes() {
    if (!this.#viewport) {
      return
    }
    this.#viewport.style.overflowX = readBooleanAttribute(this, 'scroll-x') ? 'auto' : 'hidden'
    this.#viewport.style.overflowY = readBooleanAttribute(this, 'scroll-y') ? 'auto' : 'hidden'
    const scrollTop = Number(this.getAttribute('scroll-top'))
    const scrollLeft = Number(this.getAttribute('scroll-left'))
    if (Number.isFinite(scrollTop)) {
      this.#viewport.scrollTop = scrollTop
    }
    if (Number.isFinite(scrollLeft)) {
      this.#viewport.scrollLeft = scrollLeft
    }
  }
}
