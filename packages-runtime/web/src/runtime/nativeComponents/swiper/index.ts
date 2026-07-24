import type { SwiperChangeSource } from './helpers'
import type { WeappSwiperItem } from './item'
import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import {
  createSwiperChangeDetail,
  resolveSwiperEasing,
  resolveSwiperIndex,
  resolveSwiperLength,
  resolveSwiperNumber,
  resolveSwiperStep,
  resolveSwipeTarget,
} from './helpers'
import { SWIPER_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappSwiper extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('swiper')!.attributes]

  #viewport?: HTMLDivElement
  #track?: HTMLDivElement
  #slot?: HTMLSlotElement
  #indicators?: HTMLDivElement
  #items: WeappSwiperItem[] = []
  #current = 0
  #itemSize = 0
  #initialized = false
  #autoplayTimer?: ReturnType<typeof globalThis.setTimeout>
  #animationTimer?: ReturnType<typeof globalThis.setTimeout>
  #resizeObserver?: ResizeObserver
  #pointer?: { id: number, start: number, delta: number }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncItems()
    this.#syncAttributes(false)
    this.#observeSize()
    this.#restartAutoplay()
    this.#initialized = true
  }

  disconnectedCallback() {
    this.#clearTimers()
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = undefined
    this.#initialized = false
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected || !this.#initialized) {
      return
    }
    this.#syncAttributes(name === 'current' || name === 'current-item-id', name)
    this.#restartAutoplay()
  }

  #ensureStructure() {
    if (this.#viewport || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = SWIPER_SHADOW_STYLE
    const viewport = document.createElement('div')
    viewport.className = 'viewport'
    const track = document.createElement('div')
    track.className = 'track'
    const slot = document.createElement('slot')
    track.append(slot)
    viewport.append(track)
    const indicators = document.createElement('div')
    indicators.className = 'indicators'
    root.append(style, viewport, indicators)
    slot.addEventListener('slotchange', () => {
      this.#syncItems()
      this.#syncAttributes(false, 'current-item-id')
      this.#restartAutoplay()
    })
    viewport.addEventListener('pointerdown', this.#handlePointerDown)
    viewport.addEventListener('pointermove', this.#handlePointerMove)
    viewport.addEventListener('pointerup', this.#handlePointerEnd)
    viewport.addEventListener('pointercancel', this.#handlePointerEnd)
    this.#viewport = viewport
    this.#track = track
    this.#slot = slot
    this.#indicators = indicators
  }

  #syncItems() {
    if (!this.#slot) {
      return
    }
    this.#items = this.#slot.assignedElements({ flatten: true })
      .filter((element): element is WeappSwiperItem => element.tagName.toLowerCase() === 'weapp-swiper-item')
    if (this.#current >= this.#items.length) {
      this.#current = Math.max(0, this.#items.length - 1)
    }
    this.#renderIndicators()
  }

  #syncAttributes(emitChange: boolean, changedName?: string) {
    if (!this.#track || !this.#viewport) {
      return
    }
    const vertical = readBooleanAttribute(this, 'vertical')
    this.toggleAttribute('data-vertical', vertical)
    const displayCount = Math.max(1, Math.trunc(resolveSwiperNumber(this.getAttribute('display-multiple-items'), 1, 1)))
    const previousMargin = resolveSwiperLength(this.getAttribute('previous-margin'))
    const nextMargin = resolveSwiperLength(this.getAttribute('next-margin'))
    this.style.setProperty('--weapp-swiper-display-count', String(displayCount))
    this.style.setProperty('--weapp-swiper-indicator-color', this.getAttribute('indicator-color') ?? 'rgba(0, 0, 0, 0.3)')
    this.style.setProperty('--weapp-swiper-indicator-active-color', this.getAttribute('indicator-active-color') ?? '#000000')
    this.#track.style.marginLeft = vertical ? '0' : previousMargin
    this.#track.style.marginTop = vertical ? previousMargin : '0'
    this.#track.style.width = vertical ? '100%' : `calc(100% - ${previousMargin} - ${nextMargin})`
    this.#track.style.height = vertical ? `calc(100% - ${previousMargin} - ${nextMargin})` : '100%'
    this.#track.style.transitionTimingFunction = resolveSwiperEasing(this.getAttribute('easing-function'))
    this.#indicators?.toggleAttribute('hidden', !readBooleanAttribute(this, 'indicator-dots'))

    if (!this.#initialized || changedName === 'current' || changedName === 'current-item-id') {
      const itemIds = this.#items.map(item => item.getAttribute('item-id') ?? '')
      const next = resolveSwiperIndex({
        current: resolveSwiperNumber(this.getAttribute('current'), 0),
        currentItemId: this.getAttribute('current-item-id') ?? undefined,
        itemIds,
      })
      if (emitChange && next !== this.#current) {
        this.#setCurrent(next, '', true)
        return
      }
      this.#current = next
    }
    this.#syncVisual(false)
  }

  #syncVisual(animate: boolean, dragOffset = 0) {
    if (!this.#viewport || !this.#track) {
      return
    }
    const vertical = readBooleanAttribute(this, 'vertical')
    const displayCount = Math.max(1, Math.trunc(resolveSwiperNumber(this.getAttribute('display-multiple-items'), 1, 1)))
    const trackRect = this.#track.getBoundingClientRect()
    this.#itemSize = (vertical ? trackRect.height : trackRect.width) / displayCount
    const offset = -(this.#current * this.#itemSize) + dragOffset
    const duration = animate ? resolveSwiperNumber(this.getAttribute('duration'), 500) : 0
    this.#track.style.transitionDuration = `${duration}ms`
    this.#track.style.transform = vertical
      ? `translate3d(0, ${offset}px, 0)`
      : `translate3d(${offset}px, 0, 0)`
    this.#items.forEach((item, index) => {
      const active = index >= this.#current && index < this.#current + displayCount
      item.toggleAttribute('data-active', active)
      item.setAttribute('aria-hidden', String(!active))
    })
    this.#syncIndicatorState()
  }

  #setCurrent(next: number, source: SwiperChangeSource, animate: boolean) {
    if (next === this.#current || !this.#items.length) {
      this.#syncVisual(animate)
      return
    }
    this.#current = next
    this.#syncVisual(animate)
    const detail = createSwiperChangeDetail(
      this.#current,
      this.#items[this.#current]?.getAttribute('item-id') ?? '',
      source,
    )
    dispatchMiniProgramEvent(this, 'change', detail)
    this.#scheduleAnimationFinish(detail, animate)
  }

  #scheduleAnimationFinish(detail: ReturnType<typeof createSwiperChangeDetail>, animate: boolean) {
    if (this.#animationTimer) {
      clearTimeout(this.#animationTimer)
    }
    const duration = animate ? resolveSwiperNumber(this.getAttribute('duration'), 500) : 0
    this.#animationTimer = globalThis.setTimeout(() => {
      this.#animationTimer = undefined
      dispatchMiniProgramEvent(this, 'animationfinish', detail)
    }, duration)
  }

  #renderIndicators() {
    if (!this.#indicators || typeof document === 'undefined') {
      return
    }
    this.#indicators.replaceChildren(...this.#items.map(() => {
      const indicator = document.createElement('span')
      indicator.className = 'indicator'
      return indicator
    }))
    this.#syncIndicatorState()
  }

  #syncIndicatorState() {
    if (!this.#indicators) {
      return
    }
    ;[...this.#indicators.children].forEach((indicator, index) => {
      indicator.setAttribute('data-active', String(index === this.#current))
    })
  }

  #restartAutoplay() {
    if (this.#autoplayTimer) {
      clearTimeout(this.#autoplayTimer)
      this.#autoplayTimer = undefined
    }
    if (!this.isConnected || !readBooleanAttribute(this, 'autoplay') || this.#items.length < 2) {
      return
    }
    const interval = resolveSwiperNumber(this.getAttribute('interval'), 5000, 16)
    this.#autoplayTimer = globalThis.setTimeout(() => {
      this.#autoplayTimer = undefined
      const next = resolveSwiperStep(this.#current, 1, this.#items.length, true)
      this.#setCurrent(next, 'autoplay', true)
      this.#restartAutoplay()
    }, interval)
  }

  #observeSize() {
    if (typeof ResizeObserver === 'undefined' || !this.#viewport || this.#resizeObserver) {
      return
    }
    this.#resizeObserver = new ResizeObserver(() => this.#syncVisual(false))
    this.#resizeObserver.observe(this.#viewport)
  }

  #handlePointerDown = (event: PointerEvent) => {
    if (readBooleanAttribute(this, 'disable-touch') || this.#items.length < 2 || event.button !== 0) {
      return
    }
    const vertical = readBooleanAttribute(this, 'vertical')
    this.#pointer = {
      id: event.pointerId,
      start: vertical ? event.clientY : event.clientX,
      delta: 0,
    }
    this.#viewport?.setPointerCapture?.(event.pointerId)
    this.#clearAnimationTimer()
    this.#syncVisual(false)
  }

  #handlePointerMove = (event: PointerEvent) => {
    if (!this.#pointer || event.pointerId !== this.#pointer.id) {
      return
    }
    const vertical = readBooleanAttribute(this, 'vertical')
    const position = vertical ? event.clientY : event.clientX
    let delta = position - this.#pointer.start
    if (!readBooleanAttribute(this, 'circular')) {
      const atStart = this.#current === 0 && delta > 0
      const atEnd = this.#current === this.#items.length - 1 && delta < 0
      if (atStart || atEnd) {
        delta *= 0.35
      }
    }
    this.#pointer.delta = delta
    this.#syncVisual(false, delta)
    dispatchMiniProgramEvent(this, 'transition', {
      dx: vertical ? 0 : delta,
      dy: vertical ? delta : 0,
    })
  }

  #handlePointerEnd = (event: PointerEvent) => {
    if (!this.#pointer || event.pointerId !== this.#pointer.id) {
      return
    }
    const delta = this.#pointer.delta
    this.#pointer = undefined
    this.#viewport?.releasePointerCapture?.(event.pointerId)
    const next = resolveSwipeTarget({
      current: this.#current,
      delta,
      itemSize: this.#itemSize,
      itemCount: this.#items.length,
      circular: readBooleanAttribute(this, 'circular'),
    })
    this.#setCurrent(next, 'touch', true)
    this.#restartAutoplay()
  }

  #clearAnimationTimer() {
    clearTimeout(this.#animationTimer)
    this.#animationTimer = undefined
  }

  #clearTimers() {
    if (this.#autoplayTimer) {
      clearTimeout(this.#autoplayTimer)
      this.#autoplayTimer = undefined
    }
    this.#clearAnimationTimer()
  }
}
