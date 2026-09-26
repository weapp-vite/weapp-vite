const SUBSCRIPTION_METHODS = new Set(['App.enableLog', 'App.CDPEnable', 'App.CDPCommand'])

export class RuntimeLogSubscriptionDeadlineError extends Error {
  readonly code = 'E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE'

  constructor(readonly attempts: number, cause?: unknown, readonly lastCause?: unknown) {
    super(`Runtime log subscription deadline exhausted after ${attempts} attempts`, { cause })
    this.name = 'RuntimeLogSubscriptionDeadlineError'
  }
}

/** 仅重试订阅阶段明确的宿主响应超时，不将协议不支持、断连或业务异常当成未就绪。 */
export function isRuntimeLogSubscriptionResponseTimeout(error: unknown, requestBudgetMs: number): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const protocol = error as Error & { code?: string, method?: string }
  if (protocol.code === 'DEVTOOLS_PROTOCOL_TIMEOUT') {
    return SUBSCRIPTION_METHODS.has(protocol.method ?? '')
  }
  if (protocol.code !== undefined) {
    return false
  }
  return error.message === 'timeout waiting for automator response'
    || error.message === `Timed out enabling console logging within ${requestBudgetMs}ms`
}

interface RuntimeLogSubscriptionOptions {
  deadlineAt: number
  signal: AbortSignal
  subscribe: (timeoutMs: number) => Promise<void>
  assertClean: () => void
  onRetry?: (details: { attempt: number, elapsedMs: number, remainingMs: number, error: unknown }) => void
}

interface SubscriptionState {
  attempts: number
  lastError?: unknown
}

async function runRuntimeLogSubscription(options: RuntimeLogSubscriptionOptions, state: SubscriptionState) {
  const startedAt = performance.now()
  while (true) {
    options.signal.throwIfAborted()
    options.assertClean()
    const remainingMs = Math.floor(options.deadlineAt - performance.now())
    if (remainingMs <= 0) {
      throw new RuntimeLogSubscriptionDeadlineError(state.attempts, state.lastError, state.lastError)
    }
    const requestBudgetMs = Math.min(15_000, remainingMs)
    state.attempts += 1
    try {
      await options.subscribe(requestBudgetMs)
      options.signal.throwIfAborted()
      options.assertClean()
      if (performance.now() >= options.deadlineAt) {
        throw new RuntimeLogSubscriptionDeadlineError(state.attempts, state.lastError, state.lastError)
      }
      return
    }
    catch (error) {
      options.signal.throwIfAborted()
      options.assertClean()
      if (!isRuntimeLogSubscriptionResponseTimeout(error, requestBudgetMs)) {
        throw error
      }
      state.lastError = error
      const remainingMs = Math.floor(options.deadlineAt - performance.now())
      if (remainingMs <= 0) {
        throw new RuntimeLogSubscriptionDeadlineError(state.attempts, state.lastError, state.lastError)
      }
      options.onRetry?.({ attempt: state.attempts, elapsedMs: performance.now() - startedAt, remainingMs, error })
      options.signal.throwIfAborted()
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>
        const abort = () => {
          clearTimeout(timer)
          reject(options.signal.reason)
        }
        timer = setTimeout(() => {
          options.signal.removeEventListener('abort', abort)
          resolve()
        }, Math.min(250, remainingMs))
        options.signal.addEventListener('abort', abort, { once: true })
      })
    }
  }
}

/** 在已连接会话中按同一个阶段截止时间串行重试幂等订阅；取消后不再发起下一次请求。 */
export function waitForRuntimeLogSubscription(options: RuntimeLogSubscriptionOptions) {
  return runRuntimeLogSubscription(options, { attempts: 0 })
}

/** 将重试状态和取消收敛到订阅阶段，仅转换该阶段已声明的外层超时。 */
export function createRuntimeLogSubscription(options: Omit<RuntimeLogSubscriptionOptions, 'signal'> & { timeoutMessages: readonly string[] }) {
  const controller = new AbortController()
  const state: SubscriptionState = { attempts: 0 }
  let pending = true
  return {
    get pending() { return pending },
    abort(reason?: unknown) { controller.abort(reason) },
    normalizeError(error: unknown) {
      if (!pending || !(error instanceof Error) || 'code' in error || !options.timeoutMessages.includes(error.message)) {
        return error
      }
      return new RuntimeLogSubscriptionDeadlineError(state.attempts, error, state.lastError)
    },
    async wait() {
      await runRuntimeLogSubscription({ ...options, signal: controller.signal }, state)
      pending = false
    },
  }
}
