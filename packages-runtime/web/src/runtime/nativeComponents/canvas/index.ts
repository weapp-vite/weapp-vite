import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { readBooleanAttribute, resolveContainingShadowRoot } from '../helpers'
import { registerNativeMediaElement, unregisterNativeMediaElement } from '../mediaRegistry'
import { ensureNativeComponentStyle } from '../style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

function resolveCanvasSize(value: string | null, fallback: number) {
  const size = Number(value)
  return Number.isInteger(size) && size > 0 ? size : fallback
}

export class WeappCanvas extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('canvas')!.attributes]

  #canvas?: HTMLCanvasElement

  get canvasElement() {
    return this.#canvas
  }

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
  }

  disconnectedCallback() {
    if (this.#canvas) {
      unregisterNativeMediaElement(this.#canvas)
    }
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#canvas || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { position: relative; }
      canvas { display: block; }
    `
    const canvas = document.createElement('canvas')
    root.append(style, canvas)
    this.#canvas = canvas
  }

  #syncAttributes() {
    const canvas = this.#canvas
    if (!canvas) {
      return
    }
    canvas.width = resolveCanvasSize(this.getAttribute('width'), 300)
    canvas.height = resolveCanvasSize(this.getAttribute('height'), 150)
    canvas.style.touchAction = readBooleanAttribute(this, 'disable-scroll') ? 'none' : ''
    registerNativeMediaElement('canvas', [
      this.getAttribute('canvas-id'),
      this.getAttribute('id'),
    ], canvas)
  }
}
