import { getCurrentInstance, onDetached, onUnload } from './hooks'

export type DisposableMethodName
  = | 'dispose'
    | 'abort'
    | 'cancel'
    | 'stop'
    | 'disconnect'
    | 'destroy'
    | 'close'

export type DisposableObject = Partial<Record<DisposableMethodName, () => void>>
export type DisposableLike = (() => void) | DisposableObject

export interface DisposableBag {
  /**
   * 注册一个清理项，返回“取消注册”函数（不会立即执行清理）。
   */
  add: (target: DisposableLike | null | undefined) => () => void
  /**
   * 立即执行并清空当前 bag 中的全部清理项（幂等）。
   */
  dispose: () => void
  /**
   * 注册 timeout，并在 bag dispose 时自动 clearTimeout。
   */
  setTimeout: (
    handler: (...args: any[]) => void,
    timeout?: number,
    ...args: any[]
  ) => ReturnType<typeof setTimeout>
  /**
   * 注册 interval，并在 bag dispose 时自动 clearInterval。
   */
  setInterval: (
    handler: (...args: any[]) => void,
    timeout?: number,
    ...args: any[]
  ) => ReturnType<typeof setInterval>
}

const DISPOSABLE_METHODS: DisposableMethodName[] = [
  'dispose',
  'abort',
  'cancel',
  'stop',
  'disconnect',
  'destroy',
  'close',
]

function resolveCleanup(target: DisposableLike | null | undefined): (() => void) | undefined {
  if (!target) {
    return undefined
  }
  if (typeof target === 'function') {
    return target
  }
  for (const methodName of DISPOSABLE_METHODS) {
    const candidate = target[methodName]
    if (typeof candidate === 'function') {
      return () => candidate.call(target)
    }
  }
  return undefined
}

/**
 * 在 setup() 中创建一个“清理袋”，统一管理副作用释放。
 *
 * 典型用法：注册定时器、请求任务、事件监听退订函数，
 * 在页面/组件卸载时自动批量清理，减少内存泄漏风险。
 */
export function useDisposables(): DisposableBag {
  if (!getCurrentInstance()) {
    throw new Error('useDisposables() 必须在 setup() 的同步阶段调用')
  }

  const cleanupSet = new Set<() => void>()
  let disposed = false

  const add: DisposableBag['add'] = (target) => {
    const cleanup = resolveCleanup(target)
    if (!cleanup) {
      return () => {}
    }

    if (disposed) {
      try {
        cleanup()
      }
      catch {
        // 忽略清理项自身异常，避免影响后续流程
      }
      return () => {}
    }

    cleanupSet.add(cleanup)
    return () => {
      cleanupSet.delete(cleanup)
    }
  }

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    const queue = [...cleanupSet]
    cleanupSet.clear()
    for (const cleanup of queue) {
      try {
        cleanup()
      }
      catch {
        // 忽略单个清理项失败，保证其余清理继续执行
      }
    }
  }

  const bagSetTimeout: DisposableBag['setTimeout'] = (handler, timeout, ...args) => {
    const timer = setTimeout(handler, timeout, ...args)
    add(() => {
      clearTimeout(timer)
    })
    return timer
  }

  const bagSetInterval: DisposableBag['setInterval'] = (handler, timeout, ...args) => {
    const timer = setInterval(handler, timeout, ...args)
    add(() => {
      clearInterval(timer)
    })
    return timer
  }

  onUnload(dispose)
  onDetached(dispose)

  return {
    add,
    dispose,
    setTimeout: bagSetTimeout,
    setInterval: bagSetInterval,
  }
}
