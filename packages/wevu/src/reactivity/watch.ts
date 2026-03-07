import type { ReactiveEffect } from './core'
import type {
  MapSources,
  MaybeUndefined,
  MultiWatchSources,
  OnCleanup,
  WatchCallback,
  WatchEffect,
  WatchEffectOptions,
  WatchOptions,
  WatchSource,
  WatchSources,
  WatchStopHandle,
} from './watch/types'
import { effect, onScopeDispose, stop } from './core'
import { applyDeepWatchGetter, createWatchGetter, dispatchScheduledJob } from './watch/helpers'

export type {
  DeepWatchStrategy,
  MapSources,
  MaybeUndefined,
  MultiWatchSources,
  OnCleanup,
  WatchCallback,
  WatchEffect,
  WatchEffectOptions,
  WatchMultiSources,
  WatchOptions,
  WatchScheduler,
  WatchSource,
  WatchSources,
  WatchSourceValue,
  WatchStopHandle,
} from './watch/types'
export { getDeepWatchStrategy, setDeepWatchStrategy } from './watch/types'

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
  const watchGetterContext = createWatchGetter(source)
  const getter = applyDeepWatchGetter(
    watchGetterContext.getter,
    source,
    watchGetterContext.isMultiSource,
    watchGetterContext.isReactiveSource,
    options.deep,
  )

  let cleanup: (() => void) | undefined
  const onCleanup: OnCleanup = (fn) => {
    cleanup = fn
  }

  let oldValue: any
  let runner: ReactiveEffect<any>
  let paused = false
  let pauseToken = 0
  let scheduledToken = pauseToken
  let stopHandle: WatchStopHandle
  const cbWithOnce: WatchCallback = options.once
    ? (value, oldVal, cleanupRegister) => {
        cb(value, oldVal, cleanupRegister)
        stopHandle()
      }
    : cb
  const flush = options.flush ?? 'pre'

  const runJob = (token: number) => {
    if (!runner.active || paused || token !== pauseToken) {
      return
    }
    const newValue = runner()
    cleanup?.()
    cbWithOnce(newValue, oldValue, onCleanup)
    oldValue = newValue
  }
  const scheduledJob = () => runJob(scheduledToken)

  const scheduleJob = (isFirstRun: boolean) => {
    scheduledToken = pauseToken
    dispatchScheduledJob(scheduledJob, flush, isFirstRun, options.scheduler)
  }

  runner = effect(() => getter(), {
    scheduler: () => {
      if (paused) {
        return
      }
      scheduleJob(false)
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
    oldValue = runner()
  }

  if (options.immediate) {
    runJob(pauseToken)
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
  const onCleanup: OnCleanup = (fn) => {
    cleanup = fn
  }
  let runner: ReactiveEffect
  let paused = false
  let pauseToken = 0
  let scheduledToken = pauseToken
  const flush = options.flush ?? 'pre'

  const runJob = (token: number) => {
    if (!runner.active || paused || token !== pauseToken) {
      return
    }
    runner()
  }
  const scheduledJob = () => runJob(scheduledToken)

  const scheduleJob = (isFirstRun: boolean) => {
    scheduledToken = pauseToken
    dispatchScheduledJob(scheduledJob, flush, isFirstRun)
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
    scheduleJob(true)
  }
  onScopeDispose(stopHandle)
  return stopHandle
}
