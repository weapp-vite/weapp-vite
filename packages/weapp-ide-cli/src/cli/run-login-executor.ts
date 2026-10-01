import { OperationLifecycle } from '@weapp-vite/miniprogram-automator'

export interface RetryableCommandExecutorOptions<TResult, TPromptResult> {
  timeout?: number
  signal?: AbortSignal
  maxAttempts?: number
  disposeLate?: (result: TResult) => void | Promise<void>
  createCancelError: (result: TResult) => Error
  execute: (operation: OperationLifecycle) => Promise<TResult>
  isRetryableResult: (result: TResult) => boolean
  onCancel?: (result: TResult) => void
  onRetry?: () => void
  promptRetry: (result: TResult, retryCount: number, operation: OperationLifecycle) => Promise<TPromptResult>
  shouldRetry: (result: TPromptResult) => boolean
}

/** 命令、登录提示和有限重试共用一个 deadline，取消信号由执行边界传入 I/O。 */
export async function runRetryableCommand<TResult, TPromptResult>(
  options: RetryableCommandExecutorOptions<TResult, TPromptResult>,
) {
  const lifecycle = new OperationLifecycle(options.timeout ?? 30_000, 'IDE command', options.signal)
  return await lifecycle.run(async (scope) => {
    const maxAttempts = options.maxAttempts ?? 3
    for (let retryCount = 0; ; retryCount += 1) {
      scope.attempt()
      const result = await scope.step(() => options.execute(scope), { stage: 'execute', waitForExit: true, disposeLate: options.disposeLate })
      if (!options.isRetryableResult(result)) {
        return result
      }
      const cause = options.createCancelError(result)
      scope.recordFailure(cause)
      if (retryCount + 1 >= maxAttempts) {
        throw cause
      }
      const action = await scope.step(() => options.promptRetry(result, retryCount, scope), { stage: 'login-retry', waitForExit: true })
      if (options.shouldRetry(action)) {
        scope.throwIfAborted()
        options.onRetry?.()
        continue
      }
      options.onCancel?.(result)
      throw cause
    }
  })
}
