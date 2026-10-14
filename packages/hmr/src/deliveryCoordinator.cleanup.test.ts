import { expect, it, vi } from 'vitest'
import { HmrDeliveryCoordinator } from './deliveryCoordinator'
import { HmrPreparationCleanupError } from './errors'

function rejectDisposal(kind: 'sync' | 'async', failure: Error) {
  return kind === 'sync'
    ? vi.fn(() => { throw failure })
    : vi.fn(async () => { throw failure })
}

function outcome(operation: Promise<void>) {
  return operation.then(
    () => ({ status: 'fulfilled' as const }),
    error => ({ status: 'rejected' as const, error: error as unknown }),
  )
}

it.each(['sync', 'async'] as const)('propagates %s disposal failure through settlement, notification and repeated close', async (kind) => {
  const failure = new Error(`${kind} delivery disposal failed`)
  const dispose = rejectDisposal(kind, failure)
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {}, dispose }) })
  await expect(queue.whenSettled()).rejects.toBe(failure)
  const closing = queue.close()
  expect(queue.close()).toBe(closing)
  await expect(closing).rejects.toBe(failure)
  await expect(queue.close()).rejects.toBe(failure)
  expect(dispose).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it.each(['sync', 'async'] as const)('keeps %s disposal failure during close and waits for all other resources', async (kind) => {
  const failure = new Error(`${kind} pending delivery disposal failed`)
  const publishing = Promise.withResolvers<void>()
  const published = Promise.withResolvers<void>()
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  const first = rejectDisposal(kind, failure)
  const last = vi.fn(async () => {
    disposing.resolve()
    await disposed.promise
  })
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => ({
    commit: async () => {},
    publish: async () => {
      publishing.resolve()
      await published.promise
    },
    dispose: first,
  }) })
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {}, dispose: last }) })
  await publishing.promise
  let settled = false
  const closing = queue.close()
  const waiting = outcome(closing).then((result) => {
    settled = true
    return result
  })
  expect(queue.close()).toBe(closing)
  await disposing.promise
  published.resolve()
  expect(settled).toBe(false)
  disposed.resolve()
  expect(await waiting).toEqual({ status: 'rejected', error: failure })
  expect(first).toHaveBeenCalledOnce()
  expect(last).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it('blocks later deliveries, retry and reset after a failed disposal without losing the resource error', async () => {
  const failure = new Error('delivery disposal failed')
  const publishing = Promise.withResolvers<void>()
  const published = Promise.withResolvers<void>()
  const laterCommit = vi.fn(async () => {})
  const laterPublish = vi.fn(async () => {})
  const laterDispose = vi.fn()
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => ({
    commit: async () => {},
    publish: async () => {
      publishing.resolve()
      await published.promise
    },
    dispose: () => { throw failure },
  }) })
  queue.enqueue({ prepare: async () => ({ commit: laterCommit, publish: laterPublish, dispose: laterDispose }) })
  await publishing.promise
  published.resolve()
  await expect(queue.whenSettled()).rejects.toBe(failure)
  queue.retry()
  queue.reset()
  const newPrepare = vi.fn()
  queue.enqueue({ prepare: newPrepare })
  await expect(queue.whenSettled()).rejects.toBe(failure)
  await expect(queue.close()).rejects.toBe(failure)
  expect(laterCommit).not.toHaveBeenCalled()
  expect(laterPublish).not.toHaveBeenCalled()
  expect(laterDispose).toHaveBeenCalledOnce()
  expect(newPrepare).not.toHaveBeenCalled()
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it('retains superseded-generation disposal errors reported from void reset cleanup', async () => {
  const failure = new Error('superseded delivery disposal failed')
  const preparing = Promise.withResolvers<void>()
  const prepared = Promise.withResolvers<void>()
  const commit = vi.fn(async () => {})
  const publish = vi.fn(async () => {})
  const dispose = rejectDisposal('async', failure)
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    preparing.resolve()
    await prepared.promise
    return { commit, publish, dispose }
  } })
  await preparing.promise
  queue.reset()
  prepared.resolve()
  await expect(queue.whenSettled()).rejects.toBe(failure)
  await expect(queue.close()).rejects.toBe(failure)
  expect(commit).not.toHaveBeenCalled()
  expect(publish).not.toHaveBeenCalled()
  expect(dispose).toHaveBeenCalledOnce()
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it('does not reinterpret a rejected preparation as a disposal failure or report it twice', async () => {
  const failure = new Error('preparation failed')
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    throw failure
  } })
  await expect(queue.whenSettled()).rejects.toBe(failure)
  queue.reset()
  await expect(queue.whenSettled()).resolves.toBeUndefined()
  await expect(queue.close()).resolves.toBeUndefined()
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it('preserves every closing disposal error and attempts all releases', async () => {
  const first = new Error('first delivery disposal failed')
  const last = new Error('last delivery disposal failed')
  const preparing = Promise.withResolvers<void>()
  const prepared = Promise.withResolvers<void>()
  const firstDispose = rejectDisposal('sync', first)
  const lastDispose = rejectDisposal('async', last)
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    preparing.resolve()
    await prepared.promise
    return { commit: async () => {}, publish: async () => {}, dispose: firstDispose }
  } })
  queue.enqueue({ prepare: async () => ({ commit: async () => {}, publish: async () => {}, dispose: lastDispose }) })
  await preparing.promise
  const waiting = outcome(queue.close())
  prepared.resolve()
  const result = await waiting
  expect(result).toMatchObject({ status: 'rejected', error: { errors: [last, first], cause: last } })
  expect(firstDispose).toHaveBeenCalledOnce()
  expect(lastDispose).toHaveBeenCalledOnce()
  expect(onError.mock.calls.map(([error]) => error)).toEqual([last, first])
})

it('keeps the owner failure observable when its notification callback throws', async () => {
  const failure = new Error('delivery disposal failed')
  const queue = new HmrDeliveryCoordinator(() => {
    throw new Error('diagnostic failure')
  })
  queue.enqueue({ prepare: async () => ({
    commit: async () => {},
    publish: async () => {},
    dispose: async () => { throw failure },
  }) })
  await expect(queue.whenSettled()).rejects.toBe(failure)
  await expect(queue.close()).rejects.toBe(failure)
})

it.each([
  new Error('ordinary preparation failed'),
  new AggregateError([new Error('ordinary preparation failed')], 'ordinary aggregate preparation failed'),
])('preserves ordinary superseded preparation cancellation without a resource error', async (failure) => {
  const preparing = Promise.withResolvers<void>()
  const prepared = Promise.withResolvers<void>()
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    preparing.resolve()
    await prepared.promise
    throw failure
  } })
  await preparing.promise
  queue.reset()
  prepared.resolve()
  await expect(queue.whenSettled()).resolves.toBeUndefined()
  await expect(queue.close()).resolves.toBeUndefined()
  expect(onError).not.toHaveBeenCalled()
})

it('retains a live preparation cleanup error after its rejected preparation is cleared without duplicate reporting', async () => {
  const primary = new Error('preparation failed')
  const cleanup = new Error('preparation cleanup failed')
  const failure = new HmrPreparationCleanupError(primary, [cleanup])
  const onError = vi.fn()
  const queue = new HmrDeliveryCoordinator(onError)
  queue.enqueue({ prepare: async () => {
    throw failure
  } })
  await expect(queue.whenSettled()).rejects.toBe(failure)
  queue.reset()
  queue.retry()
  await expect(queue.whenSettled()).rejects.toBe(failure)
  await expect(queue.close()).rejects.toBe(failure)
  expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
})

it('waits for closing cleanup when a live failure reporter throws', async () => {
  const primary = new Error('commit failed')
  const diagnostic = new Error('reporter failed')
  const cleanup = new Error('later disposal failed')
  const commit = Promise.withResolvers<void>()
  const disposing = Promise.withResolvers<void>()
  const disposed = Promise.withResolvers<void>()
  let closed = false
  let closing: Promise<unknown> | undefined
  const queue = new HmrDeliveryCoordinator(() => {
    closing ??= queue.close().then(
      () => {
        closed = true
        return undefined
      },
      (error) => {
        closed = true
        return error
      },
    )
    throw diagnostic
  })
  queue.enqueue({ prepare: async () => ({ commit: () => commit.promise, publish: async () => {} }) })
  queue.enqueue({ prepare: async () => ({
    commit: async () => {},
    publish: async () => {},
    dispose: async () => {
      disposing.resolve()
      await disposed.promise
      throw cleanup
    },
  }) })
  const waiting = queue.whenSettled().catch(error => error)
  commit.reject(primary)
  await disposing.promise
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(closed).toBe(false)
  disposed.resolve()
  const [settlement, closeResult] = await Promise.all([waiting, closing])
  expect(settlement).toBe(cleanup)
  expect(closeResult).toBe(cleanup)
})

it('preserves the live delivery failure identity when its reporter throws', async () => {
  const primary = new Error('commit failed')
  const queue = new HmrDeliveryCoordinator(() => {
    throw new Error('reporter failed')
  })
  queue.enqueue({ prepare: async () => ({
    commit: async () => { throw primary },
    publish: async () => {},
  }) })
  await expect(queue.whenSettled()).rejects.toBe(primary)
  await expect(queue.close()).resolves.toBeUndefined()
})
