import { getNativeComponentDescriptor } from '../../shared/nativeComponents'
import { isFormActivatable } from './formControl'
import { resolveContainingShadowRoot } from './helpers'
import { ensureNativeComponentStyle } from './style'

const BaseElement = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement
const FORM_CONTROL_SELECTOR = 'weapp-input, weapp-textarea, weapp-checkbox, weapp-radio, weapp-switch'

function findElementById(root: Node, id: string) {
  if (!('querySelectorAll' in root)) {
    return null
  }
  return Array.from((root as ParentNode).querySelectorAll<HTMLElement>('[id]'))
    .find(element => element.id === id) ?? null
}

export class WeappLabel extends BaseElement {
  static observedAttributes = [...getNativeComponentDescriptor('label')!.attributes]

  #bound = false

  connectedCallback() {
    ensureNativeComponentStyle(resolveContainingShadowRoot(this))
    if (!this.#bound) {
      this.#bound = true
      this.addEventListener('click', this.#handleClick)
    }
  }

  #handleClick = (event: Event) => {
    if (event.defaultPrevented) {
      return
    }
    const path = event.composedPath()
    const selfIndex = path.indexOf(this)
    if (path.slice(0, selfIndex).some(node => node instanceof Element && isFormActivatable(node))) {
      return
    }
    const forId = this.getAttribute('for')?.trim()
    const target = forId
      ? findElementById(this.getRootNode(), forId)
      : this.querySelector<HTMLElement>(FORM_CONTROL_SELECTOR)
    if (target && isFormActivatable(target)) {
      target.formActivate?.()
    }
  }
}
