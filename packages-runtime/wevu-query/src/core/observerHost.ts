import type { QueryEntry } from './entry'
import type { QueryObserverImpl } from './observer'
import type {
  FetchOptions,
  QueryKey,
  QueryOptions,
  RefetchOnShow,
} from './types'

/** 连接观察者生命周期与缓存拥有者的内部协议。 */
export interface QueryObserverHost {
  fetchObserver: <TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    fetchOptions: FetchOptions<TData, TKey>,
    resumeOffline: boolean,
  ) => Promise<TData>
  isForeground: () => boolean
  rebindObserver: <TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    previous: QueryEntry<TData, TKey>,
    options: QueryOptions<TData, TKey>,
    hash: string,
    bindingVersion: number,
    enabled: boolean,
    active: boolean,
    refetchOnShow: RefetchOnShow,
  ) => QueryEntry<TData, TKey>
  registerObserver: <TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    options: QueryOptions<TData, TKey>,
    hash: string,
  ) => QueryEntry<TData, TKey>
  removeObserver: <TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    entry: QueryEntry<TData, TKey>,
  ) => void
  updateObserver: <TData, TKey extends QueryKey>(
    entry: QueryEntry<TData, TKey>,
    options: QueryOptions<TData, TKey>,
  ) => void
}

export const refreshFetchOptions = { cancelRefetch: false, force: false } as const
export const refetchFetchOptions = { cancelRefetch: true, force: true } as const
export const automaticRefetchFetchOptions = { cancelRefetch: false, force: true } as const

/** 消费无 Promise 调用方的自动请求；错误已先写入可观察状态。 */
export function consumeAutomatic(promise: Promise<unknown>): void {
  void promise.catch(() => undefined)
}
