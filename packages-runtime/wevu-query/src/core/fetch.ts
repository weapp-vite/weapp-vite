import type { QueryEntry } from './entry'
import type {
  FetchOptions,
  QueryAbortController,
  QueryKey,
  QueryOptions,
} from './types'
import { createPendingQuery } from './entry'
import { isQueryCancelled, QueryCancelledError } from './errors'
import { abortPending, rejectPending, resolvePending, revokeDetachedPending } from './pending'

export interface QueryFetchRuntime {
  createAbortController: () => QueryAbortController
  getEpoch: () => number
  isEntryCurrent: (entry: QueryEntry<unknown, QueryKey>) => boolean
  isOnline: () => boolean
  now: () => number
  onEntrySettled: (entry: QueryEntry<unknown, QueryKey>) => void
}

function asUnknownEntry<TData, TKey extends QueryKey>(
  entry: QueryEntry<TData, TKey>,
): QueryEntry<unknown, QueryKey> {
  return entry as unknown as QueryEntry<unknown, QueryKey>
}

function isPendingCurrent<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
  pending: NonNullable<QueryEntry<TData, TKey>['pending']>,
): boolean {
  return entry.pending === pending
    && pending.epoch === runtime.getEpoch()
    && runtime.isEntryCurrent(asUnknownEntry(entry))
}

function pausePendingIfOffline<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
  pending: NonNullable<QueryEntry<TData, TKey>['pending']>,
): boolean {
  if (runtime.isOnline()) {
    return false
  }
  pending.started = false
  if (entry.state.fetchStatus !== 'paused') {
    entry.setState({ fetchStatus: 'paused' })
  }
  return true
}

function finishFailure<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
  pending: NonNullable<QueryEntry<TData, TKey>['pending']>,
  error: unknown,
): void {
  if (!isPendingCurrent(runtime, entry, pending)) {
    rejectPending(pending, new QueryCancelledError())
    return
  }
  if (isQueryCancelled(error)) {
    entry.setState({ fetchStatus: 'idle', fetchType: null })
  }
  else {
    entry.setState({
      error,
      fetchStatus: 'idle',
      fetchType: null,
      status: 'error',
    })
  }
  if (isPendingCurrent(runtime, entry, pending)) {
    entry.pending = undefined
    rejectPending(pending, error)
  }
  else {
    if (entry.pending === pending) {
      entry.pending = undefined
    }
    rejectPending(pending, new QueryCancelledError())
  }
  runtime.onEntrySettled(asUnknownEntry(entry))
}

function finishSuccess<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
  pending: NonNullable<QueryEntry<TData, TKey>['pending']>,
  data: TData,
): void {
  if (!isPendingCurrent(runtime, entry, pending)) {
    rejectPending(pending, new QueryCancelledError())
    return
  }
  let updatedAt: number
  try {
    updatedAt = runtime.now()
  }
  catch (error) {
    finishFailure(runtime, entry, pending, error)
    return
  }
  if (!isPendingCurrent(runtime, entry, pending)) {
    rejectPending(pending, new QueryCancelledError())
    return
  }
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
  if (isPendingCurrent(runtime, entry, pending)) {
    entry.pending = undefined
    resolvePending(pending, data)
  }
  else {
    if (entry.pending === pending) {
      entry.pending = undefined
    }
    rejectPending(pending, new QueryCancelledError())
  }
  runtime.onEntrySettled(asUnknownEntry(entry))
}

function executePending<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
): void {
  const pending = entry.pending
  if (!pending || pending.started || !runtime.isOnline()) {
    return
  }
  if (!isPendingCurrent(runtime, entry, pending)) {
    revokeDetachedPending(entry, pending)
    return
  }

  pending.started = true
  if (entry.state.fetchStatus !== 'fetching') {
    entry.setState({ fetchStatus: 'fetching' })
  }
  if (!isPendingCurrent(runtime, entry, pending)) {
    revokeDetachedPending(entry, pending)
    return
  }
  if (pausePendingIfOffline(runtime, entry, pending)) {
    return
  }

  let controller = pending.controller
  if (!controller) {
    try {
      controller = runtime.createAbortController()
      pending.controller = controller
    }
    catch (error) {
      finishFailure(runtime, entry, pending, error)
      return
    }
  }
  if (!isPendingCurrent(runtime, entry, pending)) {
    revokeDetachedPending(entry, pending)
    return
  }
  if (pausePendingIfOffline(runtime, entry, pending)) {
    return
  }

  let result: TData | Promise<TData>
  try {
    result = pending.query({ key: pending.key, signal: controller.signal })
  }
  catch (error) {
    finishFailure(runtime, entry, pending, error)
    return
  }
  Promise.resolve(result).then(
    data => finishSuccess(runtime, entry, pending, data),
    error => finishFailure(runtime, entry, pending, error),
  )
}

export function cancelEntry<TData, TKey extends QueryKey>(
  entry: QueryEntry<TData, TKey>,
  error = new QueryCancelledError(),
  patch: Partial<QueryEntry<TData, TKey>['state']> = {},
  notify = true,
): void {
  const pending = entry.pending
  entry.pending = undefined
  entry.setState({ fetchStatus: 'idle', fetchType: null, ...patch }, notify)
  if (!pending) {
    return
  }

  rejectPending(pending, error)
  abortPending(pending, error)
}

export function resumeEntry<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
): void {
  executePending(runtime, entry)
}

export function fetchEntry<TData, TKey extends QueryKey>(
  runtime: QueryFetchRuntime,
  entry: QueryEntry<TData, TKey>,
  options: QueryOptions<TData, TKey>,
  fetchOptions: FetchOptions<TData, TKey>,
  imperative: boolean,
  resumeOffline: boolean,
): Promise<TData> {
  const epoch = runtime.getEpoch()
  if (
    entry.writeDepth > 0
    || !runtime.isEntryCurrent(asUnknownEntry(entry))
  ) {
    return Promise.reject(new QueryCancelledError())
  }

  const existing = entry.pending
  if (existing) {
    if (!fetchOptions.cancelRefetch) {
      existing.imperative ||= imperative
      existing.resumeOffline ||= resumeOffline
      if (!existing.started && runtime.isOnline()) {
        executePending(runtime, entry)
      }
      return existing.promise
    }
    cancelEntry(entry)
    if (
      epoch !== runtime.getEpoch()
      || !runtime.isEntryCurrent(asUnknownEntry(entry))
    ) {
      return Promise.reject(new QueryCancelledError())
    }
    const reentrant = entry.pending
    if (reentrant) {
      reentrant.imperative ||= imperative
      reentrant.resumeOffline ||= resumeOffline
      if (!reentrant.started && runtime.isOnline()) {
        executePending(runtime, entry)
      }
      return reentrant.promise
    }
  }

  if (
    epoch !== runtime.getEpoch()
    || entry.writeDepth > 0
    || !runtime.isEntryCurrent(asUnknownEntry(entry))
  ) {
    return Promise.reject(new QueryCancelledError())
  }
  if (!fetchOptions.force) {
    const state = entry.state
    let now: number
    try {
      now = runtime.now()
    }
    catch (error) {
      if (
        epoch !== runtime.getEpoch()
        || !runtime.isEntryCurrent(asUnknownEntry(entry))
      ) {
        return Promise.reject(new QueryCancelledError())
      }
      if (entry.pending) {
        return Promise.reject(error)
      }
      if (entry.state !== state) {
        return Promise.reject(new QueryCancelledError())
      }
      const failed = createPendingQuery(
        fetchOptions.query ?? options.query,
        options.key,
        fetchOptions.fetchType ?? 'query',
        epoch,
        imperative,
        resumeOffline,
      )
      entry.pending = failed
      finishFailure(runtime, entry, failed, error)
      return failed.promise
    }
    if (
      epoch !== runtime.getEpoch()
      || !runtime.isEntryCurrent(asUnknownEntry(entry))
    ) {
      return Promise.reject(new QueryCancelledError())
    }
    const reentrant = entry.pending
    if (reentrant) {
      reentrant.imperative ||= imperative
      reentrant.resumeOffline ||= resumeOffline
      if (!reentrant.started && runtime.isOnline()) {
        executePending(runtime, entry)
      }
      return reentrant.promise
    }
    if (entry.state !== state) {
      return Promise.reject(new QueryCancelledError())
    }
    if (entry.isFresh(now)) {
      runtime.onEntrySettled(asUnknownEntry(entry))
      if (
        epoch !== runtime.getEpoch()
        || !runtime.isEntryCurrent(asUnknownEntry(entry))
      ) {
        return Promise.reject(new QueryCancelledError())
      }
      return Promise.resolve(entry.state.data as TData)
    }
  }

  const query = fetchOptions.query ?? options.query
  const pending = createPendingQuery(
    query,
    options.key,
    fetchOptions.fetchType ?? 'query',
    epoch,
    imperative,
    resumeOffline,
  )
  entry.pending = pending
  entry.setState({
    error: null,
    fetchStatus: runtime.isOnline() ? 'fetching' : 'paused',
    fetchType: pending.fetchType,
    status: entry.state.hasData ? 'success' : 'pending',
  })
  if (!isPendingCurrent(runtime, entry, pending)) {
    revokeDetachedPending(entry, pending)
  }
  else if (!pausePendingIfOffline(runtime, entry, pending)) {
    executePending(runtime, entry)
  }
  return pending.promise
}
