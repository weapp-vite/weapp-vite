import type { HeaderMap, RequestLikeInput, WevuFetchInit, WevuFetchInput } from './types'
import { hasHeader, mergeHeaderSource, normalizeMethod, toHeaderMap } from './headers'
import { cloneBuffer, cloneViewBuffer, hasOwn, isRequestLikeInput } from './shared'

export async function extractRequestBodyFromInput(input: RequestLikeInput | undefined) {
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

export async function normalizeRequestBody(body: unknown, headers: HeaderMap) {
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
    return cloneViewBuffer(body as ArrayBufferView)
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

export async function resolveRequestMeta(input: WevuFetchInput, init: WevuFetchInit = {}) {
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
