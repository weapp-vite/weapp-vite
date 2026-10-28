import { AbortControllerPolyfill } from './abort'
import { EventSourceEvent, EventSourceEventTarget, MessageEventPolyfill } from './eventsource/events'
import { EventStreamParser } from './eventsource/parser'
import { fetch } from './fetch'
import { TextDecoderPolyfill } from './textCodec'
import { URLPolyfill } from './url'

export { MessageEventPolyfill } from './eventsource/events'

function notSupported(message: string) {
  const error = new Error(message)
  error.name = 'NotSupportedError'
  return error
}

function event(type: string) {
  return new EventSourceEvent(type) as unknown as Event
}

/** 以标准 Fetch 响应流实现 EventSource；宿主缺失流式元数据时明确失败。 */
export class EventSourcePolyfill extends EventSourceEventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSED = 2
  readonly url: string
  readonly withCredentials = false
  readonly [Symbol.toStringTag] = 'EventSource'
  onopen: ((this: EventSourcePolyfill, event: Event) => unknown) | null = null
  onmessage: ((this: EventSourcePolyfill, event: MessageEvent<string>) => unknown) | null = null
  onerror: ((this: EventSourcePolyfill, event: Event) => unknown) | null = null
  private state = EventSourcePolyfill.CONNECTING
  private generation = 0
  private lastEventId = ''
  private retryDelay = 3000
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortControllerPolyfill | undefined

  constructor(url: string | URL, init: EventSourceInit = {}) {
    super()
    if (init.withCredentials) {
      throw notSupported('EventSource withCredentials is not supported by this mini-program transport')
    }
    const base = (globalThis as typeof globalThis & { location?: { href?: string } }).location?.href
    this.url = new URLPolyfill(String(url), base).href
    void Promise.resolve().then(() => this.connect())
  }

  get readyState() {
    return this.state
  }

  close() {
    this.state = EventSourcePolyfill.CLOSED
    this.generation++
    clearTimeout(this.retryTimer)
    this.retryTimer = undefined
    this.controller?.abort()
    this.controller = undefined
  }

  private isActive(generation: number) {
    return this.generation === generation && this.state !== EventSourcePolyfill.CLOSED
  }

  private failConnection() {
    this.close()
    this.dispatchEvent(event('error'))
  }

  private reconnect(generation: number) {
    if (!this.isActive(generation)) {
      return
    }
    this.state = EventSourcePolyfill.CONNECTING
    this.dispatchEvent(event('error'))
    if (this.isActive(generation)) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined
        void this.connect()
      }, this.retryDelay)
    }
  }

  private async connect() {
    if (this.state === EventSourcePolyfill.CLOSED) {
      return
    }
    const generation = ++this.generation
    const controller = new AbortControllerPolyfill()
    this.controller = controller
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' }
      if (this.lastEventId) {
        headers['Last-Event-ID'] = this.lastEventId
      }
      const response = await fetch(this.url, {
        headers,
        signal: controller.signal as unknown as AbortSignal,
        miniProgram: { enableChunked: true },
      })
      if (!this.isActive(generation)) {
        await response.body?.cancel()
        return
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
      if (response.status !== 200 || contentType !== 'text/event-stream' || !response.body) {
        this.failConnection()
        return
      }

      const origin = new URLPolyfill(response.url || this.url).origin
      const parser = new EventStreamParser({
        onEvent: (message) => {
          if (this.isActive(generation)) {
            this.dispatchEvent(new MessageEventPolyfill(message.type, { ...message, origin }) as unknown as Event)
          }
        },
        onId: (id) => { this.lastEventId = id },
        onRetry: (delay) => { this.retryDelay = delay },
      }, this.lastEventId)
      const decoder = new TextDecoderPolyfill('utf-8', { ignoreBOM: true })
      reader = response.body.getReader()
      this.state = EventSourcePolyfill.OPEN
      this.dispatchEvent(event('open'))
      while (this.isActive(generation)) {
        const chunk = await reader.read()
        if (chunk.done) {
          parser.feed(decoder.decode())
          break
        }
        parser.feed(decoder.decode(chunk.value, { stream: true }))
      }
      this.reconnect(generation)
    }
    catch (error) {
      if (!this.isActive(generation)) {
        return
      }
      if (error instanceof Error && error.name === 'NotSupportedError') {
        this.failConnection()
      }
      else {
        this.reconnect(generation)
      }
    }
    finally {
      reader?.releaseLock()
      if (this.controller === controller) {
        this.controller = undefined
      }
    }
  }
}

export { EventSourcePolyfill as EventSource }
