interface EventInitPolyfill {
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
}

interface CustomEventInitPolyfill<T = any> extends EventInitPolyfill {
  detail?: T
}

export class EventPolyfill {
  readonly bubbles: boolean
  readonly cancelable: boolean
  readonly composed: boolean
  readonly isTrusted = false
  readonly timeStamp = Date.now()
  readonly type: string
  currentTarget: unknown = null
  target: unknown = null
  defaultPrevented = false
  cancelBubble = false

  constructor(type: string, init: EventInitPolyfill = {}) {
    this.type = String(type)
    this.bubbles = init.bubbles === true
    this.cancelable = init.cancelable === true
    this.composed = init.composed === true
  }

  composedPath() {
    return this.target == null ? [] : [this.target]
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true
    }
  }

  stopImmediatePropagation() {
    this.cancelBubble = true
  }

  stopPropagation() {
    this.cancelBubble = true
  }
}

export class CustomEventPolyfill<T = any> extends EventPolyfill {
  readonly detail: T | null

  constructor(type: string, init: CustomEventInitPolyfill<T> = {}) {
    super(type, init)
    this.detail = init.detail ?? null
  }
}
