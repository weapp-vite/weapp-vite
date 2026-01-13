import type { ReactiveEffect } from './core'
import type { Ref } from './ref'
import { effect, onScopeDispose, queueJob, stop } from './core'
import { isReactive, touchReactive } from './reactive'
import { isRef } from './ref'
import { traverse } from './traverse'

export interface WatchOptions {
  immediate?: boolean
  deep?: boolean
}

type WatchSource<T = any> = (() => T) | Ref<T> | (T extends object ? T : never)
type WatchSourceValue<S> = S extends Ref<infer V>
  ? V
  : S extends () => infer V
    ? V
    : S extends object
      ? S
      : never
type WatchSources<T = any> = WatchSource<T> | ReadonlyArray<WatchSource<any>>
type IsTuple<T extends ReadonlyArray<any>> = number extends T['length'] ? false : true
type WatchMultiSources<T extends ReadonlyArray<WatchSource<any>>> = IsTuple<T> extends true
  ? { [K in keyof T]: WatchSourceValue<T[K]> }
  : Array<WatchSourceValue<T[number]>>

export type WatchStopHandle = () => void
type DeepWatchStrategy = 'version' | 'traverse'
let __deepWatchStrategy: DeepWatchStrategy = 'version'
export function setDeepWatchStrategy(strategy: DeepWatchStrategy) {
  __deepWatchStrategy = strategy
}
export function getDeepWatchStrategy(): DeepWatchStrategy {
  return __deepWatchStrategy
}

export function watch<T>(
  source: WatchSource<T>,
  cb: (value: T, oldValue: T, onCleanup: (cleanupFn: () => void) => void) => void,
  options?: WatchOptions,
): WatchStopHandle
export function watch<T extends ReadonlyArray<WatchSource<any>>>(
  source: T,
  cb: (value: WatchMultiSources<T>, oldValue: WatchMultiSources<T>, onCleanup: (cleanupFn: () => void) => void) => void,
  options?: WatchOptions,
): WatchStopHandle
export function watch(
  source: WatchSources<any>,
  cb: (value: any, oldValue: any, onCleanup: (cleanupFn: () => void) => void) => void,
  options: WatchOptions = {},
): WatchStopHandle {
  let getter: () => any
  const isReactiveSource = isReactive(source)
  const isMultiSource = Array.isArray(source) && !isReactiveSource

  const resolveSource = (item: WatchSource<any>) => {
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
    const sources = source as ReadonlyArray<WatchSource<any>>
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
    ? (source as ReadonlyArray<WatchSource<any>>).some(item => isReactive(item))
    : isReactiveSource
  const deep = options.deep ?? deepDefault
  if (deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      if (isMultiSource && Array.isArray(val)) {
        return val.map((item) => {
          if (__deepWatchStrategy === 'version' && isReactive(item)) {
            touchReactive(item as any)
            return item
          }
          return traverse(item)
        })
      }
      // 当开启 deep 且策略为 version 时，若值是响应式对象则只订阅根版本号，避免深层遍历
      if (__deepWatchStrategy === 'version' && isReactive(val)) {
        touchReactive(val as any)
        return val
      }
      // 兜底：非响应式结构依旧进行遍历（少数情况）
      return traverse(val)
    }
  }

  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }

  let oldValue: any
  let runner: ReactiveEffect<any>

  const job = () => {
    if (!runner.active) {
      return
    }
    const newValue = runner()
    cleanup?.()
    cb(newValue, oldValue, onCleanup)
    oldValue = newValue
  }

  runner = effect(() => getter(), {
    scheduler: () => queueJob(job),
    lazy: true,
  })

  if (options.immediate) {
    job()
  }
  else {
    oldValue = runner()
  }

  const stopHandle = () => {
    cleanup?.()
    cleanup = undefined
    stop(runner)
  }
  onScopeDispose(stopHandle)
  return stopHandle
}

/**
 * watchEffect 注册一个响应式副作用，可选清理函数。
 * 副作用会立即执行，并在依赖变化时重新运行。
 */
export function watchEffect(
  effectFn: (onCleanup: (cleanupFn: () => void) => void) => void,
): WatchStopHandle {
  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }
  let runner: ReactiveEffect
  const job = () => {
    if (runner.active) {
      runner()
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
      scheduler: () => queueJob(job),
    },
  )
  // 立即执行一次以建立依赖
  runner()
  const stopHandle = () => {
    cleanup?.()
    cleanup = undefined
    stop(runner)
  }
  onScopeDispose(stopHandle)
  return stopHandle
}
