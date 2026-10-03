import { afterEach, describe, expect, it, vi } from 'vitest'
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
    expect(promptRetry).toHaveBeenCalledWith(expect.any(Error), 0, expect.objectContaining({ signal: expect.any(AbortSignal) }))
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

afterEach(() => vi.useRealTimers())

it('shares a single budget across failed execution, login input and retries', async () => {
  vi.useFakeTimers()
  const failure = new Error('need re-login')
  const budgets: number[] = []
  const execute = vi.fn(async (scope) => {
    budgets.push(scope.remainingMs())
    await scope.pause(40)
    return failure
  })
  const result = runRetryableCommand({
    timeout: 100,
    execute,
    isRetryableResult: () => true,
    createCancelError: value => value,
    promptRetry: async (_result, _count, scope) => {
      await scope.pause(30)
      return true
    },
    shouldRetry: value => value,
  }).catch(error => error)
  await vi.advanceTimersByTimeAsync(100)
  await expect(result).resolves.toMatchObject({ cause: failure, operation: { attempts: 2, elapsedMs: 100, remainingMs: 0 } })
  expect(budgets).toEqual([100, 30])
  expect(execute).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('caps retries even when the prompt repeatedly requests another attempt', async () => {
  const failure = new Error('need re-login')
  const execute = vi.fn(async () => failure)
  await expect(runRetryableCommand({
    execute,
    isRetryableResult: () => true,
    createCancelError: value => value,
    promptRetry: async () => true,
    shouldRetry: value => value,
  })).rejects.toBe(failure)
  expect(execute).toHaveBeenCalledTimes(3)
})
