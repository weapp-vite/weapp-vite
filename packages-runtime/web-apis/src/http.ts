import type { URLPolyfill } from './url'
import { isUrlInstance } from './constructors'
import {
  cloneArrayBuffer,
  cloneArrayBufferView,
  decodeText,
  encodeText,
  normalizeHeaderName,
} from './shared'
import { FormDataPolyfill } from './web'

type HeaderTuple = readonly [string, string]
type HeaderRecord = Record<string, string>
const SET_COOKIE_HEADER_NAME = 'set-cookie'

function isIterableHeaders(input: unknown): input is Iterable<HeaderTuple> {
  return Boolean(input) && typeof (input as Iterable<HeaderTuple>)[Symbol.iterator] === 'function'
}

function isHeaderObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

export class HeadersPolyfill {
  private readonly store = new Map<string, { key: string, values: string[] }>()

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
    const normalized = normalizeHeaderName(key)
    if (!normalized) {
      return
    }

    const item = this.store.get(normalized)
    if (item) {
      item.values.push(String(value))
      return
    }

    this.store.set(normalized, {
      key,
      values: [String(value)],
    })
  }

  set(key: string, value: string) {
    const normalized = normalizeHeaderName(key)
    if (!normalized) {
      return
    }
    this.store.set(normalized, {
      key,
      values: [String(value)],
    })
  }

  get(key: string) {
    return this.store.get(normalizeHeaderName(key))?.values.join(', ') ?? null
  }

  getSetCookie() {
    return this.store.get(SET_COOKIE_HEADER_NAME)?.values.slice() ?? []
  }

  has(key: string) {
    return this.store.has(normalizeHeaderName(key))
  }

  delete(key: string) {
    this.store.delete(normalizeHeaderName(key))
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const { key, values } of this.store.values()) {
      callback(values.join(', '), key)
    }
  }

  entries() {
    return Array.from(this.store.values(), item => [item.key, item.values.join(', ')] as [string, string])[Symbol.iterator]()
  }

  keys() {
    return Array.from(this.store.values(), item => item.key)[Symbol.iterator]()
  }

  values() {
    return Array.from(this.store.values(), item => item.values.join(', '))[Symbol.iterator]()
  }

  [Symbol.iterator]() {
    return this.entries()
  }
}

type RequestBodyLike = string | ArrayBuffer | ArrayBufferView | Blob | FormData | FormDataPolyfill | null | undefined
const requestBodyStore = new WeakMap<RequestPolyfill, RequestBodyLike>()
const requestBodyUsedStore = new WeakMap<RequestPolyfill, boolean>()
const responseBodyStore = new WeakMap<ResponsePolyfill, RequestBodyLike>()
const responseBodyUsedStore = new WeakMap<ResponsePolyfill, boolean>()

function normalizeBody(body: unknown): RequestBodyLike {
  if (body == null || typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body as RequestBodyLike
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return body
  }
  if (body instanceof FormDataPolyfill) {
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

export function getRequestBodyValue(request?: RequestPolyfill) {
  return request ? requestBodyStore.get(request) : undefined
}

function getResponseBodyValue(response: ResponsePolyfill) {
  return responseBodyStore.get(response)
}

export class RequestPolyfill {
  readonly url: string
  readonly method: string
  readonly headers: HeadersPolyfill
  readonly signal: AbortSignal | null
  readonly [Symbol.toStringTag] = 'Request'

  constructor(input: string | URL | URLPolyfill | RequestPolyfill, init: Record<string, any> = {}) {
    const request = input instanceof RequestPolyfill ? input : undefined
    this.url = typeof input === 'string'
      ? input
      : isUrlInstance(input)
        ? input.toString()
        : request?.url ?? ''
    this.method = String(init.method ?? request?.method ?? 'GET').toUpperCase()
    this.headers = new HeadersPolyfill(init.headers ?? request?.headers)
    this.signal = init.signal ?? request?.signal ?? null
    requestBodyStore.set(this, normalizeBody(init.body ?? getRequestBodyValue(request)))
    requestBodyUsedStore.set(this, false)
  }

  get body(): ReadableStream<Uint8Array> | null {
    return null
  }

  get bodyUsed() {
    return requestBodyUsedStore.get(this) === true
  }

  async arrayBuffer() {
    requestBodyUsedStore.set(this, true)
    return readBodyAsArrayBuffer(getRequestBodyValue(this))
  }

  async text() {
    requestBodyUsedStore.set(this, true)
    return readBodyAsText(getRequestBodyValue(this))
  }

  clone() {
    return new RequestPolyfill(this.url, {
      method: this.method,
      headers: this.headers,
      signal: this.signal,
      body: getRequestBodyValue(this),
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
  readonly type: ResponseType
  readonly [Symbol.toStringTag] = 'Response'

  constructor(body?: RequestBodyLike, init: Record<string, any> = {}) {
    responseBodyStore.set(this, normalizeBody(body))
    responseBodyUsedStore.set(this, false)
    this.status = Number.isFinite(init.status) ? init.status : 200
    this.statusText = init.statusText ?? ''
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new HeadersPolyfill(init.headers)
    this.url = init.url ?? ''
    this.type = init.type ?? 'basic'
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

  get body(): ReadableStream<Uint8Array> | null {
    return null
  }

  get bodyUsed() {
    return responseBodyUsedStore.get(this) === true
  }

  async arrayBuffer() {
    responseBodyUsedStore.set(this, true)
    return readBodyAsArrayBuffer(getResponseBodyValue(this))
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
    responseBodyUsedStore.set(this, true)
    return readBodyAsText(getResponseBodyValue(this))
  }

  clone() {
    return new ResponsePolyfill(getResponseBodyValue(this), {
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
