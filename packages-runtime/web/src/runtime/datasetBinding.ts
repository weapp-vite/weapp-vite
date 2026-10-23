import type { ElementPart, PartInfo } from 'lit/async-directive.js'
import { nothing } from 'lit'
import { AsyncDirective, directive, PartType } from 'lit/async-directive.js'
import { storeRuntimeDataset } from './dataset'

/**
 * `data-*` 的对象值没法塞进 DOM attribute，交给 WeakMap 旁路保存，
 * attribute 上只保留空串，事件对象构造时再合并回来（见 dataset.ts）。
 */
class RuntimeDatasetBindingDirective extends AsyncDirective {
  #element?: Element
  #key?: string
  #value?: unknown
  #applied = false

  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.ELEMENT) {
      throw new TypeError('Runtime dataset bindings must be used in an element expression.')
    }
  }

  render(_key: string, value: unknown) {
    if (typeof value === 'object' && value !== null) {
      return ''
    }
    return value ?? nothing
  }

  update(part: ElementPart, [key, value]: Parameters<this['render']>) {
    if (!this.#applied || part.element !== this.#element || key !== this.#key || value !== this.#value) {
      this.#element = part.element
      this.#key = key
      this.#value = value
      this.#applied = true
      storeRuntimeDataset(part.element, `data-${key}`, value)
    }
    return this.render(key, value)
  }

  protected disconnected() {
    if (this.#element && this.#key) {
      storeRuntimeDataset(this.#element, `data-${this.#key}`, undefined)
    }
  }
}

export const bindRuntimeDataset = directive(RuntimeDatasetBindingDirective)
