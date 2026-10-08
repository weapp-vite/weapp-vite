import { expect, it, vi } from 'vitest'
import { runWithCleanup } from './runWithCleanup'

it('returns the body result only after one cleanup has completed', async () => {
  const result = { value: 'body result' }
  let enterCleanup!: () => void
  let releaseCleanup!: () => void
  const entered = new Promise<void>((resolve) => {
    enterCleanup = resolve
  })
  const released = new Promise<void>((resolve) => {
    releaseCleanup = resolve
  })
  const body = vi.fn(() => result)
  const cleanup = vi.fn(async () => {
    enterCleanup()
    await released
  })
  let settled = false
  const pending = runWithCleanup(body, cleanup).then((value) => {
    settled = true
    return value
  })
  await entered
  expect(settled).toBe(false)
  releaseCleanup()
  await expect(pending).resolves.toBe(result)
  expect(body).toHaveBeenCalledOnce()
  expect(cleanup).toHaveBeenCalledOnce()
})

const failures = [new Error('original failure'), undefined, 'non-Error failure', 0]

it.each(failures)('preserves a sole body rejection without skipping cleanup: %s', async (failure) => {
  const body = vi.fn().mockRejectedValue(failure)
  const cleanup = vi.fn()
  await expect(runWithCleanup(body, cleanup)).rejects.toBe(failure)
  expect(body).toHaveBeenCalledOnce()
  expect(cleanup).toHaveBeenCalledOnce()
})

it.each(failures)('preserves a sole cleanup rejection without repeating cleanup: %s', async (failure) => {
  const body = vi.fn(() => 'body result')
  const cleanup = vi.fn().mockRejectedValue(failure)
  await expect(runWithCleanup(body, cleanup)).rejects.toBe(failure)
  expect(body).toHaveBeenCalledOnce()
  expect(cleanup).toHaveBeenCalledOnce()
})

it.each([
  ['Error values', new Error('body failure'), new Error('cleanup failure')],
  ['undefined body', undefined, 'cleanup failure'],
  ['undefined cleanup', 'body failure', undefined],
  ['both undefined', undefined, undefined],
] as const)('retains synchronous body and cleanup errors in order with the body as cause: %s', async (_label, bodyError, cleanupError) => {
  const body = vi.fn(() => {
    throw bodyError
  })
  const cleanup = vi.fn(() => {
    throw cleanupError
  })
  const pending = runWithCleanup(body, cleanup)
  await expect(pending).rejects.toBeInstanceOf(AggregateError)
  await expect(pending).rejects.toMatchObject({ errors: [bodyError, cleanupError] })
  await expect(pending).rejects.toHaveProperty('cause', bodyError)
  expect(body).toHaveBeenCalledOnce()
  expect(cleanup).toHaveBeenCalledOnce()
})
