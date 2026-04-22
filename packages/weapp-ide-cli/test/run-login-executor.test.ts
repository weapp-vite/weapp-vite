import { describe, expect, it, vi } from 'vitest'
import { runRetryableCommand } from '../src/cli/run-login-executor'

describe('runRetryableCommand', () => {
  it('retries while prompt allows retry and eventually returns final result', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(new Error('retryable'))
      .mockResolvedValueOnce('done')
    const promptRetry = vi.fn().mockResolvedValue('retry')
    const onRetry = vi.fn()

    const result = await runRetryableCommand({
      createCancelError: error => error as Error,
      execute,
      isRetryableResult: value => value instanceof Error,
      onRetry,
      promptRetry,
      shouldRetry: action => action === 'retry',
    })

    expect(result).toBe('done')
    expect(promptRetry).toHaveBeenCalledWith(expect.any(Error), 0)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('throws cancel error when prompt declines retry', async () => {
    const cancelError = new Error('cancelled')

    await expect(runRetryableCommand({
      createCancelError: () => cancelError,
      execute: async () => new Error('retryable'),
      isRetryableResult: value => value instanceof Error,
      onCancel: vi.fn(),
      promptRetry: async () => 'cancel',
      shouldRetry: action => action === 'retry',
    })).rejects.toBe(cancelError)
  })
})
