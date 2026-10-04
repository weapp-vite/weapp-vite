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

  attributeChangedCallback(name: string, previous: string | null, current: string | null) {
    if (previous === current) {
      return
    }
    if (name === 'width' || name === 'height') {
      this.#syncSize(name)
    }
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
    this.#syncSize()
  }

  #syncSize(dimension?: 'width' | 'height') {
    const canvas = this.#canvas
    if (!canvas) {
      return
    }
    // 相同尺寸赋值也会清空位图和绘图状态；尺寸只归对应宿主属性的实际变化所有。
    for (const name of dimension ? [dimension] : ['width', 'height'] as const) {
      const size = resolveCanvasSize(this.getAttribute(name), name === 'width' ? 300 : 150)
      if (canvas[name] !== size) {
        canvas[name] = size
      }
    }
  }

  #syncAttributes() {
    const canvas = this.#canvas
    if (!canvas) {
      return
    }
    canvas.style.touchAction = readBooleanAttribute(this, 'disable-scroll') ? 'none' : ''
    registerNativeMediaElement('canvas', [
      this.getAttribute('canvas-id'),
      this.getAttribute('id'),
    ], canvas)
  }
}
