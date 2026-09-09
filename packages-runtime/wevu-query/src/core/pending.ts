import type { QueryEntry } from './entry'
import type { QueryKey } from './types'
import { QueryCancelledError } from './errors'
import { reportCallbackError } from './listeners'

type ActivePending<TData, TKey extends QueryKey> = NonNullable<
  QueryEntry<TData, TKey>['pending']
>

/** 只完成一次请求失败结算。 */
export function rejectPending<TData, TKey extends QueryKey>(
  pending: ActivePending<TData, TKey>,
  error: unknown,
): void {
  if (pending.settled) {
    return
  }
  pending.settled = true
  pending.reject(error)
}

/** 只完成一次请求成功结算。 */
export function resolvePending<TData, TKey extends QueryKey>(
  pending: ActivePending<TData, TKey>,
  data: TData,
): void {
  if (pending.settled) {
    return
  }
  pending.settled = true
  pending.resolve(data)
}

/** 隔离宿主同步 abort 回调错误，且每个控制器只派发一次。 */
export function abortPending<TData, TKey extends QueryKey>(
  pending: ActivePending<TData, TKey>,
  error: unknown,
): void {
  const controller = pending.controller
  if (!controller || pending.aborted) {
    return
  }
  pending.aborted = true
  try {
    controller.abort(error)
  }
  catch (abortError) {
    reportCallbackError(abortError)
  }
}

/** 撤销已经失去缓存或作用域所有权的请求。 */
export function revokeDetachedPending<TData, TKey extends QueryKey>(
  entry: QueryEntry<TData, TKey>,
  pending: ActivePending<TData, TKey>,
): void {
  const error = new QueryCancelledError()
  if (entry.pending === pending) {
    entry.pending = undefined
  }
  rejectPending(pending, error)
  abortPending(pending, error)
}
