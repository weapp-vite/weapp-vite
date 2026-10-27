import type { ElementPart, PartInfo } from 'lit/async-directive.js'
import { noChange } from 'lit'
import { AsyncDirective, directive, PartType } from 'lit/async-directive.js'
import { clearRuntimeDataset, storeRuntimeDataset } from './dataset'

/** ElementPart 不提交返回值，绑定指令显式维护属性与对应的运行时值。 */
class RuntimeDatasetBindingDirective extends AsyncDirective {
  #element?: Element
  #attributeName?: string
  #value: unknown

  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.ELEMENT) {
      throw new TypeError('Runtime dataset bindings must be used in an element expression.')
    }
  }

  render(_attributeName: string, _value: unknown) {
    return noChange
  }

  update(part: ElementPart, [attributeName, value]: Parameters<this['render']>) {
    if (this.#element && this.#attributeName && (part.element !== this.#element || attributeName !== this.#attributeName)) {
      clearRuntimeDataset(this.#element, this.#attributeName)
      this.#element.removeAttribute(this.#attributeName)
    }
    this.#element = part.element
    this.#attributeName = attributeName
    this.#value = value
    part.element.setAttribute(attributeName, String(value ?? ''))
    if (this.isConnected) {
      storeRuntimeDataset(part.element, attributeName, value)
    }
    return noChange
  }

  protected disconnected() {
    if (this.#element && this.#attributeName) {
      clearRuntimeDataset(this.#element, this.#attributeName)
    }
  }

  protected reconnected() {
    if (this.#element && this.#attributeName) {
      storeRuntimeDataset(this.#element, this.#attributeName, this.#value)
    }
  }
}

export const bindRuntimeDataset = directive(RuntimeDatasetBindingDirective)
