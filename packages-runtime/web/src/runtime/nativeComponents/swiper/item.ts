import { resolveContainingShadowRoot } from '../helpers'
import { ensureNativeComponentStyle } from '../style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

export class WeappSwiperItem extends BaseElement {
  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
  }
}
