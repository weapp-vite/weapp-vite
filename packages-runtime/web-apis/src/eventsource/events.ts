import { EventPolyfill } from '../events'

/** 区分停止冒泡与停止同一目标上的后续监听。 */
export class EventSourceEvent extends EventPolyfill {
  immediatePropagationStopped = false

  override stopImmediatePropagation() {
    super.stopImmediatePropagation()
    this.immediatePropagationStopped = true
  }
}

/** 提供事件流消息需要的标准 MessageEvent 字段。 */
export class MessageEventPolyfill<T = unknown> extends EventSourceEvent {
  readonly data: T
  readonly origin: string
  readonly lastEventId: string
  readonly source = null
  readonly ports: MessagePort[] = []

  constructor(type: string, init: MessageEventInit<T> = {}) {
    super(type, init)
    this.data = init.data as T
    this.origin = init.origin ?? ''
    this.lastEventId = init.lastEventId ?? ''
  }
}

interface ListenerEntry {
  callback: EventListenerOrEventListenerObject
  capture: boolean
  once: boolean
  signal?: AbortSignal
  onAbort?: () => void
}

function reportListenerError(error: unknown) {
  const host = globalThis as typeof globalThis & { reportError?: (error: unknown) => void }
  if (typeof host.reportError === 'function') {
    host.reportError(error)
  }
  else {
    setTimeout(() => {
      throw error
    }, 0)
  }
}

/** 事件监听错误独立报告，避免把业务异常当作传输错误并触发重连。 */
export class EventSourceEventTarget {
  private readonly listeners = new Map<string, ListenerEntry[]>()

  addEventListener<K extends keyof EventSourceEventMap>(type: K, callback: ((event: EventSourceEventMap[K]) => void) | null, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options: boolean | AddEventListenerOptions = false) {
    if (!callback) {
      return
    }
    const capture = typeof options === 'boolean' ? options : options.capture === true
    const signal = typeof options === 'boolean' ? undefined : options.signal
    const listeners = this.listeners.get(type) ?? []
    if (signal?.aborted || listeners.some(entry => entry.callback === callback && entry.capture === capture)) {
      return
    }
    const entry: ListenerEntry = { callback, capture, once: typeof options === 'object' && options.once === true, signal }
    if (signal) {
      entry.onAbort = () => this.removeEventListener(type, callback, capture)
      signal.addEventListener('abort', entry.onAbort, { once: true })
    }
    listeners.push(entry)
    this.listeners.set(type, listeners)
  }

  removeEventListener<K extends keyof EventSourceEventMap>(type: K, callback: ((event: EventSourceEventMap[K]) => void) | null, options?: boolean | EventListenerOptions): void
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options: boolean | EventListenerOptions = false) {
    const capture = typeof options === 'boolean' ? options : options.capture === true
    const listeners = this.listeners.get(type)
    const index = listeners?.findIndex(entry => entry.callback === callback && entry.capture === capture) ?? -1
    if (listeners && index !== -1) {
      const [entry] = listeners.splice(index, 1)
      if (entry?.onAbort) {
        entry.signal?.removeEventListener('abort', entry.onAbort)
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    const payload = event as unknown as EventSourceEvent
    Object.defineProperties(payload, {
      target: { configurable: true, writable: true, value: this },
      currentTarget: { configurable: true, writable: true, value: this },
    })
    for (const entry of [...(this.listeners.get(event.type) ?? [])]) {
      if (!this.listeners.get(event.type)?.includes(entry)) {
        continue
      }
      if (entry.once) {
        this.removeEventListener(event.type, entry.callback, entry.capture)
      }
      this.invoke(() => {
        if (typeof entry.callback === 'function') {
          entry.callback.call(this, event)
        }
        else {
          entry.callback.handleEvent(event)
        }
      })
      if (payload.immediatePropagationStopped) {
        break
      }
    }
    if (!payload.immediatePropagationStopped) {
      const handler = (this as unknown as Record<string, unknown>)[`on${event.type}`]
      if (typeof handler === 'function') {
        this.invoke(() => handler.call(this, event))
      }
    }
    payload.currentTarget = null
    return !event.defaultPrevented
  }

  private invoke(callback: () => void) {
    try {
      callback()
    }
    catch (error) {
      reportListenerError(error)
    }
  }
}
