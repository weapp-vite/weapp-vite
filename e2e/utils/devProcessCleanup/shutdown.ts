export interface DevProcessStopOptions {
  gracefulTimeoutMs?: number
  signal?: AbortSignal
}

export interface DevProcessForcedShutdown {
  gracefulTimeoutMs: number
  cancelled?: { reason: unknown }
  requestError?: unknown
}

export interface DevProcessExitInfo {
  exitCode: number | null | undefined
  signal: string | undefined
  reason: string
  error?: unknown
}

// 活动 watch 构建与首构使用相同的完成预算，独立于强杀后的进程观察预算。
export const DEV_PROCESS_GRACEFUL_TIMEOUT_MS = 90_000
export const DEV_PROCESS_GRACEFUL_SHUTDOWN_ERROR_NAME = 'DevProcessGracefulShutdownError'

/** 进程终结不代表开发会话已经恢复配置和释放资源，保留为不可改写的验收失败。 */
export class DevProcessGracefulShutdownError extends Error {
  readonly name = DEV_PROCESS_GRACEFUL_SHUTDOWN_ERROR_NAME

  constructor(message: string, readonly evidence: DevProcessForcedShutdown, options?: ErrorOptions) {
    super(message, options)
  }
}

/** 保留会话关闭首错；退出码和原始异常仍与末尾输出一起供调用方诊断。 */
export function createDevProcessShutdownFailure(info: DevProcessExitInfo, summary: string, formatMessage: (message: string) => string, forced?: DevProcessForcedShutdown): Error | undefined {
  if (forced) {
    return new DevProcessGracefulShutdownError(formatMessage(
      `Dev process graceful session cleanup did not complete before its deadline, cancellation, or forced termination: ${summary}; gracefulTimeoutMs=${forced.gracefulTimeoutMs}; cancelled=${Boolean(forced.cancelled)}`,
    ), forced, { cause: forced.requestError ?? forced.cancelled?.reason ?? info.error })
  }
  if (info.exitCode !== 0 || info.signal) {
    return new Error(formatMessage(`Dev process failed during graceful shutdown: ${summary}`), { cause: info.error })
  }
}

/** 取消和超时只结束等待；调用者仍必须按登记身份完成清理并保留未正常关闭的证据。 */
export async function waitForGracefulExit(settledExit: Promise<unknown>, options: Required<Pick<DevProcessStopOptions, 'gracefulTimeoutMs'>> & Pick<DevProcessStopOptions, 'signal'>): Promise<'exited' | 'timeout' | 'cancelled'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancelled = Promise.withResolvers<'cancelled'>()
  const onAbort = () => cancelled.resolve('cancelled')
  try {
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) {
      onAbort()
    }
    return await Promise.race([
      settledExit.then(() => 'exited' as const),
      new Promise<'timeout'>(resolve => timer = setTimeout(resolve, options.gracefulTimeoutMs, 'timeout')),
      cancelled.promise,
    ])
  }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
