import type { HeadersContainer } from './headers'
import type { HeaderMap } from './types'
import { cloneHeadersToMap, createHeadersContainer, toHeaderMap } from './headers'
import { cloneBuffer, cloneViewBuffer, decodeText, encodeText, isObject } from './shared'

export function readResponseDataAsArrayBuffer(data: unknown): Promise<ArrayBuffer> {
  if (data == null) {
    return Promise.resolve(new ArrayBuffer(0))
  }
  if (data instanceof ArrayBuffer) {
    return Promise.resolve(cloneBuffer(data))
  }
  if (ArrayBuffer.isView(data)) {
    return Promise.resolve(cloneViewBuffer(data as ArrayBufferView))
  }
  if (typeof data === 'string') {
    return Promise.resolve(encodeText(data))
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.arrayBuffer()
  }
  return Promise.resolve(encodeText(JSON.stringify(data)))
}

class WevuResponseFallback {
  private consumed = false
  private readonly responseData: unknown
  readonly headers: HeadersContainer
  readonly ok: boolean
  readonly redirected = false
  readonly status: number
  readonly statusText = ''
  readonly type: ResponseType = 'basic'
  readonly url: string
  readonly body: ReadableStream<Uint8Array> | null = null
  readonly [Symbol.toStringTag] = 'Response'

  constructor(
    data: unknown,
    options: { headers: HeaderMap, status: number, url: string },
  ) {
    this.responseData = data
    this.status = options.status
    this.url = options.url
    this.ok = this.status >= 200 && this.status < 300
    this.headers = createHeadersContainer(options.headers)
  }

  get bodyUsed() {
    return this.consumed
  }

  private consumeBody<T>(reader: () => Promise<T>) {
    if (this.consumed) {
      return Promise.reject(new TypeError('Failed to execute fetch: body stream already read'))
    }
    this.consumed = true
    return reader()
  }

  arrayBuffer() {
    return this.consumeBody(() => readResponseDataAsArrayBuffer(this.responseData))
  }

  blob() {
    return this.consumeBody(async () => {
      if (typeof Blob !== 'function') {
        throw new TypeError('Blob is unavailable in current runtime')
      }
      const arrayBuffer = await readResponseDataAsArrayBuffer(this.responseData)
      return new Blob([arrayBuffer])
    })
  }

  formData() {
    return this.consumeBody(async () => {
      throw new TypeError('formData is not supported in wevu/fetch response fallback')
    })
  }

  json() {
    return this.consumeBody(async () => {
      if (isObject(this.responseData) || Array.isArray(this.responseData)) {
        return this.responseData
      }
      const text = await this.textFromRaw()
      return JSON.parse(text)
    })
  }

  text() {
    return this.consumeBody(() => this.textFromRaw())
  }

  clone() {
    return new WevuResponseFallback(this.responseData, {
      headers: cloneHeadersToMap(this.headers),
      status: this.status,
      url: this.url,
    }) as unknown as Response
  }

  private async textFromRaw() {
    if (typeof this.responseData === 'string') {
      return this.responseData
    }
    const arrayBuffer = await readResponseDataAsArrayBuffer(this.responseData)
    return decodeText(arrayBuffer)
  }
}

export function createFetchResponse(data: unknown, status: number, headers: HeaderMap, url: string): Response {
  if (typeof Response === 'function') {
    const nativeBody: BodyInit | null
      = typeof data === 'string'
        ? data
        : data instanceof ArrayBuffer
          ? data
          : ArrayBuffer.isView(data)
            ? cloneViewBuffer(data as ArrayBufferView)
            : JSON.stringify(data ?? '')
    const normalizedStatus = Number.isFinite(status) && status >= 200 && status <= 599 ? status : 200
    try {
      return new Response(nativeBody, {
        status: normalizedStatus,
        headers,
      })
    }
    catch {
      // ignore and use fallback
    }
  }
  return new WevuResponseFallback(data, {
    headers,
    status,
    url,
  }) as unknown as Response
}

export function normalizeResponseHeaders(headers: unknown) {
  return toHeaderMap(headers)
}
