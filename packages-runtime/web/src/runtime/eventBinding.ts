import type { ElementPart, PartInfo } from 'lit/async-directive.js'
import { nothing } from 'lit'
import { AsyncDirective, directive, PartType } from 'lit/async-directive.js'

interface RuntimeEventFlags {
  capture?: boolean
}

class RuntimeEventBindingDirective extends AsyncDirective {
  #capture = false
  #element?: Element
  #eventName?: string
  #listener?: EventListener
  #listening = false

  constructor(partInfo: PartInfo) {
    super(partInfo)
    if (partInfo.type !== PartType.ELEMENT) {
      throw new TypeError('Runtime event bindings must be used in an element expression.')
    }
  }

  render(_eventName: string, _listener: EventListener, _flags?: RuntimeEventFlags) {
    return nothing
  }

  update(
    part: ElementPart,
    [eventName, listener, flags]: Parameters<this['render']>,
  ) {
    const capture = Boolean(flags?.capture)
    if (
      part.element !== this.#element
      || eventName !== this.#eventName
      || listener !== this.#listener
      || capture !== this.#capture
    ) {
      this.#removeListener()
      this.#element = part.element
      this.#eventName = eventName
      this.#listener = listener
      this.#capture = capture
      this.#addListener()
    }
    return nothing
  }

  protected disconnected() {
    this.#removeListener()
  }

  protected reconnected() {
    this.#addListener()
  }

  #addListener() {
    if (!this.isConnected || this.#listening || !this.#element || !this.#eventName || !this.#listener) {
      return
    }
    this.#element.addEventListener(this.#eventName, this.#listener, this.#capture)
    this.#listening = true
  }

  #removeListener() {
    if (!this.#listening || !this.#element || !this.#eventName || !this.#listener) {
      return
    }
    this.#element.removeEventListener(this.#eventName, this.#listener, this.#capture)
    this.#listening = false
  }
}

export const bindRuntimeEvent = directive(RuntimeEventBindingDirective)
