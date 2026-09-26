import type { URLPolyfill } from '../url'
import { isUrlInstance } from '../constructors'
import { assertBodyUnused, consumeBodyValue, getBodyValue, HttpBody, initializeBody } from './body'
import { HeadersPolyfill } from './headers'

export class RequestPolyfill extends HttpBody {
  readonly url: string
  readonly method: string
  readonly headers: HeadersPolyfill
  readonly signal: AbortSignal | null
  readonly [Symbol.toStringTag] = 'Request'

  constructor(input: string | URL | URLPolyfill | RequestPolyfill, init: Record<string, any> = {}) {
    super()
    const request = input instanceof RequestPolyfill ? input : undefined
    this.url = typeof input === 'string'
      ? input
      : isUrlInstance(input)
        ? input.toString()
        : request?.url ?? ''
    this.method = String(init.method ?? request?.method ?? 'GET').toUpperCase()
    this.headers = new HeadersPolyfill(init.headers ?? request?.headers)
    this.signal = init.signal ?? request?.signal ?? null
    const inherited = init.body == null && request
    if (inherited) {
      assertBodyUnused(request)
    }
    initializeBody(this, init.body ?? (request ? getBodyValue(request) : undefined))
    if (inherited) {
      consumeBodyValue(request)
    }
  }

  clone() {
    assertBodyUnused(this)
    return new RequestPolyfill(this.url, {
      method: this.method,
      headers: this.headers,
      signal: this.signal,
      body: getBodyValue(this),
    })
  }
}

export function getRequestBodyValue(request?: RequestPolyfill) {
  return request ? getBodyValue(request) : undefined
}
