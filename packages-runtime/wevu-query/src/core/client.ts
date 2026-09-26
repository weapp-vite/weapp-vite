import type { QueryEntry } from './entry'
import type { QueryFetchRuntime } from './fetch'
import type {
  FetchOptions,
  QueryClientConfig,
  QueryDataOf,
  QueryFilter,
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryOptions,
  QueryState,
  Unsubscribe,
  UntaggedQueryKey,
} from './types'
import { QueryCache } from './cache'
import { QueryCancelledError } from './errors'
import { cancelEntry, fetchEntry, resumeEntry } from './fetch'
import { createQueryMatcher, hashQueryKey, snapshotAndHashQueryKey } from './keys'
import { ListenerStore } from './listeners'
import { QueryObserverManager } from './observerManager'

type QueryDataUpdater<TData> = TData | ((old: TData | undefined) => TData)

/** 保存查询缓存，并协调请求、观察者、作用域和宿主活动状态。 */
export class QueryClient {
  private readonly cache: QueryCache
  private readonly observerManager: QueryObserverManager
  private readonly scopeListeners = new ListenerStore<number>()
  private readonly clock: () => number
  private readonly controllerFactory: QueryClientConfig['createAbortController']
  private readonly fetchRuntime: QueryFetchRuntime
  private online = true
  private foreground = true
  private scope: string
  private scopeVersion = 0
  private disposed = false

  constructor(config: QueryClientConfig) {
    if (typeof config.createAbortController !== 'function') {
      throw new TypeError('QueryClient 需要 createAbortController')
    }
    this.cache = new QueryCache(config.staleTime, config.gcTime)
    this.clock = config.now ?? (() => Date.now())
    this.controllerFactory = config.createAbortController
    this.scope = config.scope ?? 'default'
    this.fetchRuntime = {
      createAbortController: () => this.controllerFactory(),
      getEpoch: () => this.scopeVersion,
      isEntryCurrent: entry => !this.disposed && this.cache.isCurrent(entry),
      isOnline: () => this.online,
      now: () => this.clock(),
      onEntrySettled: entry => this.cache.scheduleGc(entry),
    }
    this.observerManager = new QueryObserverManager(
      this.cache,
      this.fetchRuntime,
      () => this.ensureActive(),
      () => this.foreground,
    )
  }

  observeQuery<TData, TKey extends QueryKey>(
    options: QueryOptions<TData, TKey>,
    observerOptions?: QueryObserverOptions,
  ): QueryObserver<TData, TKey> {
    return this.observerManager.create(options, observerOptions)
  }

  fetchQuery<TData, TKey extends QueryKey>(
    options: QueryOptions<TData, TKey>,
    fetchOptions: FetchOptions<TData, TKey> = {},
  ): Promise<TData> {
    this.ensureActive()
    const normalized = snapshotAndHashQueryKey(options.key)
    const queryOptions = { ...options, key: normalized.key }
    const entry = this.cache.configure(normalized.hash, queryOptions)
    this.cache.clearGc(entry)
    return fetchEntry(this.fetchRuntime, entry, queryOptions, fetchOptions, true, true)
  }

  prefetchQuery<TData, TKey extends QueryKey>(options: QueryOptions<TData, TKey>): Promise<void> {
    return this.fetchQuery(options).then(() => undefined)
  }

  getQueryState<TData = unknown>(key: QueryKey): QueryState<TData> | undefined {
    const entry = this.cache.get(hashQueryKey(key))
    return entry?.state as QueryState<TData> | undefined
  }

  getQueryData<TData>(key: UntaggedQueryKey): TData | undefined
  getQueryData<TKey extends QueryKey>(key: TKey): QueryDataOf<TKey> | undefined
  getQueryData(key: QueryKey): unknown {
    return this.getQueryState(key)?.data
  }

  setQueryData<TData>(key: UntaggedQueryKey, updater: QueryDataUpdater<TData>): TData
  setQueryData<TKey extends QueryKey>(
    key: TKey,
    updater: QueryDataUpdater<QueryDataOf<TKey>>,
  ): QueryDataOf<TKey>
  setQueryData(
    key: QueryKey,
    updater: QueryDataUpdater<unknown>,
  ): unknown {
    this.ensureActive()
    const epoch = this.scopeVersion
    const normalized = snapshotAndHashQueryKey(key)
    const entry = this.cache.ensure<unknown, QueryKey>(
      normalized.hash,
      normalized.key,
    )
    const oldData = entry.state.hasData ? entry.state.data : undefined
    const writeVersion = ++entry.writeVersion
    entry.writeDepth++
    try {
      if (entry.pending) {
        cancelEntry(entry)
      }
      this.ensureWriteCurrent(entry, epoch)
      if (entry.committedWriteVersion > writeVersion) {
        return entry.state.data
      }
      const data = typeof updater === 'function'
        ? (updater as (old: unknown) => unknown)(oldData)
        : updater
      this.ensureWriteCurrent(entry, epoch)
      if (entry.committedWriteVersion > writeVersion) {
        return entry.state.data
      }
      const updatedAt = this.clock()
      this.ensureWriteCurrent(entry, epoch)
      if (entry.committedWriteVersion > writeVersion) {
        return entry.state.data
      }
      entry.committedWriteVersion = writeVersion
      entry.setState({
        data,
        error: null,
        fetchStatus: 'idle',
        fetchType: null,
        hasData: true,
        invalidated: false,
        status: 'success',
        updatedAt,
      })
      this.ensureWriteCurrent(entry, epoch)
      this.cache.scheduleGc(entry)
      return entry.committedWriteVersion > writeVersion ? entry.state.data : data
    }
    catch (error) {
      if (
        entry.writeDepth === 1
        && entry.committedWriteVersion <= writeVersion
        && this.scopeVersion === epoch
        && this.cache.isCurrent(entry)
      ) {
        this.cache.scheduleGc(entry)
      }
      throw error
    }
    finally {
      entry.writeDepth--
    }
  }

  invalidateQueries(filter: QueryFilter = {}): Promise<void> {
    this.ensureActive()
    const matches = createQueryMatcher(filter)
    const refreshes: Promise<unknown>[] = []
    for (const entry of this.cache.snapshot()) {
      if (!this.cache.isCurrent(entry) || !matches(entry.key, entry.hash)) {
        continue
      }
      cancelEntry(entry, new QueryCancelledError(), { invalidated: true })
      const observer = this.observerManager.findInvalidationObserver(entry)
      if (observer) {
        refreshes.push(observer.refreshFromInvalidation())
      }
      else {
        this.cache.scheduleGc(entry)
      }
    }
    return Promise.all(refreshes).then(() => undefined)
  }

  cancelQueries(filter: QueryFilter = {}): void {
    this.ensureActive()
    const matches = createQueryMatcher(filter)
    for (const entry of this.cache.snapshot()) {
      if (entry.pending && this.cache.isCurrent(entry) && matches(entry.key, entry.hash)) {
        cancelEntry(entry)
        this.cache.scheduleGc(entry)
      }
    }
  }

  /** 清空当前作用域数据并保留观察者注册；旧选项不会被自动重新执行。 */
  clear(): void {
    this.ensureActive()
    this.advanceScope()
  }

  /** 切换作用域并重置观察者状态；相同作用域不产生新版本。 */
  setScope(scope: string): void {
    this.ensureActive()
    if (scope === this.scope) {
      return
    }
    this.scope = scope
    this.advanceScope()
  }

  getScopeVersion(): number {
    return this.scopeVersion
  }

  isDisposed(): boolean {
    return this.disposed
  }

  subscribeScope(listener: (version: number) => void): Unsubscribe {
    this.ensureActive()
    return this.scopeListeners.add(listener)
  }

  setOnline(online: boolean): void {
    this.ensureActive()
    if (this.online === online) {
      return
    }
    this.online = online
    if (!online) {
      return
    }
    for (const entry of this.cache.snapshot()) {
      const pending = entry.pending
      if (
        pending
        && !pending.started
        && (
          pending.imperative
          || pending.resumeOffline
          || this.observerManager.canResume(entry)
        )
      ) {
        resumeEntry(this.fetchRuntime, entry)
      }
    }
  }

  setForeground(foreground: boolean): void {
    this.ensureActive()
    if (this.foreground === foreground) {
      return
    }
    this.foreground = foreground
    if (foreground) {
      this.observerManager.foregroundEntered()
    }
  }

  /** 终止客户端，撤销请求、计时器和所有订阅。 */
  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.scopeVersion++
    this.releaseEntries(true)
    this.observerManager.dispose()
    this.scopeListeners.close(this.scopeVersion)
  }

  private advanceScope(): void {
    const version = ++this.scopeVersion
    this.releaseEntries(false)
    this.observerManager.rebindAfterScope(() => !this.disposed && this.scopeVersion === version)
    if (!this.disposed && this.scopeVersion === version) {
      this.scopeListeners.emit(version)
    }
  }

  private releaseEntries(close: boolean): void {
    for (const entry of this.cache.takeEntries(close)) {
      entry.observers.clear()
      if (entry.pending) {
        cancelEntry(entry, new QueryCancelledError(), {}, false)
      }
    }
  }

  private ensureWriteCurrent(
    entry: QueryEntry<unknown, QueryKey>,
    epoch: number,
  ): void {
    if (
      this.disposed
      || this.scopeVersion !== epoch
      || !this.cache.isCurrent(entry)
    ) {
      throw new QueryCancelledError()
    }
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('QueryClient 已销毁')
    }
  }
}
