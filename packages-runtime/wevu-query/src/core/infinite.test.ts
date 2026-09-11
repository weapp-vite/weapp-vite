import type {
  InfiniteQueryOptions,
  QueryAbortController,
} from './types'
import { AbortControllerPolyfill } from '@wevu/web-apis/abort'
import { afterEach, describe, expect, it } from 'vitest'
import { QueryClient } from './client'
import { isQueryCancelled } from './errors'
import { observeInfiniteQuery } from './infinite'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

interface Page {
  cursor: number
  label: string
  next: number | null
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const clients: QueryClient[] = []

function createClient(): QueryClient {
  const client = new QueryClient({
    createAbortController: () => new AbortControllerPolyfill() as unknown as QueryAbortController,
    gcTime: Infinity,
  })
  clients.push(client)
  return client
}

function createOptions(
  key: readonly unknown[],
  query: InfiniteQueryOptions<Page, number, readonly unknown[]>['query'],
): InfiniteQueryOptions<Page, number, readonly unknown[]> {
  return {
    key,
    query,
    initialPageParam: -1,
    getNextPageParam: page => page.next,
    gcTime: Infinity,
  }
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.dispose()
  }
})

describe('observeInfiniteQuery', () => {
  it('accepts a zero cursor, trims paired pages, returns no-next without I/O, and refreshes from page one', async () => {
    const client = createClient()
    const requested: number[] = []
    const observer = observeInfiniteQuery(client, {
      ...createOptions(['feed'], async ({ pageParam }) => {
        requested.push(pageParam)
        return {
          cursor: pageParam,
          label: `page-${pageParam}`,
          next: pageParam === -1 ? 0 : pageParam === 0 ? 1 : null,
        }
      }),
      maxPages: 2,
    }, { enabled: false })

    await observer.refetch()
    expect(observer.hasNextPage()).toBe(true)
    await observer.fetchNextPage()
    await observer.fetchNextPage()
    expect(requested).toEqual([-1, 0, 1])
    expect(observer.getState().data).toEqual({
      pages: [
        { cursor: 0, label: 'page-0', next: 1 },
        { cursor: 1, label: 'page-1', next: null },
      ],
      pageParams: [0, 1],
    })

    const terminalData = observer.getState().data
    await expect(observer.fetchNextPage()).resolves.toBe(terminalData)
    expect(requested).toEqual([-1, 0, 1])

    await observer.refetch()
    expect(observer.getState().data).toEqual({
      pages: [{ cursor: -1, label: 'page--1', next: 0 }],
      pageParams: [-1],
    })
  })

  it('returns exhausted data only while the client is live and skips dead-client callbacks', async () => {
    const client = createClient()
    const requested: number[] = []
    let pageParamCalls = 0
    const observer = observeInfiniteQuery(client, {
      ...createOptions(['client-disposed-terminal-feed'], async ({ pageParam }) => {
        requested.push(pageParam)
        return { cursor: pageParam, label: 'terminal', next: null }
      }),
      getNextPageParam(page) {
        pageParamCalls++
        return page.next
      },
    }, { enabled: false })

    await observer.refetch()
    const terminalData = observer.getState().data
    await expect(observer.fetchNextPage()).resolves.toBe(terminalData)
    expect(pageParamCalls).toBe(1)

    client.dispose()
    expect(observer.hasNextPage()).toBe(false)
    const disposedResult = await observer.fetchNextPage().then(
      data => data,
      error => error,
    )
    expect(isQueryCancelled(disposedResult)).toBe(true)
    expect(pageParamCalls).toBe(1)
    expect(requested).toEqual([-1])
  })

  it('coalesces repeated and cross-observer append requests in the shared cache', async () => {
    const client = createClient()
    const append = createDeferred<Page>()
    const requested: number[] = []
    const options = createOptions(['shared-feed'], ({ pageParam }) => {
      requested.push(pageParam)
      if (pageParam === -1) {
        return { cursor: -1, label: 'initial', next: 0 }
      }
      return append.promise
    })
    const first = observeInfiniteQuery(client, options, { enabled: false })
    const second = observeInfiniteQuery(client, options, { enabled: false })

    await first.refetch()
    const firstAppend = first.fetchNextPage()
    const repeatedAppend = first.fetchNextPage()
    const sharedAppend = second.fetchNextPage()
    expect(requested).toEqual([-1, 0])
    expect(first.getState().fetchType).toBe('nextPage')
    expect(second.getState().fetchType).toBe('nextPage')

    append.resolve({ cursor: 0, label: 'shared-next', next: null })
    const results = await Promise.all([firstAppend, repeatedAppend, sharedAppend])
    expect(results[0]).toEqual(results[1])
    expect(results[1]).toEqual(results[2])
    expect(second.getState().data?.pages.map(page => page.label)).toEqual([
      'initial',
      'shared-next',
    ])
  })

  it('cancels queued pagination when the last observer is destroyed before reconnect', async () => {
    const client = createClient()
    const requested: number[] = []
    const observer = observeInfiniteQuery(client, createOptions(['offline-feed'], async ({ pageParam }) => {
      requested.push(pageParam)
      return { cursor: pageParam, label: `page-${pageParam}`, next: pageParam + 1 }
    }), { enabled: false })

    await observer.refetch()
    client.setOnline(false)
    const appendResult = observer.fetchNextPage().catch(error => error)
    observer.destroy()
    client.setOnline(true)

    expect(isQueryCancelled(await appendResult)).toBe(true)
    expect(requested).toEqual([-1])
  })

  it('keeps queued shared pagination while another observer still owns the entry', async () => {
    const client = createClient()
    const append = createDeferred<Page>()
    const requested: number[] = []
    const options = createOptions(['shared-offline-feed'], ({ pageParam }) => {
      requested.push(pageParam)
      if (pageParam === -1) {
        return { cursor: -1, label: 'initial', next: 0 }
      }
      return append.promise
    })
    const first = observeInfiniteQuery(client, options, { enabled: false })
    const second = observeInfiniteQuery(client, options, { enabled: false })

    await first.refetch()
    client.setOnline(false)
    const abandonedResult = first.fetchNextPage().catch(error => error)
    const sharedResult = second.fetchNextPage()
    first.destroy()
    client.setOnline(true)
    expect(requested).toEqual([-1, 0])

    append.resolve({ cursor: 0, label: 'shared-next', next: null })
    await expect(sharedResult).resolves.toMatchObject({
      pages: [{ label: 'initial' }, { label: 'shared-next' }],
      pageParams: [-1, 0],
    })
    await abandonedResult
    expect(second.getState().data?.pages.map(page => page.label)).toEqual([
      'initial',
      'shared-next',
    ])
  })

  it('lets refetch revoke an old append even when its transport ignores abort', async () => {
    const client = createClient()
    const append = createDeferred<Page>()
    const refresh = createDeferred<Page>()
    let initialLoads = 0
    const observer = observeInfiniteQuery(client, createOptions(['racing-feed'], ({ pageParam }) => {
      if (pageParam === 0) {
        return append.promise
      }
      if (initialLoads++ === 0) {
        return { cursor: -1, label: 'old-first', next: 0 }
      }
      return refresh.promise
    }), { enabled: false })

    await observer.refetch()
    const appendResult = observer.fetchNextPage().then(
      data => data,
      error => error,
    )
    const refreshResult = observer.refetch()
    refresh.resolve({ cursor: -1, label: 'fresh-first', next: null })
    await expect(refreshResult).resolves.toMatchObject({
      pages: [{ label: 'fresh-first' }],
      pageParams: [-1],
    })

    append.resolve({ cursor: 0, label: 'stale-append', next: null })
    expect(isQueryCancelled(await appendResult)).toBe(true)
    expect(observer.getState().data?.pages.map(page => page.label)).toEqual(['fresh-first'])
  })

  it('does not return or append an old cursor snapshot after a reentrant session change', async () => {
    const client = createClient()
    const requested: number[] = []
    let changeSession = false
    const observer = observeInfiniteQuery(client, {
      ...createOptions(['reentrant-session'], async ({ pageParam }) => {
        requested.push(pageParam)
        return { cursor: pageParam, label: 'first', next: null }
      }),
      getNextPageParam() {
        if (changeSession) {
          client.clear()
        }
        return null
      },
    }, { enabled: false })

    await observer.refetch()
    changeSession = true
    const result = await observer.fetchNextPage().then(
      data => data,
      error => error,
    )
    expect(isQueryCancelled(result)).toBe(true)
    expect(requested).toEqual([-1])
    expect(observer.getState().hasData).toBe(false)
  })

  it('keeps old filter and cleared-session completions out of the current observer', async () => {
    const client = createClient()
    const oldFilter = createDeferred<Page>()
    const nextFilter = createDeferred<Page>()
    const oldOptions = createOptions(['filtered-feed', 'old'], () => oldFilter.promise)
    const nextOptions = createOptions(['filtered-feed', 'next'], () => nextFilter.promise)
    const observer = observeInfiniteQuery(client, oldOptions, { enabled: false })

    const oldResult = observer.refetch().then(
      data => data,
      error => error,
    )
    observer.setOptions(nextOptions, { enabled: false })
    const nextResult = observer.refetch()
    nextFilter.resolve({ cursor: -1, label: 'next-filter', next: null })
    await nextResult
    oldFilter.resolve({ cursor: -1, label: 'old-filter', next: null })
    await oldResult
    expect(observer.getState().data?.pages.map(page => page.label)).toEqual(['next-filter'])

    const append = createDeferred<Page>()
    observer.setOptions(createOptions(['cleared-feed'], ({ pageParam }) => {
      if (pageParam === -1) {
        return { cursor: -1, label: 'before-clear', next: 0 }
      }
      return append.promise
    }), { enabled: false })
    await observer.refetch()
    const clearedAppend = observer.fetchNextPage().then(
      data => data,
      error => error,
    )
    client.clear()
    expect(observer.getState().hasData).toBe(false)
    append.resolve({ cursor: 0, label: 'after-clear', next: null })
    expect(isQueryCancelled(await clearedAppend)).toBe(true)
    expect(observer.getState().hasData).toBe(false)
  })

  it('rejects pagination after its observer has been destroyed without issuing another request', async () => {
    const client = createClient()
    const requested: number[] = []
    const observer = observeInfiniteQuery(client, createOptions(['disposed-feed'], async ({ pageParam }) => {
      requested.push(pageParam)
      return { cursor: pageParam, label: 'page', next: pageParam + 1 }
    }), { enabled: false })

    await observer.refetch()
    observer.destroy()
    await expect(observer.fetchNextPage()).rejects.toBeInstanceOf(Error)
    expect(requested).toEqual([-1])
  })
})
