import type { QueryAbortController, QueryObserver, QueryOptions } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from './client'
import { QueryCancelledError } from './errors'
import { fetchObservedQuery } from './observer'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const clients: QueryClient[] = []

function createClient(options: {
  createAbortController?: () => QueryAbortController
  gcTime?: number
  now?: () => number
} = {}): QueryClient {
  const client = new QueryClient({
    ...options,
    createAbortController: options.createAbortController ?? (() => new AbortController()),
  })
  clients.push(client)
  return client
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.dispose()
  }
  vi.useRealTimers()
})

describe('QueryObserver', () => {
  it('keeps a shared request alive until its remaining observer releases it', async () => {
    const client = createClient()
    const request = createDeferred<number>()
    let signal: AbortSignal | undefined
    const options = {
      key: ['shared'] as const,
      query: (context: { signal: AbortSignal }) => {
        signal = context.signal
        return request.promise
      },
    }
    const first = client.observeQuery(options)
    const second = client.observeQuery(options)
    const result = second.refresh()

    first.destroy()
    expect(signal?.aborted).toBe(false)
    request.resolve(7)
    await expect(result).resolves.toBe(7)
    expect(second.getState().data).toBe(7)
  })

  it('cancels observer-owned work when the last observer is destroyed', async () => {
    const client = createClient()
    const request = createDeferred<number>()
    let signal: AbortSignal | undefined
    const observer = client.observeQuery({
      key: ['owned'] as const,
      query: (context) => {
        signal = context.signal
        return request.promise
      },
    })
    const result = observer.refresh()

    observer.destroy()
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(signal?.aborted).toBe(true)
  })

  it('detaches from the old key before abort and ignores its late result', async () => {
    const client = createClient()
    const oldRequest = createDeferred<string>()
    const nextRequest = createDeferred<string>()
    let oldSignal: AbortSignal | undefined
    const initial: QueryOptions<string, readonly ['order', number]> = {
      key: ['order', 1],
      query: ({ signal }) => {
        oldSignal = signal
        return oldRequest.promise
      },
    }
    const observer = client.observeQuery(initial)

    observer.setOptions({
      key: ['order', 2] as const,
      query: () => nextRequest.promise,
    })
    const result = observer.refresh()
    expect(oldSignal?.aborted).toBe(true)

    oldRequest.resolve('old')
    await Promise.resolve()
    expect(observer.getState()).toMatchObject({ data: undefined, fetchStatus: 'fetching' })

    nextRequest.resolve('new')
    await expect(result).resolves.toBe('new')
    expect(observer.getState().data).toBe('new')
  })

  it('does not reattach a stale key when abort handling clears the scope', () => {
    const client = createClient()
    const oldRequest = createDeferred<string>()
    const nextQuery = vi.fn(async () => 'next')
    const initial: QueryOptions<string, readonly ['order', number]> = {
      key: ['order', 1],
      query: ({ signal }) => {
        signal.addEventListener('abort', () => client.clear(), { once: true })
        return oldRequest.promise
      },
    }
    const observer: QueryObserver<string, readonly ['order', number]> = client.observeQuery(initial)

    expect(() => observer.setOptions({
      key: ['order', 2],
      query: nextQuery,
    })).toThrow(QueryCancelledError)
    expect(client.getScopeVersion()).toBe(1)
    expect(observer.getState()).toMatchObject({ data: undefined, fetchStatus: 'idle' })
    expect(nextQuery).not.toHaveBeenCalled()
  })

  it('rejects a fresh observer refresh when its clock clears the owned scope', async () => {
    let clearOnRead = false

    const client: QueryClient = createClient({
      now: () => {
        if (clearOnRead) {
          clearOnRead = false
          client.clear()
        }
        return 0
      },
    })
    const key = ['fresh-observer-clock'] as const
    const query = vi.fn(async () => 'new-scope')
    const observer = client.observeQuery(
      { key, query, staleTime: Infinity },
      { enabled: false },
    )
    client.setQueryData(key, 'old-scope')

    await expect(observer.refresh()).resolves.toBe('old-scope')
    expect(query).not.toHaveBeenCalled()

    clearOnRead = true
    await expect(observer.refresh()).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).not.toHaveBeenCalled()
    expect(observer.getState()).toMatchObject({ data: undefined, hasData: false, status: 'pending' })
    expect(client.getQueryData<string>(key)).toBeUndefined()
  })

  it('surfaces an automatic fresh-clock failure without leaking its observer entry', () => {
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
    })
    const key = ['automatic-clock-error'] as const
    const query = vi.fn(async () => 'network')
    client.setQueryData(key, 'cached')
    failClock = true
    let observer!: QueryObserver<string, typeof key>

    expect(() => {
      observer = client.observeQuery({ key, query, staleTime: Infinity })
    }).not.toThrow()
    expect(query).not.toHaveBeenCalled()
    expect(observer.getState()).toMatchObject({
      data: 'cached',
      error: failure,
      hasData: true,
      status: 'error',
    })

    observer.destroy()
    vi.advanceTimersByTime(0)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it('preserves a reentrant fetch when an automatic clock callback throws', async () => {
    const failure = new Error('clock failed')
    const request = createDeferred<string>()
    const query = vi.fn(() => request.promise)
    const options = { key: ['automatic-reentrant-clock'] as const, query }
    let reenter = true
    let reentrant: Promise<string> | undefined

    const client: QueryClient = createClient({
      now: () => {
        if (reenter) {
          reenter = false
          reentrant = client.fetchQuery(options, { force: true })
          throw failure
        }
        return 0
      },
    })
    let observer!: QueryObserver<string, typeof options.key>

    expect(() => {
      observer = client.observeQuery(options)
    }).not.toThrow()
    expect(reentrant).toBeDefined()
    expect(query).toHaveBeenCalledTimes(1)
    expect(observer.getState()).toMatchObject({ error: null, fetchStatus: 'fetching' })

    request.resolve('owned')
    await expect(reentrant!).resolves.toBe('owned')
    expect(observer.getState()).toMatchObject({
      data: 'owned',
      error: null,
      status: 'success',
    })
  })

  it('requires visibility for automatic work but not an initial visible activation', async () => {
    const client = createClient()
    const request = createDeferred<number>()
    const query = vi.fn(() => request.promise)
    const observer = client.observeQuery(
      { key: ['visible'] as const, query },
      { active: false, refetchOnShow: false },
    )

    expect(query).not.toHaveBeenCalled()
    observer.setActive(true)
    expect(query).toHaveBeenCalledTimes(1)
    request.resolve(1)
    await expect(observer.refresh()).resolves.toBe(1)

    observer.setActive(false)
    observer.setActive(true)
    client.setForeground(false)
    client.setForeground(true)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('does not replay pre-clear options until key or enabled changes', async () => {
    const client = createClient()
    const query = vi.fn(async () => 1)
    const observer = client.observeQuery({ key: ['scope'] as const, query })
    await observer.refresh()
    expect(query).toHaveBeenCalledTimes(1)

    client.clear()
    client.setForeground(false)
    client.setForeground(true)
    expect(query).toHaveBeenCalledTimes(1)
    expect(observer.getState().hasData).toBe(false)

    observer.setEnabled(false)
    observer.setEnabled(true)
    await observer.refresh()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('refetch cancels the previous generation while ordinary refresh joins it', async () => {
    const client = createClient()
    const requests = [createDeferred<number>(), createDeferred<number>()]
    const signals: AbortSignal[] = []
    let call = 0
    const observer = client.observeQuery({
      key: ['refetch'] as const,
      query: ({ signal }) => {
        signals.push(signal)
        return requests[call++]!.promise
      },
    })
    const joined = observer.refresh()
    const replacement = observer.refetch()

    await expect(joined).rejects.toBeInstanceOf(QueryCancelledError)
    expect(signals[0]!.aborted).toBe(true)
    requests[0]!.resolve(1)
    await Promise.resolve()
    expect(observer.getState().data).toBeUndefined()

    requests[1]!.resolve(2)
    await expect(replacement).resolves.toBe(2)
    expect(observer.getState().data).toBe(2)
  })

  it('keeps observed data past GC and starts the deadline after destroy', () => {
    vi.useFakeTimers()
    const client = createClient({ gcTime: 10 })
    const key = ['retained'] as const
    const observer = client.observeQuery({ key, query: async () => 1 }, { enabled: false })
    client.setQueryData(key, 1)

    vi.advanceTimersByTime(100)
    expect(client.getQueryData<number>(key)).toBe(1)
    observer.destroy()
    vi.advanceTimersByTime(9)
    expect(client.getQueryData<number>(key)).toBe(1)
    vi.advanceTimersByTime(1)
    expect(client.getQueryState(key)).toBeUndefined()
  })

  it('skips stale delivery to later listeners after a reentrant cache write', () => {
    const client = createClient()
    const key = ['reentrant'] as const
    const observer = client.observeQuery({ key, query: async () => 'query' }, { enabled: false })
    const received: string[] = []

    observer.subscribe((state) => {
      if (state.data === 'first') {
        client.setQueryData(key, 'second')
      }
    })
    observer.subscribe((state) => {
      if (state.hasData) {
        received.push(state.data!)
      }
    })

    client.setQueryData(key, 'first')
    expect(received).toEqual(['second'])
    expect(observer.getState().data).toBe('second')
  })

  it('does not invoke a detached replacement after abort changes scope', async () => {
    const client = createClient()
    const request = createDeferred<string>()
    const query = vi.fn(({ signal }: { signal: AbortSignal }) => {
      signal.addEventListener('abort', () => client.clear(), { once: true })
      return request.promise
    })
    const observer = client.observeQuery({ key: ['detached-refetch'] as const, query })

    await expect(observer.refetch()).rejects.toBeInstanceOf(QueryCancelledError)
    expect(query).toHaveBeenCalledTimes(1)
    expect(observer.getState()).toMatchObject({ data: undefined, fetchStatus: 'idle' })
  })

  it('keeps the latest reentrant rebind as the only observer attachment', async () => {
    vi.useFakeTimers()
    const client = createClient({ gcTime: 0 })
    const calls: string[] = []
    let observer!: QueryObserver<string, readonly ['rebind', string]>
    const initial: QueryOptions<string, readonly ['rebind', string]> = {
      key: ['rebind', 'a'],
      query: ({ signal }) => {
        calls.push('a')
        signal.addEventListener('abort', () => {
          observer.setOptions({
            key: ['rebind', 'c'],
            query: async () => {
              calls.push('c')
              return 'c'
            },
          })
        }, { once: true })
        return new Promise<string>(() => undefined)
      },
    }
    observer = client.observeQuery(initial)

    observer.setOptions({
      key: ['rebind', 'b'],
      query: async () => {
        calls.push('b')
        return 'b'
      },
    })
    await expect(observer.refresh()).resolves.toBe('c')
    expect(calls).toEqual(['a', 'c'])
    expect(observer.getState().data).toBe('c')

    observer.destroy()
    vi.runAllTimers()
    expect(client.getQueryState(['rebind', 'b'])).toBeUndefined()
    expect(client.getQueryState(['rebind', 'c'])).toBeUndefined()
  })

  it('keeps a paused observer request and its controller across reentrant offline transitions', async () => {
    const controllers: AbortController[] = []
    const client: QueryClient = createClient({
      createAbortController: () => {
        const controller = new AbortController()
        controllers.push(controller)
        if (controllers.length === 1) {
          client.setOnline(false)
        }
        return controller
      },
    })
    const request = createDeferred<string>()
    let querySignal: AbortSignal | undefined
    const query = vi.fn(({ signal }: { signal: AbortSignal }) => {
      querySignal = signal
      return request.promise
    })
    const observer = client.observeQuery(
      { key: ['reentrant-offline'] as const, query },
      { enabled: false },
    )
    let fetchingNotifications = 0
    observer.subscribe((state) => {
      if (state.fetchStatus === 'fetching' && fetchingNotifications < 2) {
        fetchingNotifications++
        client.setOnline(false)
      }
    })

    const result = observer.refresh()
    expect(fetchingNotifications).toBe(1)
    expect(observer.getState()).toMatchObject({ fetchStatus: 'paused', fetchType: 'query' })
    expect(controllers).toHaveLength(0)
    expect(query).not.toHaveBeenCalled()

    client.setOnline(true)
    expect(fetchingNotifications).toBe(2)
    expect(observer.getState()).toMatchObject({ fetchStatus: 'paused', fetchType: 'query' })
    expect(controllers).toHaveLength(0)
    expect(query).not.toHaveBeenCalled()

    client.setOnline(true)
    expect(observer.getState()).toMatchObject({ fetchStatus: 'paused', fetchType: 'query' })
    expect(controllers).toHaveLength(1)
    expect(query).not.toHaveBeenCalled()

    client.setOnline(true)
    expect(controllers).toHaveLength(1)
    expect(query).toHaveBeenCalledTimes(1)
    expect(querySignal).toBe(controllers[0]!.signal)

    observer.destroy()
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    expect(controllers[0]!.signal.aborted).toBe(true)
  })

  it('resumes an explicit offline refresh without automatic eligibility', async () => {
    const client = createClient()
    const request = createDeferred<string>()
    const query = vi.fn(() => request.promise)
    client.setOnline(false)
    const observer = client.observeQuery(
      { key: ['manual-offline'] as const, query },
      { active: false, enabled: false },
    )

    const result = observer.refresh()
    expect(query).not.toHaveBeenCalled()
    expect(observer.getState().fetchStatus).toBe('paused')
    client.setOnline(true)
    expect(query).toHaveBeenCalledTimes(1)
    request.resolve('ready')
    await expect(result).resolves.toBe('ready')
  })

  it('cancels observed queued work when its observer is destroyed', async () => {
    const client = createClient()
    const query = vi.fn(async () => 'unreachable')
    client.setOnline(false)
    const observer = client.observeQuery(
      { key: ['observed-offline'] as const, query },
      { active: false },
    )
    const result = fetchObservedQuery(observer, {
      cancelRefetch: false,
      force: true,
    })

    observer.destroy()
    await expect(result).rejects.toBeInstanceOf(QueryCancelledError)
    await expect(fetchObservedQuery(observer, { force: true }))
      .rejects
      .toBeInstanceOf(QueryCancelledError)
    client.setOnline(true)
    expect(query).not.toHaveBeenCalled()
  })
})
