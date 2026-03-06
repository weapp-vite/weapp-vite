import type { InternalRuntimeState } from './types'
import { getCurrentInstance, onDetached, onUnload } from './hooks'

export type UpdatePerformanceListenerResult = Record<string, any>
export type UpdatePerformanceListener = (result: UpdatePerformanceListenerResult) => void
export type UseUpdatePerformanceListenerStopHandle = () => void

function resolveUpdatePerformanceSetter(
  instance: InternalRuntimeState,
): ((listener?: UpdatePerformanceListener) => void) | undefined {
  const nativeInstance = instance as Record<string, any>
  const candidate = nativeInstance.setUpdatePerformanceListener
  if (typeof candidate !== 'function') {
    return undefined
  }
  return (listener?: UpdatePerformanceListener) => {
    candidate.call(nativeInstance, listener)
  }
}

/**
 * 在 setup 中注册更新性能监听，并在卸载时自动清理。
 *
 * - 底层能力：`instance.setUpdatePerformanceListener(listener)`。
 * - 清理策略：卸载时回传 `undefined` 作为监听器，平台不支持时静默降级。
 */
export function useUpdatePerformanceListener(
  listener: UpdatePerformanceListener,
): UseUpdatePerformanceListenerStopHandle {
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('useUpdatePerformanceListener() 必须在 setup() 的同步阶段调用')
  }
  if (typeof listener !== 'function') {
    throw new TypeError('useUpdatePerformanceListener() 需要传入监听函数')
  }

  const setListener = resolveUpdatePerformanceSetter(instance)
  if (!setListener) {
    throw new Error('当前实例不支持 setUpdatePerformanceListener，请检查基础库版本或组件上下文')
  }

  setListener(listener)

  let stopped = false
  const stop = () => {
    if (stopped) {
      return
    }
    stopped = true
    try {
      setListener(undefined)
    }
    catch {
      // 忽略平台差异导致的清理异常，避免影响卸载流程
    }
  }

  onUnload(stop)
  onDetached(stop)

  return stop
}
