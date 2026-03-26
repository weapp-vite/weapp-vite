import type { HeadlessWxRequestOption, HeadlessWxRequestSuccessResult, HeadlessWxShowToastOption } from '../host'

export interface HeadlessWxToastSnapshot {
  duration: number
  icon: string
  mask: boolean
  title: string
}

export interface HeadlessWxRequestMockDefinition {
  header?: Record<string, string>
  method?: string
  response:
    | unknown
    | ((option: HeadlessWxRequestOption) => unknown)
  statusCode?: number
  url: RegExp | string
}

export interface HeadlessWxRequestLogEntry {
  data: unknown
  header: Record<string, string>
  matched: boolean
  method: string
  response?: HeadlessWxRequestSuccessResult
  url: string
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') {
    return value
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeMethod(method?: string) {
  return (method || 'GET').trim().toUpperCase()
}

function isRequestSuccessResult(value: unknown): value is Partial<HeadlessWxRequestSuccessResult> & { data: unknown } {
  return !!value && typeof value === 'object' && 'data' in value
}

function matchesRequestMock(mock: HeadlessWxRequestMockDefinition, option: HeadlessWxRequestOption) {
  const requestMethod = normalizeMethod(option.method)
  const mockMethod = normalizeMethod(mock.method)
  if (mock.method && requestMethod !== mockMethod) {
    return false
  }

  if (typeof mock.url === 'string') {
    return mock.url === option.url
  }

  mock.url.lastIndex = 0
  return mock.url.test(option.url)
}

function resolveRequestResponse(
  mock: HeadlessWxRequestMockDefinition,
  option: HeadlessWxRequestOption,
): HeadlessWxRequestSuccessResult {
  const rawResponse = typeof mock.response === 'function'
    ? mock.response(option)
    : mock.response

  if (isRequestSuccessResult(rawResponse)) {
    return {
      cookies: Array.isArray(rawResponse.cookies) ? [...rawResponse.cookies] : [],
      data: cloneValue(rawResponse.data),
      errMsg: rawResponse.errMsg ?? 'request:ok',
      header: { ...rawResponse.header },
      statusCode: rawResponse.statusCode ?? mock.statusCode ?? 200,
    }
  }

  return {
    cookies: [],
    data: cloneValue(rawResponse),
    errMsg: 'request:ok',
    header: { ...(mock.header ?? {}) },
    statusCode: mock.statusCode ?? 200,
  }
}

export function createHeadlessWxState() {
  const requestLogs: HeadlessWxRequestLogEntry[] = []
  const requestMocks: HeadlessWxRequestMockDefinition[] = []
  const storage = new Map<string, unknown>()
  let toast: HeadlessWxToastSnapshot | null = null

  return {
    clearStorageSync() {
      storage.clear()
    },
    getRequestLogs() {
      return requestLogs.map(entry => ({
        ...entry,
        data: cloneValue(entry.data),
        header: { ...entry.header },
        response: entry.response
          ? {
              ...entry.response,
              cookies: [...entry.response.cookies],
              data: cloneValue(entry.response.data),
              header: { ...entry.response.header },
            }
          : undefined,
      }))
    },
    getStorageSnapshot() {
      return Object.fromEntries(
        Array.from(storage.entries(), ([key, value]) => [key, cloneValue(value)]),
      )
    },
    getStorageSync(key: string) {
      return cloneValue(storage.get(key))
    },
    getToast() {
      return toast ? { ...toast } : null
    },
    hideToast() {
      toast = null
      return {
        errMsg: 'hideToast:ok',
      }
    },
    mockRequest(definition: HeadlessWxRequestMockDefinition) {
      requestMocks.push({
        ...definition,
        header: definition.header ? { ...definition.header } : undefined,
      })
    },
    removeStorageSync(key: string) {
      storage.delete(key)
    },
    request(option: HeadlessWxRequestOption) {
      const matchedMock = requestMocks.find(mock => matchesRequestMock(mock, option))
      if (!matchedMock) {
        const logEntry: HeadlessWxRequestLogEntry = {
          data: cloneValue(option.data),
          header: { ...(option.header ?? {}) },
          matched: false,
          method: normalizeMethod(option.method),
          url: option.url,
        }
        requestLogs.push(logEntry)
        throw new Error(`No request mock matched in headless runtime: ${normalizeMethod(option.method)} ${option.url}`)
      }

      const response = resolveRequestResponse(matchedMock, option)
      requestLogs.push({
        data: cloneValue(option.data),
        header: { ...(option.header ?? {}) },
        matched: true,
        method: normalizeMethod(option.method),
        response,
        url: option.url,
      })
      return response
    },
    setStorageSync(key: string, value: unknown) {
      storage.set(key, cloneValue(value))
    },
    showToast(option: HeadlessWxShowToastOption) {
      toast = {
        duration: Number(option.duration ?? 1500),
        icon: option.icon ?? 'success',
        mask: Boolean(option.mask),
        title: option.title,
      }
      return {
        errMsg: 'showToast:ok',
      }
    },
  }
}
