import type { ScrollPosition } from './helpers'
import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { createScrollBoundaryTracker } from './boundaries'
import { createScrollEventDetail } from './helpers'
import { findScrollTarget, scrollToTarget } from './position'

export { createScrollEventDetail } from './helpers'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
const SCROLL_END_DELAY = 150
const POSITION_ATTRIBUTES = new Set(['scroll-into-view', 'scroll-into-view-offset', 'scroll-into-view-alignment', 'scroll-top', 'scroll-left', 'scroll-x', 'scroll-y'])
const EVENT_OPTIONS = { bubbles: false, composed: false }

export class WeappScrollView extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('scroll-view')!.attributes]

  #viewport?: HTMLDivElement
  #previous: ScrollPosition = { scrollLeft: 0, scrollTop: 0 }
  #boundaries = createScrollBoundaryTracker()
  #scrolling = false
  #generation = 0
  #connectionVersion = 0
  #scrollEndTimer: ReturnType<typeof setTimeout> | undefined
  #childrenObserver?: MutationObserver
  #resizeObserver?: ResizeObserver
  #alignedTarget?: Element

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
    if (!initializePosition) {
      this.#previous = { scrollLeft: this.scrollLeft, scrollTop: this.scrollTop }
    }
    this.#syncAttributes(undefined, initializePosition)
    this.#childrenObserver ??= new MutationObserver(() => this.#scrollIntoView(true))
    this.#childrenObserver.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] })
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver ??= new ResizeObserver(() => this.#scrollIntoView(true))
      this.#resizeObserver.observe(this.#viewport!)
    }
  }

  disconnectedCallback() {
    this.#connectionVersion += 1
    this.#generation += 1
    this.#clearScrollEndTimer()
    this.#scrolling = false
    this.#boundaries.reset()
    this.#childrenObserver?.disconnect()
    this.#resizeObserver?.disconnect()
    this.#alignedTarget = undefined
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
      .viewport.flex {
        display: inherit;
        flex-direction: inherit;
        flex-wrap: inherit;
        justify-content: inherit;
        align-items: inherit;
        align-content: inherit;
        gap: inherit;
      }
      .viewport.flex > slot { display: contents; }
      .viewport.no-scrollbar { scrollbar-width: none; }
      .viewport.no-scrollbar.scroll-x { scrollbar-width: auto; }
      .viewport.no-scrollbar::-webkit-scrollbar:vertical { display: none; width: 0; }
    `
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const slot = document.createElement('slot')
    slot.addEventListener('slotchange', () => this.#scrollIntoView(true))
    viewport.append(slot)
    viewport.addEventListener('scroll', (event) => {
      if (event.target === viewport) {
        this.#handleScroll()
      }
    })
    root.append(style, viewport)
    this.#viewport = viewport
  }

  #handleScroll() {
    const viewport = this.#viewport
    if (!viewport || !this.isConnected) {
      return
    }
    const detail = createScrollEventDetail(viewport, this.#previous)
    const connectionVersion = this.#connectionVersion
    const boundaries = this.#boundaries.collect(this, viewport, this.#previous)
    this.#previous = { scrollLeft: detail.scrollLeft, scrollTop: detail.scrollTop }
    const started = !this.#scrolling
    this.#scrolling = true
    this.#clearScrollEndTimer()
    const generation = ++this.#generation
    // 在任何业务回调前登记计时器；重入滚动可直接接管，断连可立即取消。
    this.#scrollEndTimer = setTimeout(() => {
      if (generation !== this.#generation || !this.isConnected) {
        return
      }
      this.#scrollEndTimer = undefined
      this.#scrolling = false
      dispatchMiniProgramEvent(this, 'scrollend', { ...detail, deltaX: 0, deltaY: 0 }, EVENT_OPTIONS)
    }, SCROLL_END_DELAY)
    if (started) {
      dispatchMiniProgramEvent(this, 'scrollstart', detail, EVENT_OPTIONS)
    }
    if (!this.isConnected || connectionVersion !== this.#connectionVersion) {
      return
    }
    dispatchMiniProgramEvent(this, 'scroll', detail, EVENT_OPTIONS)
    for (const [name, direction] of boundaries) {
      if (!this.isConnected || connectionVersion !== this.#connectionVersion) {
        break
      }
      dispatchMiniProgramEvent(this, name, { direction }, EVENT_OPTIONS)
    }
  }

  #clearScrollEndTimer() {
    if (this.#scrollEndTimer !== undefined) {
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
      const scrollX = readBooleanAttribute(this, 'scroll-x')
      viewport.style.overflowX = scrollX ? 'auto' : 'hidden'
      viewport.classList.toggle('scroll-x', scrollX)
    }
    if (!changedName || changedName === 'scroll-y') {
      viewport.style.overflowY = readBooleanAttribute(this, 'scroll-y') ? 'auto' : 'hidden'
    }
    if (!changedName || changedName === 'enable-flex') {
      viewport.classList.toggle('flex', readBooleanAttribute(this, 'enable-flex'))
    }
    if (!changedName || changedName === 'show-scrollbar' || changedName === 'enhanced' || changedName === 'scroll-y') {
      const hidden = readBooleanAttribute(this, 'scroll-y') && readBooleanAttribute(this, 'enhanced')
        && this.hasAttribute('show-scrollbar') && !readBooleanAttribute(this, 'show-scrollbar')
      viewport.classList.toggle('no-scrollbar', hidden)
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
    if (!changedName || POSITION_ATTRIBUTES.has(changedName)) {
      this.#scrollIntoView()
    }
  }

  #scrollIntoView(onlyNewTarget = false) {
    const viewport = this.#viewport
    if (!viewport || !this.isConnected) {
      return
    }
    const target = findScrollTarget(this)
    if (!target) {
      this.#alignedTarget = undefined
      return
    }
    if (onlyNewTarget && target === this.#alignedTarget) {
      return
    }
    this.#alignedTarget = scrollToTarget(this, viewport, target) ? target : undefined
  }
}
