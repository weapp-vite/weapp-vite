import type { ComputedRef, MaybeRefOrGetter } from 'wevu'
import type {
  DataStatus,
  FetchStatus,
  FetchType,
  InfiniteData,
  InfiniteQueryOptions,
  MutationOptions,
  QueryKey,
  QueryOptions,
  RefetchOnShow,
} from '../core/types'

/** 查询绑定共享的只读状态引用。 */
export interface QueryStateRefs<TData> {
  readonly data: ComputedRef<TData | undefined>
  readonly hasData: ComputedRef<boolean>
  readonly error: ComputedRef<unknown>
  readonly status: ComputedRef<DataStatus>
  readonly fetchStatus: ComputedRef<FetchStatus>
  readonly fetchType: ComputedRef<FetchType | null>
  readonly updatedAt: ComputedRef<number>
  readonly invalidated: ComputedRef<boolean>
  readonly isPending: ComputedRef<boolean>
  readonly isFetching: ComputedRef<boolean>
  readonly isRefreshing: ComputedRef<boolean>
  readonly isPaused: ComputedRef<boolean>
}

/** `useQuery()` 接受的响应式查询配置。 */
export interface UseQueryOptions<
  TQueryData,
  TData = TQueryData,
  TKey extends QueryKey = QueryKey,
> extends Omit<QueryOptions<TQueryData, TKey>, 'key'> {
  key: MaybeRefOrGetter<TKey> & MaybeRefOrGetter<QueryOptions<TQueryData, TKey>['key']>
  enabled?: MaybeRefOrGetter<boolean>
  refetchOnShow?: RefetchOnShow
  select?: (data: TQueryData) => TData
}

/** `useQuery()` 返回的状态和控制方法。 */
export interface UseQueryResult<TQueryData, TData = TQueryData> extends QueryStateRefs<TData> {
  readonly refresh: () => Promise<TQueryData>
  readonly refetch: () => Promise<TQueryData>
}

/** `useInfiniteQuery()` 接受的响应式分页查询配置。 */
export interface UseInfiniteQueryOptions<
  TPage,
  TPageParam,
  TKey extends QueryKey = QueryKey,
> extends Omit<InfiniteQueryOptions<TPage, TPageParam, TKey>, 'key'> {
  key: MaybeRefOrGetter<TKey> & MaybeRefOrGetter<InfiniteQueryOptions<TPage, TPageParam, TKey>['key']>
  enabled?: MaybeRefOrGetter<boolean>
  refetchOnShow?: RefetchOnShow
}

/** `useInfiniteQuery()` 返回的分页状态和控制方法。 */
export interface UseInfiniteQueryResult<TPage, TPageParam>
  extends QueryStateRefs<InfiniteData<TPage, TPageParam>> {
  readonly hasNextPage: ComputedRef<boolean>
  readonly isFetchingNextPage: ComputedRef<boolean>
  readonly refresh: () => Promise<InfiniteData<TPage, TPageParam>>
  readonly refetch: () => Promise<InfiniteData<TPage, TPageParam>>
  readonly fetchNextPage: () => Promise<InfiniteData<TPage, TPageParam>>
}

/** `useMutation()` 接受的变更配置。 */
export interface UseMutationOptions<TData, TVariables> extends MutationOptions<TData, TVariables> {}

/** `useMutation()` 返回的只读状态和控制方法。 */
export interface UseMutationResult<TData, TVariables> {
  readonly status: ComputedRef<'idle' | 'pending' | 'success' | 'error'>
  readonly data: ComputedRef<TData | undefined>
  readonly error: ComputedRef<unknown>
  readonly variables: ComputedRef<TVariables | undefined>
  readonly isPending: ComputedRef<boolean>
  readonly mutate: (variables: TVariables) => void
  readonly mutateAsync: (variables: TVariables) => Promise<TData>
  readonly reset: () => void
}
