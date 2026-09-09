import { REQUEST_CLIENTS_REAL_DEV_BASE_URL } from './requestClientsRealDevBaseUrl'

const TRAILING_SLASH_RE = /\/+$/

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
  const queryBaseUrl = typeof query?.baseUrl === 'string' ? query.baseUrl : ''
  const fallbackBaseUrl = REQUEST_CLIENTS_REAL_DEV_BASE_URL
  const raw = queryBaseUrl || fallbackBaseUrl
  return decodeURIComponent(raw).trim().replace(TRAILING_SLASH_RE, '')
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error ?? 'unknown error')
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
    payload: JSON.stringify(payload),
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
