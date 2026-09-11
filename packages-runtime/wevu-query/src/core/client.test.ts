import type { QueryAbortController } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from './client'
import { isQueryCancelled, QueryCancelledError } from './errors'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let reject!: (error: unknown) => void
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise
    resolve = resolvePromise
  })
  return { promise, reject, resolve }
}

const clients: QueryClient[] = []

function createClient(options: {
  createAbortController?: () => QueryAbortController
  gcTime?: number
  now?: () => number
  staleTime?: number
} = {}): QueryClient {
  const client = new QueryClient({
    ...options,
    createAbortController: options.createAbortController ?? (() => new AbortController()),
  })
  clients.push(client)
  return client
}

function captureReportedErrors(): Array<() => void> {
  const reports: Array<() => void> = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
    reports.push(callback)
    return 0 as never
  })
  return reports
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.dispose()
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('QueryClient', () => {
  it('requires an abort factory and validates query time boundaries', () => {
    const createAbortController = () => new AbortController()
    expect(() => new QueryClient({} as never)).toThrow(TypeError)
    expect(() => new QueryClient({ createAbortController, staleTime: -1 })).toThrow(RangeError)
    expect(() => new QueryClient({ createAbortController, gcTime: Number.NaN })).toThrow(RangeError)

    const client = createClient()
    const query = vi.fn(async () => 1)
    expect(() => client.observeQuery(
      { key: ['invalid-observer'] as const, query, gcTime: -1 },
      { enabled: false },
    )).toThrow(RangeError)
    expect(() => client.fetchQuery({
      key: ['invalid-fetch'] as const,
      query,
      staleTime: Number.NEGATIVE_INFINITY,
    })).toThrow(RangeError)
    expect(query).not.toHaveBeenCalled()
  })

  it('single-flights a key and observes its fresh-to-stale boundary', async () => {
    let now = 0
    let value = 0
    const client = createClient({ now: () => now, staleTime: 5_000 })
    const query = vi.fn(async () => ++value)
    const options = { key: ['orders'] as const, query }

    const first = client.fetchQuery(options)
    const joined = client.fetchQuery(options, { force: true })
    expect(joined).toBe(first)
    await expect(first).resolves.toBe(1)
    expect(query).toHaveBeenCalledTimes(1)

    now = 4_999
    await expect(client.fetchQuery(options)).resolves.toBe(1)
    expect(query).toHaveBeenCalledTimes(1)

    now = 5_000
    await expect(client.fetchQuery(options)).resolves.toBe(2)
    expect(query).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['scope change', (target: QueryClient) => target.setScope('account-b')],
    ['disposal', (target: QueryClient) => target.dispose()],
  ] as const)('rejects a fresh fetch after clock-triggered %s', async (label, interrupt) => {
    let shouldInterrupt = false

    const client: QueryClient = createClient({
      now: () => {
        if (shouldInterrupt) {
          shouldInterrupt = false
          interrupt(client)
        }
        return 0
      },
      staleTime: Infinity,
    })
    const key = ['fresh-clock', label] as const
    client.setQueryData(key, 'old-scope')
    shouldInterrupt = true
    const query = vi.fn(async () => 'new-scope')

    await expect(client.fetchQuery({ key, query })).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryData<string>(key)).toBeUndefined()
  })

  it('joins a fetch reentered from the fresh clock check', async () => {
    const request = createDeferred<string>()
    const query = vi.fn(() => request.promise)
    const options = { key: ['reentrant-clock-fetch'] as const, query }
    let reentrant: Promise<string> | undefined
    const client: QueryClient = createClient({
      now: () => {
        if (!reentrant) {
          reentrant = client.fetchQuery(options, { force: true })
        }
        return 0
      },
    })

    const result = client.fetchQuery(options)
    expect(reentrant).toBeDefined()
    expect(result).toBe(reentrant)
    expect(query).toHaveBeenCalledTimes(1)

    request.resolve('owned')
    await expect(result).resolves.toBe('owned')
    expect(client.getQueryData<string>(options.key)).toBe('owned')
  })

  it('rejects an older fetch after its clock commits a cache write', async () => {
    let writeOnRead = false

    const key = ['clock-write'] as const
    const client: QueryClient = createClient({
      now: () => {
        if (writeOnRead) {
          writeOnRead = false
          client.setQueryData(key, 'manual')
        }
        return 0
      },
      staleTime: 0,
    })
    const query = vi.fn(async () => 'network')
    writeOnRead = true

    await expect(client.fetchQuery({ key, query })).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryData<string>(key)).toBe('manual')
  })

  it('keeps fetching after a clock-reentered cache updater fails before commit', async () => {
    const failure = new Error('updater failed')
    let updateOnRead = false
    let updaterError: unknown

    const key = ['clock-failed-write'] as const
    const client: QueryClient = createClient({
      now: () => {
        if (updateOnRead) {
          updateOnRead = false
          try {
            client.setQueryData(key, () => {
              throw failure
            })
          }
          catch (error) {
            updaterError = error
          }
        }
        return 0
      },
    })
    const query = vi.fn(async () => 'network')
    updateOnRead = true

    await expect(client.fetchQuery({ key, query })).resolves.toBe('network')
    expect(updaterError).toBe(failure)
    expect(query).toHaveBeenCalledTimes(1)
    expect(client.getQueryData<string>(key)).toBe('network')
  })

  it('rejects a fresh clock failure asynchronously and leaves the entry collectible', async () => {
    vi.useFakeTimers()
    const failure = new Error('clock failed')
    let failClock = false
    const client = createClient({
      gcTime: 0,
      now: () => {
        if (failClock) {
          throw failure
        }
        return 0
      },
      staleTime: Infinity,
    })
    const key = ['fresh-clock-error'] as const
    const query = vi.fn(async () => 'network')
    client.setQueryData(key, 'cached')
    failClock = true
    let result!: Promise<string>

    expect(() => {
      result = client.fetchQuery({ key, query })
    }).not.toThrow()
    await expect(result).rejects.toBe(failure)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryState<string>(key)).toMatchObject({
      data: 'cached',
      error: failure,
      status: 'error',
    })

    vi.advanceTimersByTime(0)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it('revokes an invalidated generation before starting the replacement', async () => {
    const client = createClient()
    const requests = [createDeferred<number>(), createDeferred<number>()]
    const signals: AbortSignal[] = []
    let call = 0
    const options = {
      key: ['orders'] as const,
      query: ({ signal }: { signal: AbortSignal }) => {
        signals.push(signal)
        return requests[call++]!.promise
      },
    }
    const observer = client.observeQuery(options)

    const invalidation = client.invalidateQueries({ key: ['orders'], exact: true })
    expect(signals[0]!.aborted).toBe(true)
    expect(call).toBe(2)

    requests[0]!.resolve(1)
    await Promise.resolve()
    expect(observer.getState()).toMatchObject({ data: undefined, fetchStatus: 'fetching' })

    requests[1]!.resolve(2)
    await expect(invalidation).resolves.toBeUndefined()
    expect(observer.getState()).toMatchObject({ data: 2, invalidated: false, status: 'success' })
  })

  it('pauses offline work and resumes explicit work outside foreground eligibility', async () => {
    const client = createClient()
    const request = createDeferred<string>()
    const query = vi.fn(() => request.promise)
    const options = { key: ['offline'] as const, query }

    client.setOnline(false)
    client.setForeground(false)
    const result = client.fetchQuery(options)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryState(options.key)).toMatchObject({ fetchStatus: 'paused', fetchType: 'query' })

    client.setOnline(true)
    expect(query).toHaveBeenCalledTimes(1)
    request.resolve('ready')
    await expect(result).resolves.toBe('ready')
  })

  it('settles queued cancellation without invoking the query', async () => {
    const client = createClient()
    const query = vi.fn(async () => 'unreachable')
    const options = { key: ['queued'] as const, query }

    client.setOnline(false)
    const result = client.fetchQuery(options)
    client.cancelQueries({ key: options.key, exact: true })

    const error = await result.catch(reason => reason)
    expect(error).toBeInstanceOf(QueryCancelledError)
    expect(isQueryCancelled(error)).toBe(true)
    expect(isQueryCancelled(new Error('other'))).toBe(false)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryState(options.key)).toMatchObject({ fetchStatus: 'idle', status: 'pending' })
  })

  it('settles paused work and scope subscribers during terminal disposal', async () => {
    const client = createClient()
    const versions: number[] = []
    const query = vi.fn(async () => 'unreachable')
    client.subscribeScope(version => versions.push(version))
    client.setOnline(false)
    const result = client.fetchQuery({ key: ['dispose'] as const, query })
    expect(client.isDisposed()).toBe(false)

    client.dispose()
    expect(client.isDisposed()).toBe(true)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).not.toHaveBeenCalled()
    expect(versions).toEqual([1])
    expect(client.getQueryState(['dispose'])).toBeUndefined()
  })

  it('lets a cache write win over an ignored transport completion', async () => {
    const client = createClient()
    const request = createDeferred<number>()
    const key = ['manual'] as const
    const result = client.fetchQuery({ key, query: () => request.promise })

    client.setQueryData(key, 2)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    request.resolve(1)
    await Promise.resolve()
    expect(client.getQueryData<number>(key)).toBe(2)
  })

  it('clears an epoch, resets observers, and rejects late writes', async () => {
    const client = createClient()
    const requests = [createDeferred<number>(), createDeferred<number>()]
    let call = 0
    const options = {
      key: ['session'] as const,
      query: () => requests[call++]!.promise,
    }
    const observer = client.observeQuery(options, { enabled: false })
    const versions: number[] = []
    client.subscribeScope(version => versions.push(version))
    const oldResult = client.fetchQuery(options, { force: true })

    client.clear()
    await expect(oldResult).rejects.toBeInstanceOf(QueryCancelledError)
    expect(versions).toEqual([1])
    expect(observer.getState()).toMatchObject({ data: undefined, fetchStatus: 'idle', status: 'pending' })

    requests[0]!.resolve(1)
    await Promise.resolve()
    expect(client.getQueryData(options.key)).toBeUndefined()

    const currentResult = observer.refresh()
    requests[1]!.resolve(2)
    await expect(currentResult).resolves.toBe(2)
    expect(observer.getState().data).toBe(2)

    client.setScope('account-b')
    client.setScope('account-b')
    expect(versions).toEqual([1, 2])
    expect(observer.getState().hasData).toBe(false)
  })

  it('preserves successful data and timestamp when a background fetch fails', async () => {
    const failure = new Error('network failed')
    const client = createClient({ now: () => 42 })
    const key = ['order', 7] as const
    client.setQueryData<number>(key, 7)

    await expect(client.fetchQuery({ key, query: async () => {
      throw failure
    } }, { force: true }))
      .rejects
      .toBe(failure)

    const state = client.getQueryState<number>(key)
    expect(state).toMatchObject({
      data: 7,
      error: failure,
      hasData: true,
      status: 'error',
      updatedAt: 42,
    })
    expect(Object.isFrozen(state)).toBe(true)
  })

  it('propagates prefetch failures instead of fabricating success', async () => {
    const client = createClient()
    const failure = new Error('prefetch failed')

    await expect(client.prefetchQuery({
      key: ['prefetch'] as const,
      query: async () => {
        throw failure
      },
    })).rejects.toBe(failure)
    expect(client.getQueryState(['prefetch'])).toMatchObject({
      error: failure,
      fetchStatus: 'idle',
      status: 'error',
    })
  })

  it('applies prefix and nested-subset filters to invalidation', async () => {
    const client = createClient()
    const matching = ['orders', { tenant: 1, state: 'open' }, 'list'] as const
    const otherTenant = ['orders', { tenant: 2, state: 'open' }] as const
    client.setQueryData(matching, 'a')
    client.setQueryData(otherTenant, 'b')

    await client.invalidateQueries({ key: ['orders', { tenant: 1 }] })
    expect(client.getQueryState(matching)?.invalidated).toBe(true)
    expect(client.getQueryState(otherTenant)?.invalidated).toBe(false)

    await client.invalidateQueries({ key: ['orders'], exact: true })
    expect(client.getQueryState(otherTenant)?.invalidated).toBe(false)
  })

  it('uses a fetch override only for that invocation', async () => {
    const client = createClient()
    const base = vi.fn(async () => 'base')
    const override = vi.fn(async () => 'override')
    const options = { key: ['override'] as const, query: base }
    const observer = client.observeQuery(options, { enabled: false })

    await expect(client.fetchQuery(options, { force: true, query: override })).resolves.toBe('override')
    await expect(observer.refetch()).resolves.toBe('base')
    expect(override).toHaveBeenCalledTimes(1)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('garbage-collects settled imperative entries at the configured deadline', async () => {
    vi.useFakeTimers()
    const client = createClient({ gcTime: 10 })
    const key = ['temporary'] as const

    await client.fetchQuery({ key, query: async () => 1 })
    vi.advanceTimersByTime(9)
    expect(client.getQueryData<number>(key)).toBe(1)
    vi.advanceTimersByTime(1)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it.each(['updater', 'clock'] as const)(
    'garbage-collects a fresh unobserved entry after its %s throws',
    (failurePoint) => {
      vi.useFakeTimers()
      const failure = new Error(`${failurePoint} failed`)
      const client = createClient({
        gcTime: 10,
        now: failurePoint === 'clock'
          ? () => {
              throw failure
            }
          : undefined,
      })
      const key = ['failed-write', failurePoint] as const
      const write = failurePoint === 'updater'
        ? () => client.setQueryData(key, () => {
            throw failure
          })
        : () => client.setQueryData(key, 'data')

      expect(write).toThrow(failure)
      expect(client.getQueryState(key)).toBeDefined()
      vi.advanceTimersByTime(9)
      expect(client.getQueryState(key)).toBeDefined()
      vi.advanceTimersByTime(1)
      expect(client.getQueryState(key)).toBeUndefined()
    },
  )

  it('garbage-collects a failed unobserved write after cancelling its request', async () => {
    vi.useFakeTimers()
    const failure = new Error('updater failed')
    const client = createClient({ gcTime: 10 })
    const request = createDeferred<number>()
    const key = ['failed-request-write'] as const
    const result = client.fetchQuery({ key, query: () => request.promise })

    expect(() => client.setQueryData<number>(key, () => {
      throw failure
    })).toThrow(failure)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    request.resolve(1)
    await Promise.resolve()
    vi.advanceTimersByTime(9)
    expect(client.getQueryState(key)).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it.each([
    ['same-entry', false],
    ['new-scope', true],
  ] as const)('preserves a newer reentrant %s write and its GC ownership', (_, replaceScope) => {
    vi.useFakeTimers()
    const failure = new Error('outer updater failed')
    const client = createClient({ gcTime: 10 })
    const key = ['reentrant-failed-write', replaceScope] as const

    expect(() => client.setQueryData<number>(key, () => {
      if (replaceScope) {
        client.setScope('account-b')
      }
      client.setQueryData(key, 2)
      vi.advanceTimersByTime(5)
      throw failure
    })).toThrow(failure)

    expect(client.getQueryData<number>(key)).toBe(2)
    vi.advanceTimersByTime(4)
    expect(client.getQueryData<number>(key)).toBe(2)
    vi.advanceTimersByTime(1)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it('retains data across the host timer range until the full GC deadline', async () => {
    vi.useFakeTimers()
    const timerRange = 2_147_483_647
    const client = createClient({ gcTime: timerRange + 50 })
    const key = ['long-retention'] as const

    await client.fetchQuery({ key, query: () => 1 })
    vi.advanceTimersByTime(timerRange)
    expect(client.getQueryData<number>(key)).toBe(1)
    vi.advanceTimersByTime(49)
    expect(client.getQueryData<number>(key)).toBe(1)
    vi.advanceTimersByTime(1)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it('fences a manual write when abort handling clears its scope', async () => {
    const client = createClient()
    const request = createDeferred<string>()
    const key = ['account-write'] as const
    const result = client.fetchQuery({
      key,
      query: ({ signal }) => {
        signal.addEventListener('abort', () => client.clear(), { once: true })
        return request.promise
      },
    })

    expect(() => client.setQueryData(key, 'manual')).toThrow(QueryCancelledError)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(client.getQueryData(key)).toBeUndefined()
    expect(client.getScopeVersion()).toBe(1)
  })

  it('rejects a same-key fetch reentered during a manual write', async () => {
    const client = createClient()
    const request = createDeferred<number>()
    const key = ['reentrant-write'] as const
    let reentrant: Promise<number> | undefined
    const options = {
      key,
      query: vi.fn(({ signal }: { signal: AbortSignal }) => {
        signal.addEventListener('abort', () => {
          reentrant = client.fetchQuery(options, { force: true })
        }, { once: true })
        return request.promise
      }),
    }
    const result = client.fetchQuery(options)

    expect(client.setQueryData(key, 2)).toBe(2)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(reentrant).toBeDefined()
    await expect(reentrant!).rejects.toBeInstanceOf(QueryCancelledError)
    expect(options.query).toHaveBeenCalledTimes(1)
    request.resolve(1)
    await Promise.resolve()
    expect(client.getQueryData<number>(key)).toBe(2)
  })

  it('rejects a same-key fetch reentered from a manual state notification', async () => {
    const client = createClient()
    const key = ['reentrant-write-listener'] as const
    const query = vi.fn(async () => 'query')
    const options = { key, query }
    const observer = client.observeQuery(options, { enabled: false })
    let reentrant: Promise<string> | undefined
    observer.subscribe((state) => {
      if (state.data === 'manual') {
        reentrant = client.fetchQuery(options, { force: true })
      }
    })

    expect(client.setQueryData(key, 'manual')).toBe('manual')
    expect(reentrant).toBeDefined()
    await expect(reentrant!).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).not.toHaveBeenCalled()
    expect(client.getQueryData<string>(key)).toBe('manual')
  })

  it('revokes a manual write when its notification changes scope', () => {
    const client = createClient()
    const key = ['manual-scope'] as const
    const observer = client.observeQuery(
      { key, query: async () => 'query' },
      { enabled: false },
    )
    observer.subscribe((state) => {
      if (state.data === 'manual') {
        client.setScope('account-b')
      }
    })

    expect(() => client.setQueryData(key, 'manual')).toThrow(QueryCancelledError)
    expect(client.getQueryData(key)).toBeUndefined()
    expect(observer.getState()).toMatchObject({ data: undefined, hasData: false })
  })

  it('revokes success settlement when its notification changes scope', async () => {
    const client = createClient()
    const request = createDeferred<string>()
    const observer = client.observeQuery(
      { key: ['success-scope'] as const, query: () => request.promise },
      { enabled: false },
    )
    observer.subscribe((state) => {
      if (state.status === 'success') {
        client.setScope('account-b')
      }
    })
    const result = observer.refresh()

    request.resolve('account-a')
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(observer.getState()).toMatchObject({ data: undefined, hasData: false })
  })

  it('revokes failure settlement when its notification changes scope', async () => {
    const client = createClient()
    const failure = new Error('account-a failure')
    const request = createDeferred<string>()
    const observer = client.observeQuery(
      { key: ['failure-scope'] as const, query: () => request.promise },
      { enabled: false },
    )
    observer.subscribe((state) => {
      if (state.status === 'error') {
        client.setScope('account-b')
      }
    })
    const result = observer.refresh()

    request.reject(failure)
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(observer.getState()).toMatchObject({ error: null, hasData: false, status: 'pending' })
  })

  it('lets peer listeners and settlement finish before reporting a listener error', async () => {
    const reports = captureReportedErrors()
    const client = createClient({ gcTime: Infinity })
    const failure = new Error('consumer-listener-error')
    const options = { key: ['listener-error'] as const, query: async () => 1 }
    const first = client.observeQuery(options, { enabled: false })
    const second = client.observeQuery(options, { enabled: false })
    const received: number[] = []
    first.subscribe((state) => {
      if (state.status === 'success') {
        throw failure
      }
    })
    second.subscribe((state) => {
      if (state.hasData) {
        received.push(state.data!)
      }
    })

    await expect(first.refresh()).resolves.toBe(1)
    expect(received).toEqual([1])
    expect(reports).toHaveLength(1)
    expect(() => reports[0]!()).toThrow(failure)
  })

  it('finishes peer abort cleanup before reporting an abort callback error', async () => {
    const reports = captureReportedErrors()
    const failure = new Error('consumer-abort-error')
    const aborted: number[] = []
    let controllerIndex = 0
    const client = createClient({
      gcTime: Infinity,
      createAbortController: () => {
        const controller = new AbortController()
        const index = controllerIndex++
        return {
          signal: controller.signal,
          abort: (reason) => {
            aborted.push(index)
            controller.abort(reason)
            if (index === 0) {
              throw failure
            }
          },
        }
      },
    })
    const requests = [createDeferred<number>(), createDeferred<number>()]
    const versions: number[] = []
    client.subscribeScope(version => versions.push(version))
    const first = client.fetchQuery({ key: ['abort-a'] as const, query: () => requests[0]!.promise })
    const second = client.fetchQuery({ key: ['abort-b'] as const, query: () => requests[1]!.promise })

    expect(() => client.clear()).not.toThrow()
    await expect(first).rejects.toBeInstanceOf(QueryCancelledError)
    await expect(second).rejects.toBeInstanceOf(QueryCancelledError)
    expect(aborted).toEqual([0, 1])
    expect(versions).toEqual([1])
    expect(client.getQueryState(['abort-a'])).toBeUndefined()
    expect(client.getQueryState(['abort-b'])).toBeUndefined()
    expect(reports).toHaveLength(1)
    expect(() => reports[0]!()).toThrow(failure)
  })

  it('drains the final scope version to every subscriber before disposal', () => {
    const client = createClient()
    const first: number[] = []
    const second: number[] = []
    client.subscribeScope((version) => {
      first.push(version)
      if (version === 1) {
        client.dispose()
      }
    })
    client.subscribeScope(version => second.push(version))

    client.clear()
    expect(first).toEqual([1, 2])
    expect(second).toEqual([2])
    expect(client.isDisposed()).toBe(true)
  })

  it.each([
    [Infinity, 0],
    [0, Infinity],
  ])('keeps the longest retention independent of observer order', (firstGcTime, secondGcTime) => {
    vi.useFakeTimers()
    const client = createClient()
    const key = ['shared-retention'] as const
    const options = { key, query: async () => 1 }
    const first = client.observeQuery({ ...options, gcTime: firstGcTime }, { enabled: false })
    const second = client.observeQuery({ ...options, gcTime: secondGcTime }, { enabled: false })
    client.setQueryData(key, 1)

    first.destroy()
    second.destroy()
    vi.advanceTimersByTime(1_000_000)
    expect(client.getQueryData<number>(key)).toBe(1)
  })

  it('honors an explicit zero retention on a newly configured entry', () => {
    vi.useFakeTimers()
    const client = createClient({ gcTime: 1_000 })
    const key = ['zero-retention'] as const
    const observer = client.observeQuery(
      { key, query: async () => 1, gcTime: 0 },
      { enabled: false },
    )
    client.setQueryData(key, 1)

    observer.destroy()
    vi.advanceTimersByTime(0)
    expect(client.getQueryState(key)).toBeUndefined()
  })
})
