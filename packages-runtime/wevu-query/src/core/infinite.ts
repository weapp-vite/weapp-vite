import type { QueryClient } from './client'
import type {
  InfiniteData,
  InfiniteQueryObserver,
  InfiniteQueryOptions,
  QueryObserverOptions,
  QueryOptions,
} from './types'
import { QueryCancelledError } from './errors'
import { snapshotQueryKey } from './keys'
import { fetchObservedQuery } from './observer'

type InfiniteOptionsSnapshot<TPage, TPageParam, TKey extends readonly unknown[]>
  = Readonly<InfiniteQueryOptions<TPage, TPageParam, TKey>>

function snapshotOptions<TPage, TPageParam, TKey extends readonly unknown[]>(
  options: InfiniteQueryOptions<TPage, TPageParam, TKey>,
): InfiniteOptionsSnapshot<TPage, TPageParam, TKey> {
  const maxPages = options.maxPages
  if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages <= 0)) {
    throw new RangeError('maxPages 必须是正整数')
  }
  return Object.freeze({
    key: snapshotQueryKey(options.key),
    query: options.query,
    initialPageParam: options.initialPageParam,
    getNextPageParam: options.getNextPageParam,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    maxPages,
  })
}

function createBaseOptions<TPage, TPageParam, TKey extends readonly unknown[]>(
  options: InfiniteOptionsSnapshot<TPage, TPageParam, TKey>,
): QueryOptions<InfiniteData<TPage, TPageParam>, TKey> {
  return {
    key: options.key,
    query: async ({ key, signal }) => {
      const pageParam = options.initialPageParam
      const page = await options.query({ key, signal, pageParam })
      return {
        pages: [page],
        pageParams: [pageParam],
      }
    },
    staleTime: options.staleTime,
    gcTime: options.gcTime,
  }
}

function assertPairedPages<TPage, TPageParam>(
  data: InfiniteData<TPage, TPageParam>,
): void {
  if (data.pages.length !== data.pageParams.length) {
    throw new Error('无限查询的 pages 与 pageParams 必须成对')
  }
}

function appendPage<TPage, TPageParam>(
  data: InfiniteData<TPage, TPageParam>,
  page: TPage,
  pageParam: TPageParam,
  maxPages: number | undefined,
): InfiniteData<TPage, TPageParam> {
  assertPairedPages(data)
  const start = maxPages !== undefined && data.pages.length >= maxPages
    ? data.pages.length - maxPages + 1
    : 0
  return {
    pages: [...data.pages.slice(start), page],
    pageParams: [...data.pageParams.slice(start), pageParam],
  }
}

/**
 * 在 QueryClient 的同一缓存条目上观察分页数据。
 * 普通刷新重置首页，追加请求通过一次性查询覆盖共享去重。
 */
export function observeInfiniteQuery<
  TPage,
  TPageParam,
  TKey extends readonly unknown[],
>(
  client: QueryClient,
  options: InfiniteQueryOptions<TPage, TPageParam, TKey>,
  observerOptions?: QueryObserverOptions,
): InfiniteQueryObserver<TPage, TPageParam, TKey> {
  let currentOptions = snapshotOptions(options)
  let currentBaseOptions = createBaseOptions(currentOptions)
  const observer = client.observeQuery(currentBaseOptions, observerOptions)
  let destroyed = false

  const fetchNextPage = async (): Promise<InfiniteData<TPage, TPageParam>> => {
    if (destroyed) {
      throw new Error('InfiniteQueryObserver 已销毁')
    }
    if (client.isDisposed()) {
      throw new QueryCancelledError()
    }
    const operationOptions = currentOptions
    const scopeVersion = client.getScopeVersion()
    const observedState = observer.getState()
    const observedData = observedState.data
    let mode: 'append' | 'initial' | 'join' = 'join'
    let pageParam: TPageParam | undefined
    let dataSnapshot: InfiniteData<TPage, TPageParam> | undefined
    let shouldReturnExisting = false

    if (!observedState.hasData || observedData === undefined) {
      mode = 'initial'
      pageParam = operationOptions.initialPageParam
    }
    else if (observedData.pages.length === 0) {
      assertPairedPages(observedData)
      shouldReturnExisting = observedState.fetchStatus === 'idle'
    }
    else {
      assertPairedPages(observedData)
      const pages = observedData.pages.slice()
      const pageParams = observedData.pageParams.slice()
      const lastIndex = pages.length - 1
      const nextPageParam = operationOptions.getNextPageParam(
        pages[lastIndex] as TPage,
        pages,
        pageParams[lastIndex] as TPageParam,
        pageParams,
      )
      if (nextPageParam === null || nextPageParam === undefined) {
        shouldReturnExisting = observedState.fetchStatus === 'idle'
      }
      else {
        mode = 'append'
        pageParam = nextPageParam
        dataSnapshot = { pages, pageParams }
      }
    }

    const currentState = observer.getState()
    if (
      destroyed
      || client.isDisposed()
      || client.getScopeVersion() !== scopeVersion
      || currentOptions !== operationOptions
      || currentState.data !== observedState.data
      || currentState.hasData !== observedState.hasData
      || currentState.status !== observedState.status
      || currentState.fetchStatus !== observedState.fetchStatus
      || currentState.fetchType !== observedState.fetchType
      || currentState.updatedAt !== observedState.updatedAt
      || currentState.invalidated !== observedState.invalidated
    ) {
      throw new QueryCancelledError()
    }
    if (shouldReturnExisting) {
      return observedData as InfiniteData<TPage, TPageParam>
    }

    const appendOverride: QueryOptions<InfiniteData<TPage, TPageParam>, TKey>['query'] = async ({ key, signal }) => {
      if (client.getScopeVersion() !== scopeVersion || mode === 'join') {
        throw new QueryCancelledError()
      }
      const requestedPageParam = pageParam as TPageParam
      const page = await operationOptions.query({ key, signal, pageParam: requestedPageParam })
      if (mode === 'initial') {
        return {
          pages: [page],
          pageParams: [requestedPageParam],
        }
      }
      return appendPage(
        dataSnapshot as InfiniteData<TPage, TPageParam>,
        page,
        requestedPageParam,
        operationOptions.maxPages,
      )
    }

    return fetchObservedQuery(observer, {
      force: true,
      cancelRefetch: false,
      fetchType: 'nextPage',
      query: appendOverride,
    })
  }

  return {
    getState() {
      return observer.getState()
    },
    subscribe(listener) {
      return observer.subscribe(listener)
    },
    setOptions(nextOptions, nextObserverOptions) {
      const nextSnapshot = snapshotOptions(nextOptions)
      const nextBaseOptions = createBaseOptions(nextSnapshot)
      const previousOptions = currentOptions
      const previousBaseOptions = currentBaseOptions
      currentOptions = nextSnapshot
      currentBaseOptions = nextBaseOptions
      try {
        observer.setOptions(nextBaseOptions, nextObserverOptions)
      }
      catch (error) {
        currentOptions = previousOptions
        currentBaseOptions = previousBaseOptions
        throw error
      }
    },
    setActive(active) {
      observer.setActive(active)
    },
    setEnabled(enabled) {
      observer.setEnabled(enabled)
    },
    refresh() {
      return observer.refresh()
    },
    refetch() {
      return observer.refetch()
    },
    fetchNextPage,
    hasNextPage() {
      if (client.isDisposed()) {
        return false
      }
      const data = observer.getState().data
      if (data === undefined || data.pages.length === 0) {
        return false
      }
      assertPairedPages(data)
      const lastIndex = data.pages.length - 1
      const nextPageParam = currentOptions.getNextPageParam(
        data.pages[lastIndex] as TPage,
        data.pages,
        data.pageParams[lastIndex] as TPageParam,
        data.pageParams,
      )
      return nextPageParam !== null && nextPageParam !== undefined
    },
    destroy() {
      destroyed = true
      observer.destroy()
    },
  }
}
