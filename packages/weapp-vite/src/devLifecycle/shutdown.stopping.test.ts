import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevShutdownScope } from './shutdown'

const initialExitCode = process.exitCode

beforeEach(() => {
  process.exitCode = undefined
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
})

afterEach(() => {
  process.exitCode = initialExitCode
  vi.restoreAllMocks()
})

it('allows a retired owner to release its stopping subscription', async () => {
  const scope = createDevShutdownScope()
  const cancelled = vi.fn()
  try {
    const release = scope.onStopping(cancelled)
    release()
    release()
    scope.request()
    await scope.close()
    expect(cancelled).not.toHaveBeenCalled()
  }
  finally {
    await scope.close()
  }
})

it('immediately cancels in-flight startup and waits for the complete cancellation task', async () => {
  const scope = createDevShutdownScope()
  const cancelled = Promise.withResolvers<void>()
  const drained = Promise.withResolvers<void>()
  let stopped = false
  const startup = scope.run('startup', async () => {
    scope.onStopping(async () => {
      cancelled.resolve()
      await drained.promise
    })
    scope.request()
    await cancelled.promise
  })
  void scope.done.then(() => {
    stopped = true
  })
  try {
    await startup
    expect(stopped).toBe(false)
    drained.resolve()
    await scope.close()
    expect(stopped).toBe(true)
  }
  finally {
    drained.resolve()
    await startup.catch(() => {})
    await scope.close()
  }
})

it('includes late stopping subscriptions and their original errors in shutdown', async () => {
  const scope = createDevShutdownScope()
  const hold = Promise.withResolvers<void>()
  const original = new Error('cancellation failed')
  const startup = scope.run('startup', () => hold.promise)
  scope.request()
  try {
    scope.onStopping(async () => {
      throw original
    })
    hold.resolve()
    await startup
    await expect(scope.close()).rejects.toBe(original)
  }
  finally {
    hold.resolve()
    await scope.close().catch(() => {})
  }
})
