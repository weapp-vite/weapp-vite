import type { ElementPart, PartInfo } from 'lit/async-directive.js'
import { nothing } from 'lit'
import { AsyncDirective, directive, PartType } from 'lit/async-directive.js'
import { listenRuntimeEvent, nameRuntimeEventHandler, resolveRuntimeEventName } from './componentEvents'

interface RuntimeEventFlags {
  capture?: boolean
}

class RuntimeEventBindingDirective extends AsyncDirective {
  #capture = false
  #element?: Element
  #eventName?: string
  #logicalName?: string
  #listener?: EventListener
  #listening = false
  #dispose?: () => void
  #dispatch: EventListener = event => this.#listener?.call(this.#element, event)

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
    const logicalName = resolveRuntimeEventName(eventName, listener)
    if (
      part.element !== this.#element
      || eventName !== this.#eventName
      || logicalName !== this.#logicalName
      || capture !== this.#capture
    ) {
      this.#removeListener()
      this.#element = part.element
      this.#eventName = eventName
      this.#logicalName = logicalName
      this.#capture = capture
      this.#listener = listener
      this.#addListener()
    }
    else {
      // 重渲染只更新业务回调，不释放仍属于同一节点/事件的订阅与手势兴趣。
      this.#listener = listener
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
    this.#dispose = listenRuntimeEvent(this.#element, this.#eventName, nameRuntimeEventHandler(this.#dispatch, this.#logicalName!), this.#capture)
    this.#listening = true
  }

  #removeListener() {
    if (!this.#listening || !this.#element || !this.#eventName || !this.#listener) {
      return
    }
    this.#dispose?.()
    this.#dispose = undefined
    this.#listening = false
  }
}

export const bindRuntimeEvent = directive(RuntimeEventBindingDirective)
