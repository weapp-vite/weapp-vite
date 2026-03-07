import { wpi } from '@wevu/api'

type HeaderPair = readonly [string, string]
type HeaderMap = Record<string, string>

interface HeaderLike {
  forEach: (callback: (value: string, key: string) => void) => void
}

export interface WevuFetchInit {
  method?: string
  headers?: unknown
  body?: unknown
  signal?: AbortSignal | null
  [key: string]: unknown
}

interface RequestLikeInput {
  url: string
  method?: string
  headers?: unknown
  signal?: AbortSignal | null
  bodyUsed?: boolean
  clone?: () => {
    arrayBuffer?: () => Promise<ArrayBuffer>
    text?: () => Promise<string>
  }
}

type WevuFetchInput = string | URL | RequestLikeInput
type WxRequestMethod = NonNullable<WechatMiniprogram.RequestOption['method']>

const hasOwn = Object.prototype.hasOwnProperty
const REQUEST_METHODS: ReadonlyArray<WxRequestMethod> = [
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function normalizeMethod(method?: string): WxRequestMethod {
  const normalized = (method ?? 'GET').toUpperCase()
  if (REQUEST_METHODS.includes(normalized as WxRequestMethod)) {
    return normalized as WxRequestMethod
  }
  return 'GET'
}

function setHeader(target: HeaderMap, key: string, value: unknown) {
  const headerName = key.trim()
  if (!headerName) {
    return
  }
  const normalizedValue = String(value)
  for (const existingKey of Object.keys(target)) {
    if (existingKey.toLowerCase() === headerName.toLowerCase() && existingKey !== headerName) {
      delete target[existingKey]
      break
    }
  }
  target[headerName] = normalizedValue
}

function hasHeader(target: HeaderMap, key: string) {
  const normalized = key.toLowerCase()
  return Object.keys(target).some(item => item.toLowerCase() === normalized)
}

function mergeHeaderSource(target: HeaderMap, source: unknown) {
  if (!source) {
    return
  }
  if (typeof (source as HeaderLike).forEach === 'function') {
    ;(source as HeaderLike).forEach((value, key) => {
      setHeader(target, key, value)
    })
    return
  }
  if (typeof (source as Iterable<HeaderPair>)[Symbol.iterator] === 'function') {
    for (const item of source as Iterable<HeaderPair>) {
      if (!item || item.length < 2) {
        continue
      }
      setHeader(target, item[0], item[1])
    }
    return
  }
  if (isObject(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        setHeader(target, key, value.join(', '))
        continue
      }
      setHeader(target, key, value)
    }
  }
}

function toHeaderMap(source?: unknown) {
  const headers: HeaderMap = {}
  mergeHeaderSource(headers, source)
  return headers
}

function encodeText(text: string) {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(text).buffer
  }
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xFF
  }
  return bytes.buffer
}

function decodeText(buffer: ArrayBuffer) {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder().decode(buffer)
  }
  const view = new Uint8Array(buffer)
  let text = ''
  for (const byte of view) {
    text += String.fromCharCode(byte)
  }
  return text
}

function cloneBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

function cloneViewBuffer(view: ArrayBufferView) {
  const copied = new Uint8Array(view.byteLength)
  copied.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  return copied.buffer
}

function isRequestLikeInput(input: unknown): input is RequestLikeInput {
  return isObject(input) && typeof input.url === 'string'
}

async function extractRequestBodyFromInput(input: RequestLikeInput | undefined) {
  if (!input || typeof input.clone !== 'function') {
    return undefined
  }
  if (input.bodyUsed) {
    throw new TypeError('Failed to execute fetch: request body is already used')
  }
  const cloned = input.clone()
  if (cloned?.arrayBuffer) {
    return cloned.arrayBuffer()
  }
  if (cloned?.text) {
    return cloned.text()
  }
  return undefined
}

async function normalizeRequestBody(body: unknown, headers: HeaderMap) {
  if (body == null) {
    return undefined
  }
  if (typeof body === 'string') {
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'text/plain;charset=UTF-8'
    }
    return body
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    return body.toString()
  }
  if (body instanceof ArrayBuffer) {
    return cloneBuffer(body)
  }
  if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView
    return cloneViewBuffer(view)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    if (body.type && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = body.type
    }
    return body.arrayBuffer()
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    throw new TypeError('Failed to execute fetch: FormData body is not supported in wevu/fetch')
  }
  return String(body)
}

async function resolveRequestMeta(input: WevuFetchInput, init: WevuFetchInit = {}) {
  const requestInput = isRequestLikeInput(input) ? input : undefined
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : requestInput?.url
  if (!url) {
    throw new TypeError('Failed to execute fetch: invalid request url')
  }

  const method = normalizeMethod(init.method ?? requestInput?.method)
  const headers = toHeaderMap(requestInput?.headers)
  mergeHeaderSource(headers, init.headers)

  const hasBodyInInit = hasOwn.call(init, 'body')
  const rawBody = hasBodyInInit
    ? init.body
    : await extractRequestBodyFromInput(requestInput)
  if ((method === 'GET' || method === 'HEAD') && rawBody != null) {
    throw new TypeError('Failed to execute fetch: GET/HEAD request cannot have body')
  }

  return {
    url,
    method,
    headers,
    body: await normalizeRequestBody(rawBody, headers),
    signal: init.signal ?? requestInput?.signal ?? null,
  }
}

function readResponseDataAsArrayBuffer(data: unknown): Promise<ArrayBuffer> {
  if (data == null) {
    return Promise.resolve(new ArrayBuffer(0))
  }
  if (data instanceof ArrayBuffer) {
    return Promise.resolve(cloneBuffer(data))
  }
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return Promise.resolve(cloneViewBuffer(view))
  }
  if (typeof data === 'string') {
    return Promise.resolve(encodeText(data))
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.arrayBuffer()
  }
  return Promise.resolve(encodeText(JSON.stringify(data)))
}

class WevuHeadersFallback {
  private readonly store = new Map<string, { key: string, value: string }>()

  constructor(init?: HeaderMap) {
    if (!init) {
      return
    }
    for (const [key, value] of Object.entries(init)) {
      this.set(key, value)
    }
  }

  append(key: string, value: string) {
    const current = this.get(key)
    if (!current) {
      this.set(key, value)
      return
    }
    this.set(key, `${current}, ${value}`)
  }

  set(key: string, value: string) {
    const normalized = key.toLowerCase()
    this.store.set(normalized, { key, value })
  }

  get(key: string) {
    return this.store.get(key.toLowerCase())?.value ?? null
  }

  has(key: string) {
    return this.store.has(key.toLowerCase())
  }

  delete(key: string) {
    this.store.delete(key.toLowerCase())
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const item of this.store.values()) {
      callback(item.value, item.key)
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

type HeadersContainer = Headers | WevuHeadersFallback

function createHeadersContainer(headers: HeaderMap): HeadersContainer {
  if (typeof Headers === 'function') {
    return new Headers(headers)
  }
  return new WevuHeadersFallback(headers)
}

function cloneHeadersToMap(headers: HeadersContainer) {
  const result: HeaderMap = {}
  headers.forEach((value, key) => {
    setHeader(result, key, value)
  })
  return result
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

function createFetchResponse(data: unknown, status: number, headers: HeaderMap, url: string): Response {
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

function isRequestTask(value: unknown): value is WechatMiniprogram.RequestTask {
  return isObject(value) && typeof value.abort === 'function'
}

/**
 * @description 使用 @wevu/api 的 request 能力实现 fetch 语义对齐
 */
export function fetch(input: WevuFetchInput, init?: WevuFetchInit): Promise<Response> {
  return resolveRequestMeta(input, init).then((meta) => {
    if (meta.signal?.aborted) {
      return Promise.reject(createAbortError())
    }

    return new Promise<Response>((resolve, reject) => {
      let settled = false
      let aborted = false
      const onAbort = () => {
        if (settled) {
          return
        }
        aborted = true
        requestTask?.abort()
        settled = true
        reject(createAbortError())
      }

      if (meta.signal) {
        meta.signal.addEventListener('abort', onAbort, { once: true })
      }

      const cleanup = () => {
        if (meta.signal) {
          meta.signal.removeEventListener('abort', onAbort)
        }
      }

      const requestResult = wpi.request({
        url: meta.url,
        method: meta.method,
        header: meta.headers,
        data: meta.body,
        responseType: 'arraybuffer',
        success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          resolve(createFetchResponse(res.data, res.statusCode, toHeaderMap(res.header), meta.url))
        },
        fail: (err: unknown) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          if (aborted) {
            reject(createAbortError())
            return
          }
          const message = isObject(err) && typeof err.errMsg === 'string'
            ? err.errMsg
            : String(err)
          reject(new TypeError(message))
        },
      })
      const requestTask = isRequestTask(requestResult) ? requestResult : undefined
    })
  })
}
