import {
  cloneArrayBuffer,
  cloneArrayBufferView,
  decodeText,
  encodeText,
  normalizeHeaderName,
} from './shared'

type HeaderTuple = readonly [string, string]
type HeaderRecord = Record<string, string>

function isIterableHeaders(input: unknown): input is Iterable<HeaderTuple> {
  return Boolean(input) && typeof (input as Iterable<HeaderTuple>)[Symbol.iterator] === 'function'
}

function isHeaderObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

function isNativeUrlInstance(value: unknown): value is URL {
  return typeof URL !== 'undefined' && value instanceof URL
}

export class HeadersPolyfill {
  private readonly store = new Map<string, { key: string, value: string }>()

  constructor(init?: unknown) {
    if (!init) {
      return
    }

    if (typeof (init as { forEach?: unknown }).forEach === 'function') {
      ;(init as { forEach: (callback: (value: string, key: string) => void) => void }).forEach((value, key) => {
        this.set(key, value)
      })
      return
    }

    if (isIterableHeaders(init)) {
      for (const [key, value] of init) {
        this.append(key, value)
      }
      return
    }

    if (isHeaderObject(init)) {
      for (const [key, value] of Object.entries(init)) {
        this.append(key, Array.isArray(value) ? value.join(', ') : String(value))
      }
    }
  }

  append(key: string, value: string) {
    const current = this.get(key)
    this.set(key, current ? `${current}, ${value}` : value)
  }

  set(key: string, value: string) {
    const normalized = normalizeHeaderName(key)
    if (!normalized) {
      return
    }
    this.store.set(normalized, {
      key,
      value: String(value),
    })
  }

  get(key: string) {
    return this.store.get(normalizeHeaderName(key))?.value ?? null
  }

  has(key: string) {
    return this.store.has(normalizeHeaderName(key))
  }

  delete(key: string) {
    this.store.delete(normalizeHeaderName(key))
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const { key, value } of this.store.values()) {
      callback(value, key)
    }
  }

  entries() {
    return Array.from(this.store.values(), item => [item.key, item.value] as [string, string])[Symbol.iterator]()
  }

  keys() {
    return Array.from(this.store.values(), item => item.key)[Symbol.iterator]()
  }

  values() {
    return Array.from(this.store.values(), item => item.value)[Symbol.iterator]()
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}

type RequestBodyLike = string | ArrayBuffer | ArrayBufferView | Blob | null | undefined

function normalizeBody(body: unknown): RequestBodyLike {
  if (body == null || typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body as RequestBodyLike
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body
  }
  return String(body)
}

async function readBodyAsArrayBuffer(body: RequestBodyLike): Promise<ArrayBuffer> {
  if (body == null) {
    return new ArrayBuffer(0)
  }
  if (typeof body === 'string') {
    return encodeText(body)
  }
  if (body instanceof ArrayBuffer) {
    return cloneArrayBuffer(body)
  }
  if (ArrayBuffer.isView(body)) {
    return cloneArrayBufferView(body)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body.arrayBuffer()
  }
  return encodeText(String(body))
}

async function readBodyAsText(body: RequestBodyLike) {
  if (typeof body === 'string') {
    return body
  }
  const buffer = await readBodyAsArrayBuffer(body)
  return decodeText(buffer)
}

export class RequestPolyfill {
  readonly url: string
  readonly method: string
  readonly headers: HeadersPolyfill
  readonly signal: AbortSignal | null
  readonly [Symbol.toStringTag] = 'Request'
  private readonly bodyValue: RequestBodyLike
  bodyUsed = false

  constructor(input: string | URL | RequestPolyfill, init: Record<string, any> = {}) {
    const request = input instanceof RequestPolyfill ? input : undefined
    this.url = typeof input === 'string'
      ? input
      : isNativeUrlInstance(input)
        ? input.toString()
        : request?.url ?? ''
    this.method = String(init.method ?? request?.method ?? 'GET').toUpperCase()
    this.headers = new HeadersPolyfill(init.headers ?? request?.headers)
    this.signal = init.signal ?? request?.signal ?? null
    this.bodyValue = normalizeBody(init.body ?? request?.bodyValue)
  }

  async arrayBuffer() {
    this.bodyUsed = true
    return readBodyAsArrayBuffer(this.bodyValue)
  }

  async text() {
    this.bodyUsed = true
    return readBodyAsText(this.bodyValue)
  }

  clone() {
    return new RequestPolyfill(this.url, {
      method: this.method,
      headers: this.headers,
      signal: this.signal,
      body: this.bodyValue,
    })
  }
}

export class ResponsePolyfill {
  readonly headers: HeadersPolyfill
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly url: string
  readonly redirected = false
  readonly type: ResponseType = 'basic'
  readonly body: ReadableStream<Uint8Array> | null = null
  readonly [Symbol.toStringTag] = 'Response'
  private readonly bodyValue: RequestBodyLike
  bodyUsed = false

  constructor(body?: RequestBodyLike, init: Record<string, any> = {}) {
    this.bodyValue = normalizeBody(body)
    this.status = Number.isFinite(init.status) ? init.status : 200
    this.statusText = init.statusText ?? ''
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new HeadersPolyfill(init.headers)
    this.url = init.url ?? ''
  }

  async arrayBuffer() {
    this.bodyUsed = true
    return readBodyAsArrayBuffer(this.bodyValue)
  }

  async blob() {
    if (typeof Blob !== 'function') {
      throw new TypeError('Blob is unavailable in current runtime')
    }
    return new Blob([await this.arrayBuffer()])
  }

  async formData() {
    throw new TypeError('formData is not supported in Response polyfill')
  }

  async json() {
    return JSON.parse(await this.text())
  }

  async text() {
    this.bodyUsed = true
    return readBodyAsText(this.bodyValue)
  }

  clone() {
    return new ResponsePolyfill(this.bodyValue, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      url: this.url,
    })
  }
}

export function headersToObject(headers: HeadersPolyfill | Headers) {
  const result: HeaderRecord = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}
