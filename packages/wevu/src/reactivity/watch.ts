import type { ComputedRef } from './computed'
import type { ReactiveEffect } from './core'
import type { Ref } from './ref'
import { nextTick } from '../scheduler'
import { effect, onScopeDispose, queueJob, stop } from './core'
import { isReactive, touchReactive } from './reactive'
import { isRef } from './ref'
import { traverse } from './traverse'

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
type DeepWatchStrategy = 'version' | 'traverse'
let __deepWatchStrategy: DeepWatchStrategy = 'version'
export function setDeepWatchStrategy(strategy: DeepWatchStrategy) {
  __deepWatchStrategy = strategy
}
export function getDeepWatchStrategy(): DeepWatchStrategy {
  return __deepWatchStrategy
}

export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle
export function watch<T extends object, Immediate extends Readonly<boolean> = false>(
  source: T extends ReadonlyArray<any> ? never : T,
  cb: WatchCallback<T, MaybeUndefined<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle
export function watch<T extends Readonly<MultiWatchSources>, Immediate extends Readonly<boolean> = false>(
  source: readonly [...T] | T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle
export function watch<T extends MultiWatchSources, Immediate extends Readonly<boolean> = false>(
  source: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>,
): WatchStopHandle
export function watch(
  source: WatchSources<any>,
  cb: WatchCallback,
  options: WatchOptions = {},
): WatchStopHandle {
  let getter: () => any
  const isReactiveSource = isReactive(source)
  const isMultiSource = Array.isArray(source) && !isReactiveSource

  const resolveSource = (item: WatchSource<any> | object) => {
    if (typeof item === 'function') {
      return (item as () => any)()
    }
    if (isRef(item)) {
      return (item as Ref<any>).value
    }
    if (isReactive(item)) {
      return item
    }
    throw new Error('无效的 watch 源')
  }

  if (isMultiSource) {
    const sources = source as ReadonlyArray<WatchSource<any> | object>
    getter = () => sources.map(item => resolveSource(item))
  }
  else if (typeof source === 'function') {
    getter = source as () => any
  }
  else if (isRef(source)) {
    getter = () => (source as Ref<any>).value
  }
  else if (isReactiveSource) {
    getter = () => source as any
  }
  else {
    throw new Error('无效的 watch 源')
  }

  const deepDefault = isMultiSource
    ? (source as ReadonlyArray<WatchSource<any> | object>).some(item => isReactive(item))
    : isReactiveSource
  const deep = options.deep ?? deepDefault
  const shouldDeep = deep === true || typeof deep === 'number'
  const depth = typeof deep === 'number' ? deep : (deep ? Infinity : 0)
  if (shouldDeep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (isMultiSource && Array.isArray(val)) {
        return val.map((item) => {
          if (__deepWatchStrategy === 'version' && isReactive(item)) {
            touchReactive(item as any)
            return item
          }
          return traverse(item, depth)
        })
      }
      // 当开启 deep 且策略为 version 时，若值是响应式对象则只订阅根版本号，避免深层遍历
      if (__deepWatchStrategy === 'version' && isReactive(val)) {
        touchReactive(val as any)
        return val
      }
      // 兜底：非响应式结构依旧进行遍历（少数情况）
      return traverse(val, depth)
    }
  }

  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }

  let oldValue: any
  let runner: ReactiveEffect<any>
  let paused = false
  let pauseToken = 0
  let stopHandle: WatchStopHandle
  const cbWithOnce: WatchCallback = options.once
    ? (value, oldValue, onCleanup) => {
        cb(value, oldValue, onCleanup)
        stopHandle()
      }
    : cb
  const flush = options.flush ?? 'pre'
  let scheduledToken = pauseToken
  const scheduledJob = () => job(scheduledToken)
  const scheduleJob = (job: (scheduledToken: number) => void, isFirstRun: boolean) => {
    scheduledToken = pauseToken
    if (options.scheduler) {
      const token = scheduledToken
      options.scheduler(() => job(token), isFirstRun)
      return
    }
    if (flush === 'sync') {
      scheduledJob()
      return
    }
    if (flush === 'post') {
      nextTick(() => queueJob(scheduledJob))
      return
    }
    if (isFirstRun) {
      scheduledJob()
    }
    else {
      queueJob(scheduledJob)
    }
  }

  const job = (scheduledToken: number) => {
    if (!runner.active || paused || scheduledToken !== pauseToken) {
      return
    }
    const newValue = runner()
    cleanup?.()
    cbWithOnce(newValue, oldValue, onCleanup)
    oldValue = newValue
  }

  runner = effect(() => getter(), {
    scheduler: () => {
      if (paused) {
        return
      }
      scheduleJob(job, false)
    },
    lazy: true,
  })

  const doStop = () => {
    cleanup?.()
    cleanup = undefined
    stop(runner)
  }
  stopHandle = doStop as WatchStopHandle
  stopHandle.stop = doStop
  stopHandle.pause = () => {
    if (!paused) {
      paused = true
      pauseToken += 1
    }
  }
  stopHandle.resume = () => {
    if (!paused || !runner.active) {
      return
    }
    paused = false
    // 避免恢复后触发暂停期间的变更
    oldValue = runner()
  }
  if (options.immediate) {
    job(pauseToken)
  }
  else {
    oldValue = runner()
  }
  onScopeDispose(stopHandle)
  return stopHandle
}

/**
 * watchEffect 注册一个响应式副作用，可选清理函数。
 * 副作用会立即执行，并在依赖变化时重新运行。
 */
export function watchEffect(
  effectFn: WatchEffect,
  options: WatchEffectOptions = {},
): WatchStopHandle {
  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }
  let runner: ReactiveEffect
  let paused = false
  let pauseToken = 0
  const flush = options.flush ?? 'pre'
  let scheduledToken = pauseToken
  const job = (scheduledToken: number) => {
    if (!runner.active || paused || scheduledToken !== pauseToken) {
      return
    }
    runner()
  }
  const scheduledJob = () => job(scheduledToken)
  const scheduleJob = (isFirstRun: boolean) => {
    scheduledToken = pauseToken
    if (flush === 'sync') {
      scheduledJob()
      return
    }
    if (flush === 'post') {
      nextTick(() => queueJob(scheduledJob))
      return
    }
    if (isFirstRun) {
      scheduledJob()
    }
    else {
      queueJob(scheduledJob)
    }
  }
  runner = effect(
    () => {
      cleanup?.()
      cleanup = undefined
      effectFn(onCleanup)
    },
    {
      lazy: true,
      scheduler: () => {
        if (paused) {
          return
        }
        scheduleJob(false)
      },
    },
  )
  // 立即执行一次以建立依赖（flush=post 时延后执行）
  scheduleJob(true)
  const doStop = () => {
    cleanup?.()
    cleanup = undefined
    stop(runner)
  }
  const stopHandle = doStop as WatchStopHandle
  stopHandle.stop = doStop
  stopHandle.pause = () => {
    if (!paused) {
      paused = true
      pauseToken += 1
    }
  }
  stopHandle.resume = () => {
    if (!paused || !runner.active) {
      return
    }
    paused = false
    // 恢复后重新执行以重新收集依赖
    scheduleJob(true)
  }
  onScopeDispose(stopHandle)
  return stopHandle
}
