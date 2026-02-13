interface RequestParseOptions {
  responseType?: 'text' | 'arraybuffer'
  dataType?: 'json' | 'text'
}

export function getRuntimeFetch() {
  const runtime = globalThis as Record<string, unknown>
  const maybeFetch = runtime.fetch
  if (typeof maybeFetch === 'function') {
    return maybeFetch as typeof fetch
  }
  return undefined
}

export function normalizeRequestMethod(method?: string) {
  return (method || 'GET').toUpperCase()
}

export function normalizeRequestHeaders(header?: Record<string, string>) {
  if (!header) {
    return {}
  }
  return { ...header }
}

export function buildRequestUrl(url: string, method: string, data: unknown) {
  if (method !== 'GET' || data == null) {
    return url
  }
  if (typeof data === 'string') {
    if (!data) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${data}`
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    const query = data.toString()
    if (!query) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${query}`
  }
  if (typeof data === 'object') {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      query.append(key, value == null ? '' : String(value))
    }
    const queryText = query.toString()
    if (!queryText) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${queryText}`
  }
  return url
}

export function buildRequestBody(
  method: string,
  data: unknown,
  headers: Record<string, string>,
) {
  if (method === 'GET' || data == null) {
    return undefined
  }
  if (typeof data === 'string') {
    return data
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return data
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return data
  }
  const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type')
  const contentType = contentTypeKey ? headers[contentTypeKey] : ''
  if (contentType && !contentType.includes('application/json')) {
    return String(data)
  }
  if (!contentTypeKey) {
    headers['content-type'] = 'application/json'
  }
  return JSON.stringify(data)
}

export async function parseRequestResponseData(
  response: Response,
  options?: RequestParseOptions,
) {
  if (options?.responseType === 'arraybuffer') {
    return response.arrayBuffer()
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (options?.dataType === 'text') {
    return response.text()
  }
  if (options?.dataType === 'json' || contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export function createBlobObjectUrl(blob: Blob) {
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: Blob) => string
    }
  }).URL
  if (runtimeUrl && typeof runtimeUrl.createObjectURL === 'function') {
    return runtimeUrl.createObjectURL(blob)
  }
  return ''
}

export function collectResponseHeaders(response: {
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void
  }
}) {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  return headers
}

export function stripUploadContentType(headers: Record<string, string>) {
  const normalized = { ...headers }
  for (const key of Object.keys(normalized)) {
    if (key.toLowerCase() === 'content-type') {
      delete normalized[key]
    }
  }
  return normalized
}

type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'

interface NetworkStatusSnapshot {
  isConnected: boolean
  networkType: NetworkType
}

interface NavigatorConnection {
  type?: string
  effectiveType?: string
  addEventListener?: (type: string, listener: () => void) => void
}

export function getNavigatorConnection() {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    connection?: NavigatorConnection
    mozConnection?: NavigatorConnection
    webkitConnection?: NavigatorConnection
  }) | undefined
  return runtimeNavigator?.connection ?? runtimeNavigator?.mozConnection ?? runtimeNavigator?.webkitConnection
}

function resolveNetworkType(connection: NavigatorConnection | undefined, isConnected: boolean): NetworkType {
  if (!isConnected) {
    return 'none'
  }
  const type = typeof connection?.type === 'string' ? connection.type.toLowerCase() : ''
  const effectiveType = typeof connection?.effectiveType === 'string'
    ? connection.effectiveType.toLowerCase()
    : ''
  if (type.includes('wifi') || type.includes('ethernet')) {
    return 'wifi'
  }
  if (effectiveType.includes('5g')) {
    return '5g'
  }
  if (effectiveType.includes('4g')) {
    return '4g'
  }
  if (effectiveType.includes('3g')) {
    return '3g'
  }
  if (effectiveType.includes('2g') || effectiveType.includes('slow-2g')) {
    return '2g'
  }
  if (type.includes('cellular')) {
    return 'unknown'
  }
  return 'unknown'
}

export function readNetworkStatusSnapshot(): NetworkStatusSnapshot {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const isConnected = typeof runtimeNavigator?.onLine === 'boolean' ? runtimeNavigator.onLine : true
  const connection = getNavigatorConnection()
  return {
    isConnected,
    networkType: resolveNetworkType(connection, isConnected),
  }
}
