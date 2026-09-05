import { AbortControllerPolyfill } from '@wevu/web-apis/abort'
import { batch, onScopeDispose, runWithoutTracking } from './core'
import { reactive } from './reactive'
import { readonly } from './readonly'

/** 异步派生状态的生命周期阶段。 */
export type AsyncDerivationStatus
  = | 'idle'
    | 'initial-pending'
    | 'ready'
    | 'refreshing'
    | 'error'
    | 'disposed'

/** 传给异步加载函数的当前任务上下文。 */
export interface AsyncDerivationContext {
  readonly signal: AbortSignal
}

/** `useAsyncDerivation()` 的配置。 */
export interface UseAsyncDerivationOptions {
  immediate?: boolean
}

type AsyncDerivationIdleState = Readonly<{
  status: 'idle' | 'initial-pending' | 'disposed'
  value: undefined
  error: undefined
}>

type AsyncDerivationReadyState<T> = Readonly<{
  status: 'ready' | 'refreshing'
  value: T
  error: undefined
}>

type AsyncDerivationErrorState<T> = Readonly<{
  status: 'error'
  value: T | undefined
  error: unknown
}>

/** 模板可观察的只读异步派生状态。 */
export type AsyncDerivationState<T>
  = | AsyncDerivationIdleState
    | AsyncDerivationReadyState<T>
    | AsyncDerivationErrorState<T>

type AsyncDerivationControls = Readonly<{
  refresh: () => Promise<void>
  dispose: () => void
}>

/** 异步派生状态及其非枚举控制方法。 */
export type AsyncDerivation<T> = AsyncDerivationState<T> & AsyncDerivationControls

interface MutableAsyncDerivationState<T> {
  status: AsyncDerivationStatus
  value: T | undefined
  error: unknown
}

interface AsyncDerivationCycle {
  readonly promise: Promise<void>
  readonly resolve: () => void
}

const RESOLVED_PROMISE: Promise<void> = Promise.resolve()

function createAsyncDerivationCycle(): AsyncDerivationCycle {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/**
 * 创建面向静态 WXML 数据绑定的异步派生状态。
 * 加载错误通过 `status` 与 `error` 暴露，`refresh()` 始终正常完成。
 */
export function useAsyncDerivation<T>(
  loader: (context: AsyncDerivationContext) => T | PromiseLike<T>,
  options: UseAsyncDerivationOptions = {},
): AsyncDerivation<T> {
  const storage: MutableAsyncDerivationState<T> = {
    status: 'idle',
    value: undefined,
    error: undefined,
  }
  const state = reactive(storage)
  let activeController: AbortController | undefined
  let activeCycle: AsyncDerivationCycle | undefined
  let generation = 0
  let hasValue = false
  let disposed = false

  function settleLatestCycle(completedGeneration: number) {
    if (disposed || completedGeneration !== generation) {
      return
    }
    const cycle = activeCycle
    activeCycle = undefined
    cycle?.resolve()
  }

  function commitValue(completedGeneration: number, value: T) {
    if (disposed || completedGeneration !== generation) {
      return
    }
    activeController = undefined
    hasValue = true
    try {
      batch(() => {
        state.status = 'ready'
        state.value = value
        state.error = undefined
      })
    }
    finally {
      settleLatestCycle(completedGeneration)
    }
  }

  function commitError(completedGeneration: number, error: unknown) {
    if (disposed || completedGeneration !== generation) {
      return
    }
    activeController = undefined
    try {
      batch(() => {
        state.status = 'error'
        state.error = error
        if (!hasValue) {
          state.value = undefined
        }
      })
    }
    finally {
      settleLatestCycle(completedGeneration)
    }
  }

  function refresh(): Promise<void> {
    if (disposed) {
      return RESOLVED_PROMISE
    }

    const cycle = activeCycle ?? createAsyncDerivationCycle()
    activeCycle = cycle
    const currentGeneration = ++generation
    const previousController = activeController
    // eslint-disable-next-line mini-program/no-implicit-runtime-polyfill -- 缺失宿主实现时显式回退兼容层。
    const Controller = typeof AbortController === 'function' ? AbortController : AbortControllerPolyfill
    const controller = new Controller() as unknown as AbortController
    activeController = controller
    try {
      previousController?.abort()
    }
    catch {
      // 原生 EventTarget 不把 abort listener 异常传播给调用者，兼容实现保持相同控制流。
    }

    if (disposed || currentGeneration !== generation) {
      return cycle.promise
    }

    batch(() => {
      state.status = hasValue ? 'refreshing' : 'initial-pending'
      state.error = undefined
    })

    if (disposed || currentGeneration !== generation) {
      return cycle.promise
    }

    runWithoutTracking(() => {
      // 自有 Promise 避免原生 Promise 的身份快路径把 then 访问移出收养边界。
      const task = new Promise<T>((resolve) => {
        resolve(loader({ signal: controller.signal }))
      })
      void task.then(
        value => commitValue(currentGeneration, value),
        error => commitError(currentGeneration, error),
      ).catch((error) => {
        // 观察者异常交给宿主报告，不改写加载结果，也不阻塞 refresh 的完成。
        setTimeout(() => {
          throw error
        }, 0)
      })
    })
    return cycle.promise
  }

  function dispose() {
    if (disposed) {
      return
    }
    disposed = true
    generation += 1
    const controller = activeController
    activeController = undefined
    try {
      controller?.abort()
    }
    catch {
      // dispose 必须完成状态清理和 waiter 结算，不能被 listener 异常中断。
    }
    try {
      batch(() => {
        state.status = 'disposed'
        state.value = undefined
        state.error = undefined
      })
    }
    finally {
      hasValue = false
      const cycle = activeCycle
      activeCycle = undefined
      cycle?.resolve()
    }
  }

  Object.defineProperties(storage, {
    refresh: {
      value: refresh,
    },
    dispose: {
      value: dispose,
    },
  })

  const result = readonly(state) as AsyncDerivation<T>
  onScopeDispose(dispose)
  if (options.immediate ?? true) {
    void refresh()
  }
  return result
}
