import {
  normalizeFilePath,
  resolveUploadFileBlob,
  resolveUploadFileName,
} from '../files'

interface RequestParseOptions {
  responseType?: 'text' | 'arraybuffer'
  dataType?: 'json' | 'text'
}

interface RequestLikeOptions extends RequestParseOptions {
  url?: string
  method?: string
  header?: Record<string, string>
  data?: unknown
  timeout?: number
}

interface DownloadLikeOptions {
  url?: string
  header?: Record<string, string>
  timeout?: number
}

interface UploadLikeOptions {
  url?: string
  filePath?: string
  header?: Record<string, string>
  formData?: Record<string, unknown>
  name?: string
  timeout?: number
}

function resolveTimeoutSignal(timeout: number) {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined
  if (timeout > 0 && controller) {
    timeoutTimer = setTimeout(() => controller.abort(), timeout)
  }
  return {
    signal: controller?.signal,
    clear: () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
    },
  }
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

export async function performRequestByFetch(options?: RequestLikeOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    throw new TypeError('invalid url')
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    throw new TypeError('fetch is unavailable')
  }
  const method = normalizeRequestMethod(options?.method)
  const headers = normalizeRequestHeaders(options?.header)
  const requestUrl = buildRequestUrl(url, method, options?.data)
  const body = buildRequestBody(method, options?.data, headers)
  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  const timeoutControl = resolveTimeoutSignal(timeout)

  try {
    const response = await runtimeFetch(requestUrl, {
      method,
      headers,
      body,
      signal: timeoutControl.signal,
    })
    const responseData = await parseRequestResponseData(response, options)
    return {
      data: responseData,
      statusCode: response.status,
      header: collectResponseHeaders(response),
    }
  }
  finally {
    timeoutControl.clear()
  }
}

export async function performDownloadByFetch(options?: DownloadLikeOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    throw new TypeError('invalid url')
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    throw new TypeError('fetch is unavailable')
  }
  const headers = normalizeRequestHeaders(options?.header)
  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  const timeoutControl = resolveTimeoutSignal(timeout)

  try {
    const response = await runtimeFetch(url, {
      method: 'GET',
      headers,
      signal: timeoutControl.signal,
    })
    const blob = await response.blob()
    return {
      tempFilePath: createBlobObjectUrl(blob) || url,
      statusCode: response.status,
    }
  }
  finally {
    timeoutControl.clear()
  }
}

export async function performUploadByFetch(options?: UploadLikeOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    throw new TypeError('invalid url')
  }
  const filePath = normalizeFilePath(options?.filePath)
  if (!filePath) {
    throw new TypeError('invalid filePath')
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    throw new TypeError('fetch is unavailable')
  }
  const FormDataCtor = (globalThis as { FormData?: typeof FormData }).FormData
  if (typeof FormDataCtor !== 'function') {
    throw new TypeError('FormData is unavailable')
  }

  const headers = stripUploadContentType(normalizeRequestHeaders(options?.header))
  const formData = new FormDataCtor()
  for (const [key, value] of Object.entries(options?.formData ?? {})) {
    formData.append(key, value == null ? '' : String(value))
  }
  const blob = await resolveUploadFileBlob(filePath, runtimeFetch)
  formData.append(options?.name?.trim() || 'file', blob, resolveUploadFileName(filePath))

  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  const timeoutControl = resolveTimeoutSignal(timeout)

  try {
    const response = await runtimeFetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: timeoutControl.signal,
    })
    const data = await response.text()
    return {
      data,
      statusCode: response.status,
      header: collectResponseHeaders(response),
    }
  }
  finally {
    timeoutControl.clear()
  }
}
