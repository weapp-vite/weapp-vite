import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

/**
 * `scroll-into-view-offset` 的默认值，与微信保持一致。
 */
const DEFAULT_INTO_VIEW_OFFSET = 0

/**
 * 滚动结束后多久算「停止」。浏览器没有可靠的 scrollend 支持，
 * 用尾部静默窗口近似。
 */
const SCROLL_END_DELAY = 150

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
  #scrolling = false
  #scrollEndTimer: ReturnType<typeof setTimeout> | undefined

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

  disconnectedCallback() {
    this.#clearScrollEndTimer()
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
      .viewport.flex { display: flex; }
      .viewport.no-scrollbar { scrollbar-width: none; }
      .viewport.no-scrollbar::-webkit-scrollbar { display: none; }
    `
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const slot = document.createElement('slot')
    viewport.append(slot)
    viewport.addEventListener('scroll', (event) => {
      if (event.target !== viewport) {
        return
      }
      this.#handleScroll()
    })
    root.append(style, viewport)
    this.#viewport = viewport
  }

  #handleScroll() {
    const viewport = this.#viewport
    if (!viewport) {
      return
    }
    if (!this.#scrolling) {
      this.#scrolling = true
      // scrollstart 只报告起点，不能推进 delta 基线，否则首次 scroll 的 delta 会变成 0。
      dispatchMiniProgramEvent(this, 'scrollstart', this.#peekDetail(), {
        bubbles: false,
        composed: false,
      })
    }
    else {
      this.#clearScrollEndTimer()
    }
    dispatchMiniProgramEvent(this, 'scroll', this.#createDetail(), {
      bubbles: false,
      composed: false,
    })
    this.#scrollEndTimer = setTimeout(() => {
      this.#scrollEndTimer = undefined
      this.#scrolling = false
      dispatchMiniProgramEvent(this, 'scrollend', this.#peekDetail(), {
        bubbles: false,
        composed: false,
      })
    }, SCROLL_END_DELAY)
  }

  #peekDetail() {
    return createScrollEventDetail(this.#viewport!, {
      scrollLeft: this.#lastScrollLeft,
      scrollTop: this.#lastScrollTop,
    })
  }

  #createDetail() {
    const viewport = this.#viewport!
    const detail = createScrollEventDetail(viewport, {
      scrollLeft: this.#lastScrollLeft,
      scrollTop: this.#lastScrollTop,
    })
    this.#lastScrollLeft = viewport.scrollLeft
    this.#lastScrollTop = viewport.scrollTop
    return detail
  }

  #clearScrollEndTimer() {
    if (this.#scrollEndTimer) {
      clearTimeout(this.#scrollEndTimer)
      this.#scrollEndTimer = undefined
    }
  }

  #syncAttributes(changedName?: string, initializePosition = false) {
    const viewport = this.#viewport
    if (!viewport) {
      return
    }
    if (!changedName || changedName === 'scroll-x') {
      viewport.style.overflowX = readBooleanAttribute(this, 'scroll-x') ? 'auto' : 'hidden'
    }
    if (!changedName || changedName === 'scroll-y') {
      viewport.style.overflowY = readBooleanAttribute(this, 'scroll-y') ? 'auto' : 'hidden'
    }
    if (!changedName || changedName === 'enable-flex') {
      viewport.classList.toggle('flex', readBooleanAttribute(this, 'enable-flex'))
    }
    if (!changedName || changedName === 'show-scrollbar') {
      // 微信默认隐藏滚动条，只有显式 show-scrollbar 才展示。
      const explicit = this.hasAttribute('show-scrollbar')
      const visible = explicit && readBooleanAttribute(this, 'show-scrollbar')
      viewport.classList.toggle('no-scrollbar', !visible)
    }
    if (initializePosition || changedName === 'scroll-top') {
      const scrollTop = Number(this.getAttribute('scroll-top'))
      if (Number.isFinite(scrollTop)) {
        viewport.scrollTop = scrollTop
      }
    }
    if (initializePosition || changedName === 'scroll-left') {
      const scrollLeft = Number(this.getAttribute('scroll-left'))
      if (Number.isFinite(scrollLeft)) {
        viewport.scrollLeft = scrollLeft
      }
    }
    if (initializePosition || changedName === 'scroll-into-view' || changedName === 'scroll-into-view-offset') {
      this.#scrollIntoView()
    }
  }

  /**
   * `scroll-into-view` 接收子元素的 id。目标不在当前滚动容器内时保持不动，
   * 与小程序「找不到就不滚动」的行为一致。
   */
  #scrollIntoView() {
    const viewport = this.#viewport
    const targetId = this.getAttribute('scroll-into-view')?.trim()
    if (!viewport || !targetId) {
      return
    }
    const target = this.#findById(targetId)
    if (!target) {
      return
    }
    const offsetAttr = Number(this.getAttribute('scroll-into-view-offset'))
    const offset = Number.isFinite(offsetAttr) ? offsetAttr : DEFAULT_INTO_VIEW_OFFSET
    const horizontal = readBooleanAttribute(this, 'scroll-x')
    const vertical = readBooleanAttribute(this, 'scroll-y')
    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    if (vertical) {
      const next = viewport.scrollTop + (targetRect.top - viewportRect.top) - offset
      // 目标已经完整可见时不做调整，避免每次属性同步都跳一下。
      const isVisible = targetRect.top >= viewportRect.top - 1 && targetRect.bottom <= viewportRect.bottom + 1
      if (!isVisible) {
        viewport.scrollTop = Math.max(0, next)
      }
    }
    if (horizontal) {
      const next = viewport.scrollLeft + (targetRect.left - viewportRect.left) - offset
      const isVisible = targetRect.left >= viewportRect.left - 1 && targetRect.right <= viewportRect.right + 1
      if (!isVisible) {
        viewport.scrollLeft = Math.max(0, next)
      }
    }
  }

  #findById(id: string) {
    // slot 内容留在 light DOM，host 的 querySelector 就能覆盖到；
    // 不再深入嵌套 shadow root，避免每次属性同步都全量遍历。
    for (const child of this.children) {
      if (child.id === id) {
        return child
      }
      const nested = child.querySelector?.(`[id="${id.replace(/"/g, '\\"')}"]`)
      if (nested) {
        return nested
      }
    }
    return undefined
  }
}
