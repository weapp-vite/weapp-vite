import type { RequestBodyLike } from './body'
import { assertBodyUnused, getBodyValue, HttpBody, initializeBody } from './body'
import { HeadersPolyfill } from './headers'

export class ResponsePolyfill extends HttpBody {
  readonly headers: HeadersPolyfill
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly url: string
  readonly redirected = false
  readonly type: ResponseType
  readonly [Symbol.toStringTag] = 'Response'

  constructor(body?: RequestBodyLike, init: Record<string, any> = {}) {
    super()
    this.status = Number.isFinite(init.status) ? init.status : 200
    this.statusText = init.statusText ?? ''
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new HeadersPolyfill(init.headers)
    this.url = init.url ?? ''
    this.type = init.type ?? 'basic'
    initializeBody(this, body)
  }

  static error() {
    return new ResponsePolyfill(null, {
      status: 0,
      type: 'error',
    })
  }

  static json(data: unknown, init: Record<string, any> = {}) {
    const body = JSON.stringify(data)
    if (body === undefined) {
      throw new TypeError('Failed to execute \'json\' on \'Response\': data is not JSON serializable')
    }

    const headers = new HeadersPolyfill(init.headers)
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    return new ResponsePolyfill(body, {
      ...init,
      headers,
    })
  }

  clone() {
    assertBodyUnused(this)
    return new ResponsePolyfill(getBodyValue(this), {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      url: this.url,
      type: this.type,
    })
  }
}
