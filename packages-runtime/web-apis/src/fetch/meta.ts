import type { WeapiMiniProgramRequestMethod } from '@wevu/api'
import type { RequestGlobalsMiniProgramOptions } from '../networkDefaults'
import type { URLPolyfill } from '../url'
import { isUrlInstance, isUrlSearchParamsInstance } from '../constructors'
import { RequestPolyfill } from '../http'
import { consumeBodyValue, isReadableBodyStream, isStreamingRequestBody, readBodyStream } from '../http/body'
import { createMultipartBoundary, encodeMultipartFormData } from '../multipart'
import { resolveRequestMiniProgramOptions } from '../networkDefaults'
import { cloneArrayBuffer, cloneArrayBufferView, isArrayBufferLike, isBlobLike, normalizeHeaderName } from '../shared'
import { FormDataPolyfill } from '../web'
import { abortable, requestAbortReason } from './abort'

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
  miniProgram?: RequestGlobalsMiniProgramOptions
  miniprogram?: RequestGlobalsMiniProgramOptions
  [key: string]: unknown
}

declare global {
  interface RequestInit {
    miniProgram?: RequestGlobalsMiniProgramOptions
    miniprogram?: RequestGlobalsMiniProgramOptions
  }
}

export type RequestGlobalsFetchInput = string | URL | URLPolyfill | RequestLikeInput
type MiniProgramRequestMethod = WeapiMiniProgramRequestMethod

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

  if (typeof (source as Iterable<HeaderPair>)[Symbol.iterator] === 'function') {
    for (const entry of source as Iterable<HeaderPair>) {
      if (!entry || entry.length < 2) {
        continue
      }
      setHeader(target, entry[0], entry[1])
    }
    return
  }

  if (typeof (source as HeaderLike).forEach === 'function') {
    ;(source as HeaderLike).forEach((value, key) => {
      setHeader(target, key, value)
    })
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

export function toHeaderMap(source?: unknown) {
  const headers: HeaderMap = {}
  mergeHeaderSource(headers, source)
  return headers
}

function isRequestLikeInput(input: unknown): input is RequestLikeInput {
  return isObject(input) && typeof input.url === 'string'
}

function isFormDataInstance(value: unknown): value is FormData {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      (typeof FormData !== 'undefined' && value instanceof FormData)
      || value instanceof FormDataPolyfill
    ),
  )
}

async function extractRequestBodyFromInput(input: RequestLikeInput | undefined, signal?: AbortSignal | null) {
  if (!input || typeof input.clone !== 'function') {
    return undefined
  }
  if (input.bodyUsed) {
    throw new TypeError('Failed to execute fetch: request body is already used')
  }
  if (input instanceof RequestPolyfill) {
    if (isStreamingRequestBody(input)) {
      throw new TypeError('Streaming request uploads are not supported')
    }
    const value = consumeBodyValue(input)
    return isReadableBodyStream(value) ? readBodyStream(value, signal) : value
  }
  const body = input as RequestLikeInput & { body?: unknown, arrayBuffer?: () => Promise<ArrayBuffer>, text?: () => Promise<string> }
  if (isReadableBodyStream(body.body)) {
    return readBodyStream(body.body, signal)
  }
  if (body.arrayBuffer) {
    return body.arrayBuffer()
  }
  if (body.text) {
    return body.text()
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
  if (typeof (body as { getReader?: unknown }).getReader === 'function') {
    throw new TypeError('Streaming request uploads are not supported')
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
  if (isArrayBufferLike(body)) {
    return cloneArrayBuffer(body)
  }
  if (ArrayBuffer.isView(body)) {
    return cloneArrayBufferView(body)
  }
  if (isBlobLike(body)) {
    if (body.type && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = body.type
    }
    return body.arrayBuffer()
  }
  if (isFormDataInstance(body)) {
    const contentTypeKey = Object.keys(headers).find(key => normalizeHeaderName(key) === 'content-type')
    const payload = await encodeMultipartFormData(body, createMultipartBoundary(contentTypeKey ? headers[contentTypeKey] : undefined))
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = payload.contentType
    }
    return payload.body
  }
  return String(body)
}

export async function resolveRequestMeta(input: RequestGlobalsFetchInput, init: RequestGlobalsFetchInit = {}) {
  const requestInput = isRequestLikeInput(input) ? input : undefined
  const signal = init.signal ?? requestInput?.signal ?? null
  if (signal?.aborted) {
    throw requestAbortReason(signal)
  }
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
    : await abortable(extractRequestBodyFromInput(requestInput, signal), signal)

  if (!hasBodyInInit && requestInput && (method === 'GET' || method === 'HEAD')) {
    rawBody = undefined
  }

  if ((method === 'GET' || method === 'HEAD') && rawBody != null) {
    throw new TypeError('Failed to execute fetch: GET/HEAD request cannot have body')
  }

  return {
    miniProgram: resolveRequestMiniProgramOptions(init.miniProgram, init.miniprogram),
    url,
    method,
    headers,
    body: await abortable(normalizeRequestBody(rawBody, headers), signal),
    signal,
  }
}
