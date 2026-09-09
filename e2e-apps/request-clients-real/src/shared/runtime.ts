import { REQUEST_CLIENTS_REAL_DEV_BASE_URL } from './requestClientsRealDevBaseUrl'
import { createRequestClientsRealHostTraceStore } from './requestHostTrace'

const TRAILING_SLASH_RE = /\/+$/
const MAX_PAYLOAD_TEXT_LENGTH = 512
const MAX_ERROR_TEXT_LENGTH = 512
const MAX_OBJECT_DEPTH = 2
const MAX_OBJECT_KEYS = 8
const MAX_ARRAY_ITEMS = 4
const MAX_STRING_LENGTH = 160
const requestHostTrace = createRequestClientsRealHostTraceStore()

function syncRequestHostTraceToApp() {
  if (typeof getApp !== 'function') {
    return
  }

  try {
    const app = getApp<{ globalData?: Record<string, unknown> }>()
    if (!app) {
      return
    }

    app.globalData = app.globalData ?? {}
    app.globalData.requestHostTrace = requestHostTrace
  }
  catch {
  }
}

syncRequestHostTraceToApp()

export interface RequestCaseState {
  socketChecks: { defaultTransportSupported: boolean, serverRandomReceived: boolean, websocketOnlyConnected: boolean }
  response: { client: string, transport: string, method: string, operationName: string, event: string }
  pageStatus: string
  status: 'idle' | 'running' | 'success' | 'error'
  runCount: number
  requestCount: number
  requestPath: string
  httpStatus: number
  payload: string
  errorMessage: string
}

export interface RequestCasePayload {
  path: string
  requestCount: number
  [key: string]: unknown
}

export function createRequestCaseState(): RequestCaseState {
  return {
    socketChecks: { defaultTransportSupported: false, serverRandomReceived: false, websocketOnlyConnected: false },
    response: { client: '', transport: '', method: '', operationName: '', event: '' },
    pageStatus: '待执行',
    status: 'idle',
    runCount: 0,
    requestCount: 0,
    requestPath: '',
    httpStatus: 0,
    payload: '',
    errorMessage: '',
  }
}

export function resolveBaseUrl(query: Record<string, unknown> | undefined) {
  syncRequestHostTraceToApp()
  const queryBaseUrl = typeof query?.baseUrl === 'string' ? query.baseUrl : ''
  const fallbackBaseUrl = REQUEST_CLIENTS_REAL_DEV_BASE_URL
  const raw = queryBaseUrl || fallbackBaseUrl
  return decodeURIComponent(raw).trim().replace(TRAILING_SLASH_RE, '')
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}...<truncated:${value.length - maxLength}>`
}

function compactPayload(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return truncateText(value, MAX_STRING_LENGTH)
  }
  if (
    value == null
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`
  }
  if (depth >= MAX_OBJECT_DEPTH) {
    return '[MaxDepth]'
  }
  if (typeof value !== 'object') {
    return String(value)
  }
  if (seen.has(value)) {
    return '[Circular]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => compactPayload(item, depth + 1, seen))
  }
  const result: Record<string, unknown> = {}
  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS)
  for (const [key, item] of entries) {
    result[key] = compactPayload(item, depth + 1, seen)
  }
  const extraKeyCount = Object.keys(value).length - entries.length
  if (extraKeyCount > 0) {
    result.__truncatedKeys = extraKeyCount
  }
  return result
}

function stringifyPayloadForView(payload: RequestCasePayload) {
  return truncateText(JSON.stringify(compactPayload(payload)), MAX_PAYLOAD_TEXT_LENGTH)
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return truncateText(error.message, MAX_ERROR_TEXT_LENGTH)
  }
  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') {
      return truncateText(message, MAX_ERROR_TEXT_LENGTH)
    }
    const errMsg = Reflect.get(error, 'errMsg')
    if (typeof errMsg === 'string') {
      return truncateText(errMsg, MAX_ERROR_TEXT_LENGTH)
    }
    return truncateText(JSON.stringify(compactPayload(error)), MAX_ERROR_TEXT_LENGTH)
  }
  return truncateText(String(error ?? 'unknown error'), MAX_ERROR_TEXT_LENGTH)
}

export function createRunningState(previous: RequestCaseState): RequestCaseState {
  return {
    ...previous,
    socketChecks: { defaultTransportSupported: false, serverRandomReceived: false, websocketOnlyConnected: false },
    response: { client: '', transport: '', method: '', operationName: '', event: '' },
    pageStatus: '校验中',
    status: 'running',
    runCount: previous.runCount + 1,
    requestCount: 0,
    requestPath: '',
    httpStatus: 0,
    payload: '',
    errorMessage: '',
  }
}

function responseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function createSuccessState(
  previous: RequestCaseState,
  httpStatus: number,
  payload: RequestCasePayload,
): RequestCaseState {
  return {
    ...previous,
    socketChecks: {
      defaultTransportSupported: responseObject(payload.checks).defaultTransportSupported === true,
      serverRandomReceived: responseObject(payload.checks).serverRandomReceived === true,
      websocketOnlyConnected: responseObject(payload.checks).websocketOnlyConnected === true,
    },
    response: {
      client: String(payload.client ?? responseObject(payload.body).client ?? ''),
      transport: String(payload.transport ?? ''),
      method: String(payload.method ?? ''),
      operationName: String(payload.operationName ?? ''),
      event: String(payload.serverRandomEvent ?? responseObject(responseObject(payload.websocketOnlyProbe).randomPayload).event ?? ''),
    },
    pageStatus: '全部通过',
    status: 'success',
    requestCount: payload.requestCount,
    requestPath: payload.path,
    httpStatus,
    payload: stringifyPayloadForView(payload),
  }
}

export function createErrorState(previous: RequestCaseState, error: unknown): RequestCaseState {
  return {
    ...previous,
    pageStatus: '校验失败',
    status: 'error',
    errorMessage: toErrorMessage(error),
  }
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
