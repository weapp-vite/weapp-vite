import type { QueryEntry, QueryEntryObserver } from './entry'
import type { QueryObserverHost } from './observerHost'
import type {
  FetchOptions,
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryOptions,
  QueryState,
  RefetchOnShow,
  Unsubscribe,
} from './types'
import { QueryCancelledError } from './errors'
import { snapshotAndHashQueryKey } from './keys'
import { ListenerStore } from './listeners'
import { automaticRefetchFetchOptions, consumeAutomatic, refetchFetchOptions, refreshFetchOptions } from './observerHost'

/** 管理单个调用方的查询键、可见性和订阅生命周期。 */
export class QueryObserverImpl<TData, TKey extends QueryKey>
implements QueryObserver<TData, TKey>, QueryEntryObserver {
  private readonly host: QueryObserverHost
  private readonly listeners = new ListenerStore<QueryState<TData>>()
  private options: QueryOptions<TData, TKey>
  private entry: QueryEntry<TData, TKey>
  private hash: string
  private state: QueryState<TData>
  private enabled: boolean
  private active: boolean
  private refetchOnShow: RefetchOnShow
  private armed = true
  private destroyed = false
  private bindingVersion = 0
  private emittedState: QueryState<TData> | undefined
  private readonly emissionIsCurrent = (): boolean => (
    !this.destroyed
    && this.emittedState === this.state
    && this.entry.state === this.emittedState
  )

  constructor(
    host: QueryObserverHost,
    options: QueryOptions<TData, TKey>,
    observerOptions: QueryObserverOptions = {},
  ) {
    this.host = host
    const normalized = snapshotAndHashQueryKey(options.key)
    this.options = { ...options, key: normalized.key }
    this.hash = normalized.hash
    this.enabled = observerOptions.enabled ?? true
    this.active = observerOptions.active ?? true
    this.refetchOnShow = observerOptions.refetchOnShow ?? 'stale'
    this.entry = host.registerObserver(this, this.options, this.hash)
    this.state = this.entry.state
    if (this.canRefreshAutomatically()) {
      consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
    }
  }

  getState(): QueryState<TData> {
    return this.state
  }

  subscribe(listener: (state: QueryState<TData>) => void): Unsubscribe {
    this.ensureAlive()
    const unsubscribe = this.listeners.add(listener)
    try {
      listener(this.state)
    }
    catch (error) {
      unsubscribe()
      throw error
    }
    return unsubscribe
  }

  setOptions(options: QueryOptions<TData, TKey>, observerOptions: QueryObserverOptions = {}): void {
    this.ensureAlive()
    const bindingVersion = ++this.bindingVersion
    const normalized = snapshotAndHashQueryKey(options.key)
    const nextOptions = { ...options, key: normalized.key }
    const keyChanged = normalized.hash !== this.hash
    const wasEnabled = this.enabled
    const wasActive = this.active
    const nextEnabled = observerOptions.enabled ?? this.enabled
    const nextActive = observerOptions.active ?? this.active
    const nextRefetchOnShow = observerOptions.refetchOnShow ?? this.refetchOnShow
    if (keyChanged) {
      this.host.rebindObserver(
        this,
        this.entry,
        nextOptions,
        normalized.hash,
        bindingVersion,
        nextEnabled,
        nextActive,
        nextRefetchOnShow,
      )
      if (!this.isBindingCurrent(bindingVersion)) {
        return
      }
      this.emittedState = this.state
      this.listeners.emit(this.state, this.emissionIsCurrent)
      if (this.canRefreshAutomatically()) {
        consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
      }
      return
    }

    this.host.updateObserver(this.entry, nextOptions)
    if (!this.isBindingCurrent(bindingVersion)) {
      return
    }
    this.options = nextOptions
    this.enabled = nextEnabled
    this.active = nextActive
    this.refetchOnShow = nextRefetchOnShow
    if (!wasEnabled && this.enabled) {
      this.armed = true
      if (this.canRefreshAutomatically()) {
        consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
      }
      return
    }
    if (!wasActive && this.active) {
      this.refreshForVisibility()
      return
    }
    if (wasEnabled && this.enabled && wasActive && this.active && this.armed && this.host.isForeground()) {
      consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
    }
  }

  setActive(active: boolean): void {
    this.ensureAlive()
    if (this.active === active) {
      return
    }
    this.active = active
    if (active) {
      this.refreshForVisibility()
    }
  }

  setEnabled(enabled: boolean): void {
    this.ensureAlive()
    if (this.enabled === enabled) {
      return
    }
    this.enabled = enabled
    if (enabled) {
      this.armed = true
      if (this.canRefreshAutomatically()) {
        consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
      }
    }
  }

  refresh(): Promise<TData> {
    this.ensureAlive()
    this.armed = true
    return this.host.fetchObserver(this, refreshFetchOptions, true)
  }

  refetch(): Promise<TData> {
    this.ensureAlive()
    this.armed = true
    return this.host.fetchObserver(this, refetchFetchOptions, true)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.bindingVersion++
    this.listeners.clear()
    this.host.removeObserver(this, this.entry)
  }

  onEntryState(
    entry: QueryEntry<unknown, QueryKey>,
    state: QueryState<unknown>,
  ): void {
    if (
      this.destroyed
      || entry !== (this.entry as unknown as QueryEntry<unknown, QueryKey>)
    ) {
      return
    }
    this.state = state as QueryState<TData>
    this.emittedState = this.state
    this.listeners.emit(this.state, this.emissionIsCurrent)
  }

  getOptions(): QueryOptions<TData, TKey> {
    return this.options
  }

  getHash(): string {
    return this.hash
  }

  fetchObserved(fetchOptions: FetchOptions<TData, TKey>): Promise<TData> {
    if (this.destroyed) {
      return Promise.reject(new QueryCancelledError())
    }
    return this.host.fetchObserver(this, fetchOptions, true)
  }

  commitRebind(
    entry: QueryEntry<TData, TKey>,
    options: QueryOptions<TData, TKey>,
    hash: string,
    bindingVersion: number,
    enabled: boolean,
    active: boolean,
    refetchOnShow: RefetchOnShow,
  ): boolean {
    if (!this.isBindingCurrent(bindingVersion)) {
      return false
    }
    this.entry = entry
    this.options = options
    this.hash = hash
    this.enabled = enabled
    this.active = active
    this.refetchOnShow = refetchOnShow
    this.state = entry.state
    this.armed = true
    return true
  }

  isBindingCurrent(bindingVersion: number): boolean {
    return !this.destroyed && this.bindingVersion === bindingVersion
  }

  canRefreshAutomatically(): boolean {
    return !this.destroyed
      && this.armed
      && this.enabled
      && this.active
      && this.host.isForeground()
  }

  canRefreshFromInvalidation(): boolean {
    return !this.destroyed && this.enabled && this.active && this.host.isForeground()
  }

  refreshFromInvalidation(): Promise<TData> {
    this.armed = true
    return this.host.fetchObserver(this, refreshFetchOptions, false)
  }

  foregroundEntered(): void {
    this.refreshForVisibility()
  }

  replaceEntryAfterScope(entry: QueryEntry<TData, TKey>): void {
    if (this.destroyed) {
      return
    }
    this.entry = entry
    this.state = entry.state
    this.armed = false
    this.emittedState = this.state
    this.listeners.emit(this.state, this.emissionIsCurrent)
  }

  disposeFromClient(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.bindingVersion++
    this.listeners.clear()
  }

  private refreshForVisibility(): void {
    if (!this.canRefreshAutomatically()) {
      return
    }
    if (!this.state.hasData) {
      consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
    }
    else if (this.refetchOnShow === 'always') {
      consumeAutomatic(this.host.fetchObserver(this, automaticRefetchFetchOptions, false))
    }
    else if (this.refetchOnShow === 'stale') {
      consumeAutomatic(this.host.fetchObserver(this, refreshFetchOptions, false))
    }
  }

  private ensureAlive(): void {
    if (this.destroyed) {
      throw new Error('查询观察者已销毁')
    }
  }
}

/** 以观察者所有权执行显式内部请求，不把请求提升为命令式缓存所有权。 */
export function fetchObservedQuery<TData, TKey extends QueryKey>(
  observer: QueryObserver<TData, TKey>,
  fetchOptions: FetchOptions<TData, TKey>,
): Promise<TData> {
  if (!(observer instanceof QueryObserverImpl)) {
    return Promise.reject(new QueryCancelledError())
  }
  return observer.fetchObserved(fetchOptions)
}
