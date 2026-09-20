import type { QueryCache } from './cache'
import type { QueryEntry } from './entry'
import type { QueryFetchRuntime } from './fetch'
import type { QueryObserverHost } from './observerHost'
import type {
  FetchOptions,
  QueryKey,
  QueryObserverOptions,
  QueryOptions,
  RefetchOnShow,
} from './types'
import { QueryCancelledError } from './errors'
import { cancelEntry, fetchEntry } from './fetch'
import { QueryObserverImpl } from './observer'

/** 集中管理观察者注册、换键和观察者拥有的请求。 */
export class QueryObserverManager {
  private readonly cache: QueryCache
  private readonly fetchRuntime: QueryFetchRuntime
  private readonly ensureClientActive: () => void
  private readonly observers = new Set<QueryObserverImpl<unknown, QueryKey>>()
  private readonly host: QueryObserverHost

  constructor(
    cache: QueryCache,
    fetchRuntime: QueryFetchRuntime,
    ensureClientActive: () => void,
    isForeground: () => boolean,
  ) {
    this.cache = cache
    this.fetchRuntime = fetchRuntime
    this.ensureClientActive = ensureClientActive
    this.host = {
      fetchObserver: (observer, fetchOptions, resumeOffline) => (
        this.fetchObserver(observer, fetchOptions, resumeOffline)
      ),
      isForeground,
      rebindObserver: (
        observer,
        previous,
        options,
        hash,
        bindingVersion,
        enabled,
        active,
        refetchOnShow,
      ) => this.rebindObserver(
        observer,
        previous,
        options,
        hash,
        bindingVersion,
        enabled,
        active,
        refetchOnShow,
      ),
      registerObserver: (observer, options, hash) => this.registerObserver(observer, options, hash),
      removeObserver: (observer, entry) => this.removeObserver(observer, entry),
      updateObserver: (entry, options) => this.cache.update(entry, options),
    }
  }

  create<TData, TKey extends QueryKey>(
    options: QueryOptions<TData, TKey>,
    observerOptions?: QueryObserverOptions,
  ): QueryObserverImpl<TData, TKey> {
    this.ensureClientActive()
    return new QueryObserverImpl(this.host, options, observerOptions)
  }

  findInvalidationObserver(
    entry: QueryEntry<unknown, QueryKey>,
  ): QueryObserverImpl<unknown, QueryKey> | undefined {
    for (const observer of entry.observers) {
      const candidate = observer as QueryObserverImpl<unknown, QueryKey>
      if (candidate.canRefreshFromInvalidation()) {
        return candidate
      }
    }
    return undefined
  }

  canResume(entry: QueryEntry<unknown, QueryKey>): boolean {
    for (const observer of entry.observers) {
      if ((observer as QueryObserverImpl<unknown, QueryKey>).canRefreshAutomatically()) {
        return true
      }
    }
    return false
  }

  foregroundEntered(): void {
    for (const observer of [...this.observers]) {
      if (this.observers.has(observer)) {
        observer.foregroundEntered()
      }
    }
  }

  rebindAfterScope(isCurrent: () => boolean): void {
    for (const observer of [...this.observers]) {
      if (!isCurrent()) {
        return
      }
      if (!this.observers.has(observer)) {
        continue
      }
      const options = observer.getOptions()
      const entry = this.cache.configure(observer.getHash(), options)
      entry.observers.add(observer)
      observer.replaceEntryAfterScope(entry)
    }
  }

  dispose(): void {
    for (const observer of this.observers) {
      observer.disposeFromClient()
    }
    this.observers.clear()
  }

  private registerObserver<TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    options: QueryOptions<TData, TKey>,
    hash: string,
  ): QueryEntry<TData, TKey> {
    const entry = this.cache.configure(hash, options)
    this.cache.clearGc(entry)
    entry.observers.add(observer)
    this.observers.add(observer as unknown as QueryObserverImpl<unknown, QueryKey>)
    return entry
  }

  private rebindObserver<TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    previous: QueryEntry<TData, TKey>,
    options: QueryOptions<TData, TKey>,
    hash: string,
    bindingVersion: number,
    enabled: boolean,
    active: boolean,
    refetchOnShow: RefetchOnShow,
  ): QueryEntry<TData, TKey> {
    const next = this.cache.configure(hash, options)
    if (!this.cache.isCurrent(next as unknown as QueryEntry<unknown, QueryKey>)) {
      throw new QueryCancelledError()
    }
    const storedObserver = observer as unknown as QueryObserverImpl<unknown, QueryKey>
    if (!this.observers.has(storedObserver)) {
      this.cache.scheduleGc(next as unknown as QueryEntry<unknown, QueryKey>)
      return next
    }

    previous.observers.delete(observer)
    this.cache.clearGc(next)
    next.observers.add(observer)
    if (!observer.commitRebind(
      next,
      options,
      hash,
      bindingVersion,
      enabled,
      active,
      refetchOnShow,
    )) {
      next.observers.delete(observer)
    }
    this.releaseUnobserved(previous)
    if (!this.cache.isCurrent(next as unknown as QueryEntry<unknown, QueryKey>)) {
      throw new QueryCancelledError()
    }
    if (!next.observers.has(observer)) {
      this.cache.scheduleGc(next as unknown as QueryEntry<unknown, QueryKey>)
    }
    return next
  }

  private removeObserver<TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    entry: QueryEntry<TData, TKey>,
  ): void {
    entry.observers.delete(observer)
    this.observers.delete(observer as unknown as QueryObserverImpl<unknown, QueryKey>)
    this.releaseUnobserved(entry)
  }

  private fetchObserver<TData, TKey extends QueryKey>(
    observer: QueryObserverImpl<TData, TKey>,
    fetchOptions: FetchOptions<TData, TKey>,
    resumeOffline: boolean,
  ): Promise<TData> {
    this.ensureClientActive()
    const options = observer.getOptions()
    const entry = this.cache.get(observer.getHash()) as QueryEntry<TData, TKey> | undefined
    if (!entry || !entry.observers.has(observer)) {
      return Promise.reject(new QueryCancelledError())
    }
    this.cache.update(entry, options)
    this.cache.clearGc(entry)
    return fetchEntry(this.fetchRuntime, entry, options, fetchOptions, false, resumeOffline)
  }

  private releaseUnobserved<TData, TKey extends QueryKey>(entry: QueryEntry<TData, TKey>): void {
    if (entry.observers.size > 0) {
      return
    }
    if (entry.pending && !entry.pending.imperative) {
      cancelEntry(entry)
    }
    this.cache.scheduleGc(entry as unknown as QueryEntry<unknown, QueryKey>)
  }
}
