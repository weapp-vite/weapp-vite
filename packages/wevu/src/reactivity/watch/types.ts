import type { ComputedRef } from '../computed'
import type { Ref } from '../ref'

export type OnCleanup = (cleanupFn: () => void) => void
export type WatchEffect = (onCleanup: OnCleanup) => void
export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)
export type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV, onCleanup: OnCleanup) => void
export type WatchScheduler = (job: () => void, isFirstRun: boolean) => void
export type MaybeUndefined<T, Immediate> = Immediate extends true ? T | undefined : T
export type MultiWatchSources = (WatchSource<unknown> | object)[]
export type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? MaybeUndefined<V, Immediate>
    : T[K] extends object
      ? MaybeUndefined<T[K], Immediate>
      : never
}
export type WatchSourceValue<S> = S extends WatchSource<infer V>
  ? V
  : S extends object
    ? S
    : never
export type WatchSources<T = any>
  = | WatchSource<T>
    | ReadonlyArray<WatchSource<unknown> | object>
    | (T extends object ? T : never)
type IsTuple<T extends ReadonlyArray<any>> = number extends T['length'] ? false : true
export type WatchMultiSources<T extends ReadonlyArray<WatchSource<unknown> | object>> = IsTuple<T> extends true
  ? { [K in keyof T]: WatchSourceValue<T[K]> }
  : Array<WatchSourceValue<T[number]>>

export interface WatchEffectOptions {
  flush?: 'pre' | 'post' | 'sync'
}

export interface WatchOptions<Immediate extends boolean = false> extends WatchEffectOptions {
  immediate?: Immediate
  deep?: boolean | number
  once?: boolean
  scheduler?: WatchScheduler
}

export interface WatchStopHandle {
  (): void
  stop: () => void
  pause: () => void
  resume: () => void
}

export type DeepWatchStrategy = 'version' | 'traverse'

let __deepWatchStrategy: DeepWatchStrategy = 'version'

/**
 * 设置深度 watch 内部策略（测试/框架内部使用）。
 * @internal
 */
export function setDeepWatchStrategy(strategy: DeepWatchStrategy) {
  __deepWatchStrategy = strategy
}

/**
 * 获取深度 watch 内部策略（测试/框架内部使用）。
 * @internal
 */
export function getDeepWatchStrategy(): DeepWatchStrategy {
  return __deepWatchStrategy
}
