import type { MovablePosition } from './helpers'
import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { dispatchMiniProgramEvent, readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import {
  clampMovablePosition,

  resolveMovableDirection,
  resolveMovableNumber,
} from './helpers'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappMovableArea extends BaseElement {
  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
  }
}

export class WeappMovableView extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('movable-view')!.attributes]

  #position: MovablePosition = { x: 0, y: 0 }
  #drag?: { pointerId: number, startX: number, startY: number, position: MovablePosition }
  #bound = false

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#syncAttributes()
    if (!this.#bound) {
      this.addEventListener('pointerdown', this.#handlePointerDown)
      this.addEventListener('pointermove', this.#handlePointerMove)
      this.addEventListener('pointerup', this.#handlePointerUp)
      this.addEventListener('pointercancel', this.#handlePointerUp)
      this.#bound = true
    }
  }

  disconnectedCallback() {
    this.#drag = undefined
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #syncAttributes() {
    const direction = resolveMovableDirection(this.getAttribute('direction'))
    this.#position = clampMovablePosition({
      x: resolveMovableNumber(this.getAttribute('x')),
      y: resolveMovableNumber(this.getAttribute('y')),
    }, this.#readBounds(), direction, readBooleanAttribute(this, 'out-of-bounds'))
    this.style.transition = readBooleanAttribute(this, 'animation') ? 'transform 300ms ease' : 'none'
    this.#applyPosition()
  }

  #readBounds() {
    const area = this.closest('weapp-movable-area')
    const areaRect = area?.getBoundingClientRect()
    const viewRect = this.getBoundingClientRect()
    return {
      width: areaRect?.width ?? 0,
      height: areaRect?.height ?? 0,
      viewWidth: viewRect.width || 10,
      viewHeight: viewRect.height || 10,
    }
  }

  #applyPosition() {
    this.style.transform = `translate3d(${this.#position.x}px, ${this.#position.y}px, 0)`
  }

  #handlePointerDown = (event: Event) => {
    if (readBooleanAttribute(this, 'disabled')) {
      return
    }
    const pointer = event as PointerEvent
    const pointerId = Number.isFinite(pointer.pointerId) ? pointer.pointerId : 0
    this.#drag = {
      pointerId,
      startX: pointer.clientX,
      startY: pointer.clientY,
      position: { ...this.#position },
    }
    this.setPointerCapture?.(pointerId)
    event.preventDefault()
  }

  #handlePointerMove = (event: Event) => {
    const drag = this.#drag
    if (!drag) {
      return
    }
    const pointer = event as PointerEvent
    if (Number.isFinite(pointer.pointerId) && pointer.pointerId !== drag.pointerId) {
      return
    }
    const direction = resolveMovableDirection(this.getAttribute('direction'))
    const next = clampMovablePosition({
      x: drag.position.x + pointer.clientX - drag.startX,
      y: drag.position.y + pointer.clientY - drag.startY,
    }, this.#readBounds(), direction, readBooleanAttribute(this, 'out-of-bounds'))
    if (direction === 'horizontal' || direction === 'none') {
      next.y = drag.position.y
    }
    if (direction === 'vertical' || direction === 'none') {
      next.x = drag.position.x
    }
    const changedX = next.x !== this.#position.x
    const changedY = next.y !== this.#position.y
    if (!changedX && !changedY) {
      return
    }
    this.#position = next
    this.#applyPosition()
    const detail = { x: next.x, y: next.y, source: 'touch' }
    dispatchMiniProgramEvent(this, 'change', detail)
    if (changedX) {
      dispatchMiniProgramEvent(this, 'htouchmove', detail)
    }
    if (changedY) {
      dispatchMiniProgramEvent(this, 'vtouchmove', detail)
    }
    event.preventDefault()
  }

  #handlePointerUp = (event: Event) => {
    const drag = this.#drag
    if (!drag) {
      return
    }
    const pointer = event as PointerEvent
    if (Number.isFinite(pointer.pointerId) && pointer.pointerId !== drag.pointerId) {
      return
    }
    this.releasePointerCapture?.(drag.pointerId)
    this.#drag = undefined
    dispatchMiniProgramEvent(this, 'change', {
      x: this.#position.x,
      y: this.#position.y,
      source: 'touch',
    })
  }
}

export { clampMovablePosition, resolveMovableDirection } from './helpers'
