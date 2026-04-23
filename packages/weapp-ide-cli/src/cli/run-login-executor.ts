export interface RetryableCommandExecutorOptions<TResult, TPromptResult> {
  createCancelError: (result: TResult) => Error
  execute: () => Promise<TResult>
  isRetryableResult: (result: TResult) => boolean
  onCancel?: (result: TResult) => void
  onRetry?: () => void
  promptRetry: (result: TResult, retryCount: number) => Promise<TPromptResult>
  shouldRetry: (result: TPromptResult) => boolean
}

/**
 * @description 执行可重试命令循环，并将“是否可重试”与“如何提示重试”交给调用方定义。
 */
export async function runRetryableCommand<TResult, TPromptResult>(
  options: RetryableCommandExecutorOptions<TResult, TPromptResult>,
) {
  const {
    createCancelError,
    execute,
    isRetryableResult,
    onCancel,
    onRetry,
    promptRetry,
    shouldRetry,
  } = options

  let retryCount = 0

  while (true) {
    const result = await execute()
    if (!isRetryableResult(result)) {
      return result
    }

    const action = await promptRetry(result, retryCount)
    if (shouldRetry(action)) {
      retryCount += 1
      onRetry?.()
      continue
    }

    onCancel?.(result)
    throw createCancelError(result)
  }
}
