import { describe, expect, it, vi } from 'vitest'
import { createSharedLaunch } from './index'

describe('shared launch ownership', () => {
  it('joins concurrent acquisitions before the first launch has completed', async () => {
    const { shared: run } = createSharedLaunch<object>()
    const session = {}
    const deferred = Promise.withResolvers<object>()
    const launch = vi.fn(() => deferred.promise)
    const duplicateLaunch = vi.fn(async () => ({}))

    const first = run(launch)
    const second = run(duplicateLaunch)
    const third = run(duplicateLaunch)
    deferred.resolve(session)

    const sessions = await Promise.all([first, second, third])
    for (const acquired of sessions) {
      expect(acquired).toBe(session)
    }
    expect(launch).toHaveBeenCalledTimes(1)
    expect(duplicateLaunch).not.toHaveBeenCalled()
  })

  it.each([
    new Error('simulator did not become ready', { cause: new Error('launch budget exhausted') }),
    undefined,
  ])('retains the first rejection for concurrent and later acquisitions: %s', async (failure) => {
    const { shared: run } = createSharedLaunch<object>()
    const deferred = Promise.withResolvers<object>()
    const launch = vi.fn(() => deferred.promise)
    const laterLaunch = vi.fn(async () => ({}))

    const first = run(launch)
    const second = run(laterLaunch)
    const results = Promise.allSettled([first, second])
    deferred.reject(failure)
    expect(await results).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ])

    await expect(run(laterLaunch)).rejects.toBe(failure)
    await expect(run(laterLaunch)).rejects.toBe(failure)
    expect(launch).toHaveBeenCalledTimes(1)
    expect(laterLaunch).not.toHaveBeenCalled()
  })

  it('retains synchronous launch failures without wrapping their identity', async () => {
    const { shared: run } = createSharedLaunch<object>()
    const failure = new Error('ownership verification failed')
    const launch = vi.fn(() => {
      throw failure
    })

    await expect(run(launch)).rejects.toBe(failure)
    await expect(run(launch)).rejects.toBe(failure)
    expect(launch).toHaveBeenCalledTimes(1)
  })

  it('preserves successful shared ownership and permits a new launch after explicit close', async () => {
    const { shared: run } = createSharedLaunch<object>()
    const first = {}
    const second = {}
    const launch = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    let current: object | undefined
    const acquire = () => run(async () => current ??= await launch())

    await expect(acquire()).resolves.toBe(first)
    await expect(acquire()).resolves.toBe(first)
    expect(launch).toHaveBeenCalledTimes(1)

    current = undefined
    await expect(acquire()).resolves.toBe(second)
    expect(launch).toHaveBeenCalledTimes(2)
  })

  it('retains a failed replacement even after an earlier successful session', async () => {
    const { shared: run } = createSharedLaunch<object>()
    const session = {}
    const failure = new Error('replacement launch failed')
    const replacement = vi.fn().mockRejectedValue(failure)
    const laterLaunch = vi.fn(async () => ({}))

    await expect(run(async () => session)).resolves.toBe(session)
    await expect(run(replacement)).rejects.toBe(failure)
    await expect(run(laterLaunch)).rejects.toBe(failure)
    expect(replacement).toHaveBeenCalledTimes(1)
    expect(laterLaunch).not.toHaveBeenCalled()
  })

  it('blocks fresh and explicit restart launches after a shared acquisition fails', async () => {
    const owner = createSharedLaunch<object>()
    const failure = new Error('cold launch failed')
    const fresh = vi.fn(async () => ({}))
    const restart = vi.fn(async () => ({}))

    await expect(owner.shared(async () => {
      throw failure
    })).rejects.toBe(failure)
    await expect(owner.run(fresh)).rejects.toBe(failure)
    await expect(owner.run(restart)).rejects.toBe(failure)
    expect(fresh).not.toHaveBeenCalled()
    expect(restart).not.toHaveBeenCalled()
  })

  it('blocks shared acquisitions after an independent launch fails', async () => {
    const owner = createSharedLaunch<object>()
    const failure = new Error('explicit restart failed')
    const next = vi.fn(async () => ({}))

    await expect(owner.run(async () => {
      throw failure
    })).rejects.toBe(failure)
    await expect(owner.shared(next)).rejects.toBe(failure)
    expect(next).not.toHaveBeenCalled()
  })

  it('does not coalesce independent launch intent with a shared acquisition', async () => {
    const owner = createSharedLaunch<object>()
    const shared = {}
    const independent = {}
    const deferred = Promise.withResolvers<object>()
    const launch = vi.fn(async () => independent)

    const acquiring = owner.shared(() => deferred.promise)
    await expect(owner.run(launch)).resolves.toBe(independent)
    deferred.resolve(shared)
    await expect(acquiring).resolves.toBe(shared)
    expect(launch).toHaveBeenCalledTimes(1)
  })
})
