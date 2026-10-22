import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { getWebViewportWidth } from '../viewport'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
const DEFAULT_SCROLL_THRESHOLD = 50
const RPX_VALUE_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))rpx$/i

/**
 * 距离阈值与真机一致：默认 50px，支持 px / rpx 两种单位。
 * rpx 的换算基准与 `--rpx` 一致，使用设备视口宽度而不是浏览器窗口宽度。
 */
function resolveScrollThreshold(element: Element, name: string) {
  const raw = element.getAttribute(name)?.trim()
  if (!raw) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  const rpxMatch = raw.match(RPX_VALUE_RE)
  const numeric = rpxMatch ? Number.parseFloat(rpxMatch[1]!) : Number.parseFloat(raw)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  return rpxMatch ? numeric * getWebViewportWidth() / 750 : numeric
}

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
  #atLowerBoundary = false
  #atUpperBoundary = false

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
    const initializePosition = !this.#viewport
    this.#ensureStructure()
    this.#syncAttributes(undefined, initializePosition)
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue !== newValue) {
      this.#syncAttributes(name)
    }
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
    viewport.addEventListener('scroll', (event) => {
      if (event.target !== viewport) {
        return
      }
      const detail = createScrollEventDetail(viewport, {
        scrollLeft: this.#lastScrollLeft,
        scrollTop: this.#lastScrollTop,
      })
      this.#lastScrollLeft = viewport.scrollLeft
      this.#lastScrollTop = viewport.scrollTop
      dispatchMiniProgramEvent(this, 'scroll', detail, {
        bubbles: false,
        composed: false,
      })
      this.#dispatchBoundaryEvents(viewport)
    })
    root.append(style, viewport)
    this.#viewport = viewport
  }

  /**
   * 真机只在「进入」阈值区间时派发一次边界事件：内容加载后滚离边界再回来会重新派发，
   * 停在边界上继续滚动不会重复触发。
   */
  #dispatchBoundaryEvents(viewport: HTMLDivElement) {
    // 内容不足以滚动时真机不会派发边界事件，这里保持同样的语义。
    const scrollY = readBooleanAttribute(this, 'scroll-y') && viewport.scrollHeight > viewport.clientHeight
    const scrollX = readBooleanAttribute(this, 'scroll-x') && viewport.scrollWidth > viewport.clientWidth
    const lowerThreshold = resolveScrollThreshold(this, 'lower-threshold')
    const upperThreshold = resolveScrollThreshold(this, 'upper-threshold')
    const atBottom = scrollY
      && viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - lowerThreshold
    const atRight = scrollX
      && viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - lowerThreshold
    const atTop = scrollY && viewport.scrollTop <= upperThreshold
    const atLeft = scrollX && viewport.scrollLeft <= upperThreshold

    const atLower = atBottom || atRight
    if (atLower !== this.#atLowerBoundary) {
      this.#atLowerBoundary = atLower
      if (atLower) {
        dispatchMiniProgramEvent(this, 'scrolltolower', { direction: atRight ? 'right' : 'bottom' }, {
          bubbles: false,
          composed: false,
        })
      }
    }

    const atUpper = atTop || atLeft
    if (atUpper !== this.#atUpperBoundary) {
      this.#atUpperBoundary = atUpper
      if (atUpper) {
        dispatchMiniProgramEvent(this, 'scrolltoupper', { direction: atLeft ? 'left' : 'top' }, {
          bubbles: false,
          composed: false,
        })
      }
    }
  }

  #syncAttributes(changedName?: string, initializePosition = false) {
    if (!this.#viewport) {
      return
    }
    if (!changedName || changedName === 'scroll-x') {
      this.#viewport.style.overflowX = readBooleanAttribute(this, 'scroll-x') ? 'auto' : 'hidden'
    }
    if (!changedName || changedName === 'scroll-y') {
      this.#viewport.style.overflowY = readBooleanAttribute(this, 'scroll-y') ? 'auto' : 'hidden'
    }
    if (initializePosition || changedName === 'scroll-top') {
      const scrollTop = Number(this.getAttribute('scroll-top'))
      if (Number.isFinite(scrollTop)) {
        this.#viewport.scrollTop = scrollTop
      }
    }
    if (initializePosition || changedName === 'scroll-left') {
      const scrollLeft = Number(this.getAttribute('scroll-left'))
      if (Number.isFinite(scrollLeft)) {
        this.#viewport.scrollLeft = scrollLeft
      }
    }
  }
}
