import { getNativeComponentDescriptor } from '../../../shared/nativeComponents'
import { resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'
import { resolveIconColor, resolveIconSize, resolveIconType } from './helpers'
import { ICON_SHADOW_STYLE } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappIcon extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('icon')!.attributes]

  #icon?: HTMLSpanElement

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    this.#ensureStructure()
    this.#syncAttributes()
  }

  attributeChangedCallback() {
    this.#syncAttributes()
  }

  #ensureStructure() {
    if (this.#icon || typeof document === 'undefined') {
      return
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = ICON_SHADOW_STYLE
    const icon = document.createElement('span')
    icon.className = 'icon'
    icon.setAttribute('role', 'img')
    root.append(style, icon)
    this.#icon = icon
  }

  #syncAttributes() {
    if (!this.#icon) {
      return
    }
    const type = resolveIconType(this.getAttribute('type'))
    const size = resolveIconSize(this.getAttribute('size'))
    const color = resolveIconColor(type, this.getAttribute('color'))
    this.style.setProperty('--weapp-icon-size', `${size}px`)
    this.style.setProperty('--weapp-icon-color', color)
    this.#icon.className = `icon ${type}`
    this.#icon.setAttribute('aria-label', type)
  }
}

export * from './helpers'
