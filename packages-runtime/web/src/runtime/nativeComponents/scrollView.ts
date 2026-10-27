import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { getRuntimeRpxSize } from '../rpx'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
const DEFAULT_SCROLL_THRESHOLD = 50
const THRESHOLD_VALUE_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(px|rpx)?$/i

/**
 * 距离阈值与真机一致：默认 50px，支持 px / rpx 两种单位。
 * rpx 的换算基准与 `--rpx` 一致，使用设备视口宽度而不是浏览器窗口宽度。
 */
function resolveScrollThreshold(element: Element, name: string) {
  const raw = element.getAttribute(name)?.trim()
  if (!raw) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  const match = raw.match(THRESHOLD_VALUE_RE)
  const numeric = match ? Number(match[1]) : Number.NaN
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_SCROLL_THRESHOLD
  }
  return match?.[2]?.toLowerCase() === 'rpx' ? numeric * getRuntimeRpxSize() : numeric
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
  #boundaries = { top: false, bottom: false, left: false, right: false }

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
      const previous = { scrollLeft: this.#lastScrollLeft, scrollTop: this.#lastScrollTop }
      const detail = createScrollEventDetail(viewport, previous)
      const boundaries = this.#collectBoundaryEvents(viewport, previous)
      this.#lastScrollLeft = viewport.scrollLeft
      this.#lastScrollTop = viewport.scrollTop
      dispatchMiniProgramEvent(this, 'scroll', detail, {
        bubbles: false,
        composed: false,
      })
      for (const [name, direction] of boundaries) {
        dispatchMiniProgramEvent(this, name, { direction }, { bubbles: false, composed: false })
      }
    })
    root.append(style, viewport)
    this.#viewport = viewport
  }

  /** 用当前尺寸重新判断上次位置，避免追加内容后直接滚到新边界时沿用旧状态。 */
  #collectBoundaryEvents(viewport: HTMLDivElement, previous: { scrollLeft: number, scrollTop: number }) {
    const scrollY = readBooleanAttribute(this, 'scroll-y') && viewport.scrollHeight > viewport.clientHeight
    const scrollX = readBooleanAttribute(this, 'scroll-x') && viewport.scrollWidth > viewport.clientWidth
    const lowerThreshold = resolveScrollThreshold(this, 'lower-threshold')
    const upperThreshold = resolveScrollThreshold(this, 'upper-threshold')
    const bottom = viewport.scrollHeight - viewport.clientHeight - lowerThreshold
    const right = viewport.scrollWidth - viewport.clientWidth - lowerThreshold
    const current = {
      top: scrollY && viewport.scrollTop <= upperThreshold,
      bottom: scrollY && viewport.scrollTop >= bottom,
      left: scrollX && viewport.scrollLeft <= upperThreshold,
      right: scrollX && viewport.scrollLeft >= right,
    }
    const entered = {
      top: current.top && !(this.#boundaries.top && previous.scrollTop <= upperThreshold),
      bottom: current.bottom && !(this.#boundaries.bottom && previous.scrollTop >= bottom),
      left: current.left && !(this.#boundaries.left && previous.scrollLeft <= upperThreshold),
      right: current.right && !(this.#boundaries.right && previous.scrollLeft >= right),
    }
    // 先提交所有轴的状态，业务 scroll/边界回调重新滚动时不会重复派发同一边界。
    this.#boundaries = current
    const events: Array<[string, string]> = []
    if (entered.bottom || entered.right) {
      events.push(['scrolltolower', entered.right ? 'right' : 'bottom'])
    }
    if (entered.top || entered.left) {
      events.push(['scrolltoupper', entered.left ? 'left' : 'top'])
    }
    return events
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
