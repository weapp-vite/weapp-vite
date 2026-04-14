import type { URLPolyfill } from './url'
import { wpi } from '@wevu/api'
import { isUrlInstance, isUrlSearchParamsInstance } from './constructors'
import { HeadersPolyfill, ResponsePolyfill } from './http'
import { cloneArrayBuffer, cloneArrayBufferView, normalizeHeaderName } from './shared'

type HeaderPair = readonly [string, string]
type HeaderMap = Record<string, string>
interface HeaderLike {
  forEach: (callback: (value: string, key: string) => void) => void
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

export interface RequestGlobalsFetchInit {
  method?: string
  headers?: unknown
  body?: unknown
  signal?: AbortSignal | null
  [key: string]: unknown
}

type RequestGlobalsFetchInput = string | URL | URLPolyfill | RequestLikeInput
type MiniProgramRequestMethod = NonNullable<WechatMiniprogram.RequestOption['method']>

const REQUEST_METHODS: ReadonlyArray<MiniProgramRequestMethod> = [
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
]

const hasOwn = Object.prototype.hasOwnProperty

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

function normalizeMethod(method?: string): MiniProgramRequestMethod {
  const normalized = (method ?? 'GET').toUpperCase()
  if (REQUEST_METHODS.includes(normalized as MiniProgramRequestMethod)) {
    return normalized as MiniProgramRequestMethod
  }
  return 'GET'
}

function setHeader(target: HeaderMap, key: string, value: unknown) {
  const normalizedKey = normalizeHeaderName(key)
  if (!normalizedKey) {
    return
  }

  const nextValue = String(value)
  for (const currentKey of Object.keys(target)) {
    if (normalizeHeaderName(currentKey) === normalizedKey) {
      delete target[currentKey]
    }
  }
  target[key] = nextValue
}

function hasHeader(target: HeaderMap, key: string) {
  const normalizedKey = normalizeHeaderName(key)
  return Object.keys(target).some(currentKey => normalizeHeaderName(currentKey) === normalizedKey)
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
    for (const entry of source as Iterable<HeaderPair>) {
      if (!entry || entry.length < 2) {
        continue
      }
      setHeader(target, entry[0], entry[1])
    }
    return
  }

  if (!isObject(source)) {
    return
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      setHeader(target, key, value.join(', '))
      continue
    }
    setHeader(target, key, value)
  }
}

function toHeaderMap(source?: unknown) {
  const headers: HeaderMap = {}
  mergeHeaderSource(headers, source)
  return headers
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
  if (isUrlSearchParamsInstance(body)) {
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    return body.toString()
  }
  if (body instanceof ArrayBuffer) {
    return cloneArrayBuffer(body)
  }
  if (ArrayBuffer.isView(body)) {
    return cloneArrayBufferView(body)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    if (body.type && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = body.type
    }
    return body.arrayBuffer()
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    throw new TypeError('Failed to execute fetch: FormData body is not supported in request globals fetch')
  }
  return String(body)
}

async function resolveRequestMeta(input: RequestGlobalsFetchInput, init: RequestGlobalsFetchInit = {}) {
  const requestInput = isRequestLikeInput(input) ? input : undefined
  const url = typeof input === 'string'
    ? input
    : isUrlInstance(input)
      ? input.toString()
      : requestInput?.url

  if (!url) {
    throw new TypeError('Failed to execute fetch: invalid request url')
  }

  const method = normalizeMethod(init.method ?? requestInput?.method)
  const headers = toHeaderMap(requestInput?.headers)
  mergeHeaderSource(headers, init.headers)

  const hasBodyInInit = hasOwn.call(init, 'body')
  let rawBody = hasBodyInInit
    ? init.body
    : await extractRequestBodyFromInput(requestInput)

  if (!hasBodyInInit && requestInput && (method === 'GET' || method === 'HEAD')) {
    rawBody = undefined
  }

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

function createFetchResponse(data: unknown, status: number, headers: HeaderMap, url: string): Response {
  return new ResponsePolyfill(data instanceof Uint8Array ? cloneArrayBufferView(data) : data as any, {
    status,
    headers: new HeadersPolyfill(headers),
    url,
  }) as unknown as Response
}

function isRequestTask(value: unknown): value is WechatMiniprogram.RequestTask {
  return isObject(value) && typeof value.abort === 'function'
}

/**
 * @description 使用 @wevu/api 的 request 能力实现 fetch 语义对齐。
 */
export function fetch(input: RequestGlobalsFetchInput, init?: RequestGlobalsFetchInit): Promise<Response> {
  return resolveRequestMeta(input, init).then((meta) => {
    if (meta.signal?.aborted) {
      return Promise.reject(createAbortError())
    }

    return new Promise<Response>((resolve, reject) => {
      let settled = false
      let aborted = false
      let requestTask: WechatMiniprogram.RequestTask | undefined

      function onAbort() {
        if (settled) {
          return
        }
        aborted = true
        requestTask?.abort()
        settled = true
        if (meta.signal) {
          meta.signal.removeEventListener('abort', onAbort)
        }
        reject(createAbortError())
      }

      function cleanup() {
        if (meta.signal) {
          meta.signal.removeEventListener('abort', onAbort)
        }
      }

      if (meta.signal) {
        meta.signal.addEventListener('abort', onAbort, { once: true })
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
        fail: (error: unknown) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          if (aborted) {
            reject(createAbortError())
            return
          }
          const message = isObject(error) && typeof error.errMsg === 'string'
            ? error.errMsg
            : String(error)
          reject(new TypeError(message))
        },
      })

      requestTask = isRequestTask(requestResult) ? requestResult : undefined
    })
  })
}
