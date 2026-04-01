const TRAILING_SLASH_RE = /\/+$/

export interface RequestCaseState {
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
  const raw = typeof query?.baseUrl === 'string' ? query.baseUrl : ''
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

export function createSuccessState(
  previous: RequestCaseState,
  httpStatus: number,
  payload: RequestCasePayload,
): RequestCaseState {
  return {
    ...previous,
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

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
