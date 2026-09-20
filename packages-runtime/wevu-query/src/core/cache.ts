import type { QueryKey, QueryOptions } from './types'
import { QueryEntry } from './entry'

const MAX_TIMEOUT_DELAY = 2_147_483_647

function resolveDuration(value: number | undefined, fallback: number, name: string): number {
  const duration = value ?? fallback
  if (duration !== Number.POSITIVE_INFINITY && (!Number.isFinite(duration) || duration < 0)) {
    throw new RangeError(`${name} 必须是非负有限数或 Infinity`)
  }
  return duration
}

/** 管理查询条目身份、配置和无观察者回收计时。 */
export class QueryCache {
  private readonly entries = new Map<string, QueryEntry<unknown, QueryKey>>()
  private readonly defaultStaleTime: number
  private readonly defaultGcTime: number
  private closed = false

  constructor(staleTime: number | undefined, gcTime: number | undefined) {
    this.defaultStaleTime = resolveDuration(staleTime, 5_000, 'staleTime')
    this.defaultGcTime = resolveDuration(gcTime, 300_000, 'gcTime')
  }

  get(hash: string): QueryEntry<unknown, QueryKey> | undefined {
    return this.entries.get(hash)
  }

  snapshot(): QueryEntry<unknown, QueryKey>[] {
    return [...this.entries.values()]
  }

  isCurrent(entry: QueryEntry<unknown, QueryKey>): boolean {
    return !this.closed && this.entries.get(entry.hash) === entry
  }

  ensure<TData, TKey extends QueryKey>(hash: string, key: TKey): QueryEntry<TData, TKey> {
    const existing = this.entries.get(hash)
    if (existing) {
      return existing as unknown as QueryEntry<TData, TKey>
    }
    const entry = new QueryEntry<TData, TKey>(hash, key, this.defaultStaleTime, this.defaultGcTime)
    this.entries.set(hash, entry as unknown as QueryEntry<unknown, QueryKey>)
    return entry
  }

  configure<TData, TKey extends QueryKey>(
    hash: string,
    options: QueryOptions<TData, TKey>,
  ): QueryEntry<TData, TKey> {
    const staleTime = resolveDuration(options.staleTime, this.defaultStaleTime, 'staleTime')
    const gcTime = resolveDuration(options.gcTime, this.defaultGcTime, 'gcTime')
    const existing = this.entries.get(hash) as QueryEntry<TData, TKey> | undefined
    if (existing) {
      existing.updateTiming(staleTime, gcTime)
      return existing
    }
    const entry = new QueryEntry<TData, TKey>(hash, options.key, staleTime, gcTime)
    this.entries.set(hash, entry as unknown as QueryEntry<unknown, QueryKey>)
    return entry
  }

  update<TData, TKey extends QueryKey>(
    entry: QueryEntry<TData, TKey>,
    options: QueryOptions<TData, TKey>,
  ): void {
    const staleTime = resolveDuration(options.staleTime, this.defaultStaleTime, 'staleTime')
    const gcTime = resolveDuration(options.gcTime, this.defaultGcTime, 'gcTime')
    entry.updateTiming(staleTime, gcTime)
  }

  scheduleGc(entry: QueryEntry<unknown, QueryKey>): void {
    this.clearGc(entry)
    if (
      this.closed
      || entry.pending
      || entry.observers.size > 0
      || entry.gcTime === Number.POSITIVE_INFINITY
      || this.entries.get(entry.hash) !== entry
    ) {
      return
    }
    const collect = () => {
      entry.cancelGc = undefined
      if (!entry.pending && entry.observers.size === 0 && this.entries.get(entry.hash) === entry) {
        this.entries.delete(entry.hash)
      }
    }
    if (entry.gcTime <= MAX_TIMEOUT_DELAY) {
      const handle = setTimeout(collect, entry.gcTime)
      entry.cancelGc = () => clearTimeout(handle)
      return
    }
    let remaining = entry.gcTime - MAX_TIMEOUT_DELAY
    let handle = setTimeout(function schedule() {
      const delay = Math.min(remaining, MAX_TIMEOUT_DELAY)
      remaining -= delay
      handle = setTimeout(remaining > 0 ? schedule : collect, delay)
    }, MAX_TIMEOUT_DELAY)
    entry.cancelGc = () => clearTimeout(handle)
  }

  clearGc<TData, TKey extends QueryKey>(entry: QueryEntry<TData, TKey>): void {
    entry.cancelGc?.()
    entry.cancelGc = undefined
  }

  takeEntries(close = false): QueryEntry<unknown, QueryKey>[] {
    const entries = this.snapshot()
    this.entries.clear()
    this.closed = close
    for (const entry of entries) {
      this.clearGc(entry)
    }
    return entries
  }
}
