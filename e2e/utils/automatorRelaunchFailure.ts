export type RelaunchFailurePhase = 'current-route-ready' | 'raw-reLaunch' | 'devtools-log' | 'settle' | 'page-root'

export interface RelaunchFailureError {
  name?: string
  message: string
  stack?: string
  code?: string
  method?: string
}

export interface RelaunchFailurePageIdentity {
  status: 'available' | 'unavailable'
  pageId?: string | number
  path?: string
}

export interface RelaunchFailureCurrentPageOptions {
  appFunctionFallback: false
  pageStackFallback: false
  retries: number
  timeout: number
}

export interface RelaunchFailureInput {
  originalError: unknown
  firstErrorObservedAt: string
  failurePhase: RelaunchFailurePhase
  route: string
  attempt: number
  rootSelectors?: readonly string[]
  rawReturnedPage: unknown
  observedCurrentPage?: {
    page: unknown
    observedAt: string
    options: RelaunchFailureCurrentPageOptions
  }
  fallback: {
    attempted: boolean
    routeMatched?: boolean
    rootResult: 'not-checked' | 'missing'
    error?: unknown
  }
}

export interface RelaunchFailureContext extends Omit<RelaunchFailureInput, 'rawReturnedPage' | 'observedCurrentPage' | 'fallback'> {
  error: RelaunchFailureError
  rawReturnedPage: RelaunchFailurePageIdentity & { source: 'raw-reLaunch-return' }
  observedCurrentPage: RelaunchFailurePageIdentity & {
    source: 'post-error-native-currentPage'
    observedAt?: string
    options?: RelaunchFailureCurrentPageOptions
  }
  fallback: Omit<RelaunchFailureInput['fallback'], 'error'> & { error?: RelaunchFailureError }
}

export interface RelaunchFailureObserverScope {
  /** 仅表示本地停止等待；观察器须自行检查信号，远端请求未必已取消。 */
  signal: AbortSignal
  /** 与 performance.now() 共用单调时钟，不是 UTC 时间戳。 */
  deadlineAt: number
  timeoutMs: number
}

export interface RelaunchFailureObserver {
  observe: (context: RelaunchFailureContext, scope: RelaunchFailureObserverScope) => void | Promise<void>
  /** 返回原 case 的剩余预算，不得为诊断另开超时。 */
  remainingMs: () => number
  timeoutMs?: number
}

export type RelaunchFailureObservation
  = | { status: 'disabled' | 'completed' | 'timed-out' }
    | { status: 'blocked' | 'failed', error: RelaunchFailureError }

const MAX_OBSERVER_TIMEOUT_MS = 2_250
const CLOSE_RESERVE_MS = 100

function readProperty(value: unknown, key: string): unknown {
  try {
    return value && (typeof value === 'object' || typeof value === 'function')
      ? Reflect.get(value, key)
      : undefined
  }
  catch {
    return undefined
  }
}

function text(value: unknown, limit: number) {
  try {
    return value === undefined ? undefined : String(value).slice(0, limit)
  }
  catch {
    return undefined
  }
}

function describeError(error: unknown): RelaunchFailureError {
  return {
    name: text(readProperty(error, 'name'), 120),
    message: text(readProperty(error, 'message'), 2_048) ?? text(error, 2_048) ?? '<unreadable error>',
    stack: text(readProperty(error, 'stack'), 8_192),
    code: text(readProperty(error, 'code'), 160),
    method: text(readProperty(error, 'method'), 160),
  }
}

/** 只复制句柄已有身份字段，不读取页面协议。 */
export function snapshotRelaunchPageIdentity(page: unknown): RelaunchFailurePageIdentity {
  const id = readProperty(page, 'pageId')
  const pageId = typeof id === 'string' ? id.slice(0, 256) : typeof id === 'number' && Number.isFinite(id) ? id : undefined
  const pagePath = readProperty(page, 'path')
  return {
    status: pageId === undefined ? 'unavailable' : 'available',
    pageId,
    path: typeof pagePath === 'string' ? pagePath.slice(0, 2_048) : undefined,
  }
}

function failureContext(input: RelaunchFailureInput): RelaunchFailureContext {
  return {
    originalError: input.originalError,
    error: describeError(input.originalError),
    firstErrorObservedAt: input.firstErrorObservedAt,
    failurePhase: input.failurePhase,
    route: input.route,
    attempt: input.attempt,
    rootSelectors: input.rootSelectors ? [...input.rootSelectors] : undefined,
    rawReturnedPage: { ...snapshotRelaunchPageIdentity(input.rawReturnedPage), source: 'raw-reLaunch-return' },
    observedCurrentPage: {
      ...snapshotRelaunchPageIdentity(input.observedCurrentPage?.page),
      source: 'post-error-native-currentPage',
      observedAt: input.observedCurrentPage?.observedAt,
      options: input.observedCurrentPage ? { ...input.observedCurrentPage.options } : undefined,
    },
    fallback: {
      ...input.fallback,
      error: input.fallback.error === undefined ? undefined : describeError(input.fallback.error),
    },
  }
}

/** 仅在原流程决定关闭后观察已知值，诊断失败不能代替原错误或阻止关闭。 */
export async function observeRelaunchFailureBeforeClose(
  observer: RelaunchFailureObserver | undefined,
  input: RelaunchFailureInput,
): Promise<RelaunchFailureObservation> {
  if (!observer) {
    return { status: 'disabled' }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const remainingMs = observer.remainingMs()
    const requestedMs = observer.timeoutMs ?? MAX_OBSERVER_TIMEOUT_MS
    const timeoutMs = Math.floor(Math.min(MAX_OBSERVER_TIMEOUT_MS, requestedMs, remainingMs - CLOSE_RESERVE_MS))
    if (!Number.isFinite(remainingMs) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return { status: 'blocked', error: { message: 'Insufficient original case budget for relaunch failure observation' } }
    }
    const context = failureContext(input)
    const controller = new AbortController()
    const scope = { signal: controller.signal, deadlineAt: performance.now() + timeoutMs, timeoutMs }
    // 两个分支都消费 rejection；本地超时后不接续任何采集或发布阶段。
    const observation = Promise.resolve().then(() => observer.observe(context, scope)).then(
      (): RelaunchFailureObservation => ({ status: 'completed' }),
      (error: unknown): RelaunchFailureObservation => ({ status: 'failed', error: describeError(error) }),
    )
    return await Promise.race([
      observation,
      new Promise<RelaunchFailureObservation>((resolve) => {
        timer = setTimeout(() => {
          controller.abort()
          resolve({ status: 'timed-out' })
        }, timeoutMs)
      }),
    ])
  }
  catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
  finally {
    clearTimeout(timer)
  }
}
