import type { ReactiveEffect } from './core'
import type { Ref } from './ref'
import { effect, queueJob, stop } from './core'
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
  if (typeof source === 'function') {
    getter = source as () => T
  }
  else if (isRef(source)) {
    getter = () => (source as Ref<T>).value
  }
  else if (isReactive(source)) {
    getter = () => source as unknown as T
  }
  else {
    throw new Error('Invalid watch source')
  }

  if (options.deep) {
    const baseGetter = getter
    getter = () => {
      const val = baseGetter()
      // If the watched value is a reactive object, track its root version to avoid deep traverse
      // when the strategy is set to 'version'.
      if (__deepWatchStrategy === 'version' && isReactive(val)) {
        touchReactive(val as any)
        return val as unknown as T
      }
      // Fallback: still traverse non-reactive structures (rare).
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

  return () => {
    cleanup?.()
    stop(runner)
  }
}

/**
 * watchEffect registers a reactive effect with optional cleanup.
 * The effect executes immediately and re-runs when its dependencies change.
 */
export function watchEffect(
  effectFn: (onCleanup: (cleanupFn: () => void) => void) => void,
): WatchStopHandle {
  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }
  const runner = effect(
    () => {
      cleanup?.()
      cleanup = undefined
      effectFn(onCleanup)
    },
    {
      scheduler: () => queueJob(() => {
        if (runner.active) {
          runner()
        }
      }),
    },
  )
  // run once immediately
  runner()
  return () => {
    cleanup?.()
    stop(runner)
  }
}
