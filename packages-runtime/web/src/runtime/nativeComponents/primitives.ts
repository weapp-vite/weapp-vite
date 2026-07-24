import { resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement

class StyledNativeElement extends BaseElement {
  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
  }
}

export class WeappView extends StyledNativeElement {}
export class WeappText extends StyledNativeElement {}
