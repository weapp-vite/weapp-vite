export type QueryKey = readonly unknown[]

declare const queryDataTag: unique symbol

interface QueryDataTag<TData> {
  readonly data: TData
  readonly invariant: (data: TData) => TData
}

export type TaggedQueryKey<TKey extends QueryKey, TData> = TKey & {
  readonly [queryDataTag]: QueryDataTag<TData>
}
export type UntaggedQueryKey = QueryKey & {
  readonly [queryDataTag]?: never
}
export type QueryDataOf<TKey extends QueryKey> = TKey extends {
  readonly [queryDataTag]: { readonly data: infer TData }
} ? TData : unknown

type QueryKeyForData<TData, TKey extends QueryKey>
  = TKey & (UntaggedQueryKey | TaggedQueryKey<QueryKey, TData>)

export type Awaitable<T> = T | Promise<T>
export type Unsubscribe = () => void
export type DataStatus = 'pending' | 'success' | 'error'
export type FetchStatus = 'idle' | 'fetching' | 'paused'
export type RefetchOnShow = 'stale' | 'always' | false
export type FetchType = 'query' | 'nextPage'

export interface QueryAbortController {
  readonly signal: AbortSignal
  abort: (reason?: unknown) => void
}

export interface QueryContext<TKey extends QueryKey = QueryKey> {
  readonly key: TKey
  readonly signal: AbortSignal
}

export interface QueryOptions<TData, TKey extends QueryKey = QueryKey> {
  key: QueryKeyForData<TData, TKey>
  query: (context: QueryContext<TKey>) => Awaitable<TData>
  staleTime?: number
  gcTime?: number
}

export interface QueryState<TData> {
  readonly data: TData | undefined
  readonly hasData: boolean
  readonly error: unknown
  readonly status: DataStatus
  readonly fetchStatus: FetchStatus
  readonly fetchType: FetchType | null
  readonly updatedAt: number
  readonly invalidated: boolean
}

export interface QueryObserverOptions {
  enabled?: boolean
  active?: boolean
  refetchOnShow?: RefetchOnShow
}

export interface QueryObserver<TData, TKey extends QueryKey = QueryKey> {
  getState: () => QueryState<TData>
  subscribe: (listener: (state: QueryState<TData>) => void) => Unsubscribe
  setOptions: (options: QueryOptions<TData, TKey>, observerOptions?: QueryObserverOptions) => void
  setActive: (active: boolean) => void
  setEnabled: (enabled: boolean) => void
  refresh: () => Promise<TData>
  refetch: () => Promise<TData>
  destroy: () => void
}

export interface QueryFilter {
  key?: QueryKey
  exact?: boolean
}

export interface FetchOptions<TData, TKey extends QueryKey = QueryKey> {
  force?: boolean
  cancelRefetch?: boolean
  query?: QueryOptions<TData, TKey>['query']
  fetchType?: FetchType
}

export interface QueryClientOptions {
  staleTime?: number
  gcTime?: number
  scope?: string
  now?: () => number
  createAbortController?: () => QueryAbortController
}

export interface QueryClientConfig extends QueryClientOptions {
  createAbortController: () => QueryAbortController
}

export interface MutationOptions<TData, TVariables> {
  mutation: (variables: TVariables) => Awaitable<TData>
  onSuccess?: (data: TData, variables: TVariables) => Awaitable<void>
  onError?: (error: unknown, variables: TVariables) => Awaitable<void>
  onSettled?: (data: TData | undefined, error: unknown, variables: TVariables) => Awaitable<void>
}

export interface MutationState<TData, TVariables> {
  readonly status: 'idle' | 'pending' | 'success' | 'error'
  readonly data: TData | undefined
  readonly error: unknown
  readonly variables: TVariables | undefined
}

export interface MutationController<TData, TVariables> {
  getState: () => MutationState<TData, TVariables>
  subscribe: (listener: (state: MutationState<TData, TVariables>) => void) => Unsubscribe
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  reset: () => void
  destroy: () => void
}

export interface InfiniteData<TPage, TPageParam> {
  readonly pages: readonly TPage[]
  readonly pageParams: readonly TPageParam[]
}

export interface InfiniteQueryContext<TPageParam, TKey extends QueryKey = QueryKey> extends QueryContext<TKey> {
  readonly pageParam: TPageParam
}

export interface InfiniteQueryOptions<TPage, TPageParam, TKey extends QueryKey = QueryKey> {
  key: QueryKeyForData<InfiniteData<TPage, TPageParam>, TKey>
  query: (context: InfiniteQueryContext<TPageParam, TKey>) => Awaitable<TPage>
  initialPageParam: TPageParam
  getNextPageParam: (
    lastPage: TPage,
    pages: readonly TPage[],
    lastPageParam: TPageParam,
    pageParams: readonly TPageParam[],
  ) => TPageParam | null | undefined
  staleTime?: number
  gcTime?: number
  maxPages?: number
}

export interface InfiniteQueryObserver<TPage, TPageParam, TKey extends QueryKey = QueryKey> {
  getState: () => QueryState<InfiniteData<TPage, TPageParam>>
  subscribe: (listener: (state: QueryState<InfiniteData<TPage, TPageParam>>) => void) => Unsubscribe
  setOptions: (options: InfiniteQueryOptions<TPage, TPageParam, TKey>, observerOptions?: QueryObserverOptions) => void
  setActive: (active: boolean) => void
  setEnabled: (enabled: boolean) => void
  refresh: () => Promise<InfiniteData<TPage, TPageParam>>
  refetch: () => Promise<InfiniteData<TPage, TPageParam>>
  fetchNextPage: () => Promise<InfiniteData<TPage, TPageParam>>
  hasNextPage: () => boolean
  destroy: () => void
}
