import type {
  HeadlessSession,
  HeadlessWxRequestOption,
  HeadlessWxRequestSuccessResult,
  HeadlessWxRequestTask,
} from '../../mpcore/packages/simulator/src'
import { URL } from 'node:url'

const QUERY_ITEM_PATH_RE = /^\/query\/items\/[^/]+$/

interface QueryRequestOption extends HeadlessWxRequestOption {
  dataType?: string
  responseType?: string
}

function resolveQueryOrigin(baseUrl: string) {
  const url = new URL(baseUrl)
  const port = Number(url.port)
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || !Number.isInteger(port)
    || port <= 0
    || port > 65_535
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error(`Query request transport requires an exact dynamic loopback origin: ${baseUrl}`)
  }
  return url.origin
}

function isQueryRequestUrl(value: string, origin: string) {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return false
  }
  return url.origin === origin
    && url.username === ''
    && url.password === ''
    && (url.pathname === '/query/items' || QUERY_ITEM_PATH_RE.test(url.pathname))
}

function createRequestBody(data: unknown, method: string, headers: Headers) {
  if (data == null || method === 'GET' || method === 'HEAD') {
    return undefined
  }
  if (typeof data === 'string') {
    return data
  }
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return JSON.stringify(data)
}

async function readResponseData(response: Response, option: QueryRequestOption) {
  if (option.responseType === 'arraybuffer') {
    return await response.arrayBuffer()
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (option.dataType === 'json' || contentType.includes('/json') || contentType.includes('+json')) {
    return await response.json()
  }
  return await response.text()
}

function readResponseCookies(headers: Headers) {
  const cookieHeaders = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof cookieHeaders.getSetCookie === 'function') {
    return cookieHeaders.getSetCookie()
  }
  const cookie = headers.get('set-cookie')
  return cookie == null ? [] : [cookie]
}

function normalizeRequestError(error: unknown) {
  if (error instanceof Error && error.message.startsWith('request:fail')) {
    return error
  }
  const detail = error instanceof Error ? error.message : String(error)
  return new Error(`request:fail ${detail}`, { cause: error })
}

/** 为查询端到端用例安装仅允许指定回环源和查询路径的真实请求传输。 */
export function installQueryRequestTransport(session: HeadlessSession, baseUrl: string) {
  const origin = resolveQueryOrigin(baseUrl)
  const wx = session.getWx()
  const originalRequest = wx.request
  const pendingRequests = new Set<HeadlessWxRequestTask>()
  let disposed = false

  const request = (option: QueryRequestOption): HeadlessWxRequestTask => {
    if (disposed || !isQueryRequestUrl(option.url, origin)) {
      return originalRequest.call(wx, option)
    }

    const controller = new AbortController()
    let settled = false
    const settleFailure = (error: Error, task: HeadlessWxRequestTask) => {
      if (settled) {
        return
      }
      settled = true
      pendingRequests.delete(task)
      try {
        option.fail?.(error)
      }
      finally {
        option.complete?.()
      }
    }
    const pendingRequest: HeadlessWxRequestTask = {
      abort() {
        if (settled) {
          return
        }
        controller.abort()
        settleFailure(new Error('request:fail abort'), pendingRequest)
      },
    }
    const settleSuccess = (result: HeadlessWxRequestSuccessResult) => {
      if (settled) {
        return
      }
      settled = true
      pendingRequests.delete(pendingRequest)
      try {
        option.success?.(result)
      }
      finally {
        option.complete?.(result)
      }
    }

    pendingRequests.add(pendingRequest)
    try {
      const headers = new Headers(option.header)
      const method = option.method?.trim().toUpperCase() || 'GET'
      void fetch(option.url, {
        body: createRequestBody(option.data, method, headers),
        headers,
        method,
        redirect: 'manual',
        signal: controller.signal,
      }).then(async (response) => {
        if (response.status >= 300 && response.status < 400) {
          controller.abort()
          throw new Error(`request:fail redirect ${response.status}`)
        }
        const result: HeadlessWxRequestSuccessResult = {
          cookies: readResponseCookies(response.headers),
          data: await readResponseData(response, option),
          errMsg: 'request:ok',
          header: Object.fromEntries(response.headers.entries()),
          statusCode: response.status,
        }
        return result
      }).then(settleSuccess, error => settleFailure(normalizeRequestError(error), pendingRequest))
    }
    catch (error) {
      settleFailure(normalizeRequestError(error), pendingRequest)
    }

    return pendingRequest
  }

  wx.request = request
  return () => {
    if (disposed) {
      return
    }
    disposed = true
    wx.request = originalRequest
    let errors: unknown[] | undefined
    for (const pendingRequest of pendingRequests) {
      try {
        pendingRequest.abort()
      }
      catch (error) {
        (errors ??= []).push(error)
      }
    }
    if (errors) {
      throw new AggregateError(errors, 'Query request transport disposal callbacks failed')
    }
  }
}
