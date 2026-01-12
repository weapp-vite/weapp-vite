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

type WatchSource<T = any> = (() => T) | Ref<T> | object

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
  options: WatchOptions = {},
): WatchStopHandle {
  let getter: () => T
  const isReactiveSource = isReactive(source)
  if (typeof source === 'function') {
    getter = source as () => T
  }
  else if (isRef(source)) {
    getter = () => (source as Ref<T>).value
  }
  else if (isReactiveSource) {
    getter = () => source as unknown as T
  }
  else {
    throw new Error('无效的 watch 源')
  }

  const deep = options.deep ?? isReactiveSource
  if (deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      // 当开启 deep 且策略为 version 时，若值是响应式对象则只订阅根版本号，避免深层遍历
      if (__deepWatchStrategy === 'version' && isReactive(val)) {
        touchReactive(val as any)
        return val as unknown as T
      }
      // 兜底：非响应式结构依旧进行遍历（少数情况）
      return traverse(val)
    }
  }

  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }

  let oldValue: T
  let runner: ReactiveEffect<T>

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
