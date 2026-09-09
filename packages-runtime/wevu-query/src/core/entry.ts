import type {
  FetchType,
  QueryAbortController,
  QueryKey,
  QueryOptions,
  QueryState,
} from './types'

export interface PendingQuery<TData, TKey extends QueryKey> {
  readonly promise: Promise<TData>
  readonly resolve: (data: TData) => void
  readonly reject: (error: unknown) => void
  readonly query: QueryOptions<TData, TKey>['query']
  readonly key: TKey
  readonly fetchType: FetchType
  readonly epoch: number
  aborted: boolean
  imperative: boolean
  resumeOffline: boolean
  settled: boolean
  started: boolean
  controller: QueryAbortController | undefined
}

export interface QueryEntryObserver {
  onEntryState: (
    entry: QueryEntry<unknown, QueryKey>,
    state: QueryState<unknown>,
  ) => void
}

function initialQueryState<TData>(): QueryState<TData> {
  return Object.freeze({
    data: undefined,
    error: null,
    fetchStatus: 'idle',
    fetchType: null,
    hasData: false,
    invalidated: false,
    status: 'pending',
    updatedAt: 0,
  })
}

/** 单个规范化查询键对应的缓存、请求与观察者所有权。 */
export class QueryEntry<TData, TKey extends QueryKey> {
  state = initialQueryState<TData>()
  readonly observers = new Set<QueryEntryObserver>()
  readonly hash: string
  readonly key: TKey
  cancelGc: (() => void) | undefined
  staleTime: number
  gcTime: number
  pending: PendingQuery<TData, TKey> | undefined
  writeDepth = 0
  writeVersion = 0
  committedWriteVersion = 0
  private stateRevision = 0
  private notifying = false
  private notifyAgain = false

  constructor(hash: string, key: TKey, staleTime: number, gcTime: number) {
    this.hash = hash
    this.key = key
    this.staleTime = staleTime
    this.gcTime = gcTime
  }

  updateTiming(staleTime: number, gcTime: number): void {
    this.staleTime = staleTime
    this.gcTime = Math.max(this.gcTime, gcTime)
  }

  isFresh(now: number): boolean {
    return this.state.hasData
      && !this.state.invalidated
      && now - this.state.updatedAt < this.staleTime
  }

  setState(patch: Partial<QueryState<TData>>, notify = true): void {
    this.state = Object.freeze({ ...this.state, ...patch })
    this.stateRevision++
    if (notify) {
      this.notifyObservers()
    }
  }

  private notifyObservers(): void {
    if (this.observers.size === 0) {
      return
    }
    if (this.notifying) {
      this.notifyAgain = true
      return
    }

    this.notifying = true
    try {
      do {
        this.notifyAgain = false
        const revision = this.stateRevision
        const state = this.state
        const observers = [...this.observers]
        for (const observer of observers) {
          if (revision !== this.stateRevision) {
            this.notifyAgain = true
            break
          }
          if (this.observers.has(observer)) {
            observer.onEntryState(
              this as unknown as QueryEntry<unknown, QueryKey>,
              state as QueryState<unknown>,
            )
          }
        }
      } while (this.notifyAgain)
    }
    finally {
      this.notifying = false
    }
  }
}

export function createPendingQuery<TData, TKey extends QueryKey>(
  query: QueryOptions<TData, TKey>['query'],
  key: TKey,
  fetchType: FetchType,
  epoch: number,
  imperative: boolean,
  resumeOffline: boolean,
): PendingQuery<TData, TKey> {
  let resolve!: (data: TData) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<TData>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return {
    controller: undefined,
    aborted: false,
    epoch,
    fetchType,
    imperative,
    resumeOffline,
    settled: false,
    key,
    promise,
    query,
    reject,
    resolve,
    started: false,
  }
}
