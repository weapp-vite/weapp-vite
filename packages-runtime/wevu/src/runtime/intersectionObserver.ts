import type { InternalRuntimeState } from './types'
import { getCurrentInstance, onDetached, onUnload } from './hooks'
import { getMiniProgramGlobalObject } from './platform'

export type UseIntersectionObserverOptions = WechatMiniprogram.CreateIntersectionObserverOption
export type UseIntersectionObserverResult = WechatMiniprogram.IntersectionObserver

function createObserverFromInstance(
  instance: InternalRuntimeState,
  options: UseIntersectionObserverOptions,
): UseIntersectionObserverResult | undefined {
  const nativeInstance = instance as Record<string, any>
  const creator = nativeInstance.createIntersectionObserver
  if (typeof creator !== 'function') {
    return undefined
  }
  const observer = creator.call(nativeInstance, options)
  return observer as UseIntersectionObserverResult | undefined
}

function createObserverFromGlobal(
  instance: InternalRuntimeState,
  options: UseIntersectionObserverOptions,
): UseIntersectionObserverResult | undefined {
  const miniProgramGlobal = getMiniProgramGlobalObject()
  const creator = miniProgramGlobal?.createIntersectionObserver
  if (typeof creator !== 'function') {
    return undefined
  }
  const observer = creator.call(miniProgramGlobal, instance, options)
  return observer as UseIntersectionObserverResult | undefined
}

/**
 * 在 setup 中创建 IntersectionObserver，并在卸载时自动断开。
 *
 * - 优先使用 `ctx.instance.createIntersectionObserver(options)`。
 * - 不可用时回退到 `wx.createIntersectionObserver(instance, options)`。
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverResult {
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('useIntersectionObserver() 必须在 setup() 的同步阶段调用')
  }

  const observer = createObserverFromInstance(instance, options)
    ?? createObserverFromGlobal(instance, options)

  if (!observer || typeof observer.disconnect !== 'function') {
    throw new Error('当前运行环境不支持 IntersectionObserver，请检查基础库版本或平台能力')
  }

  let disconnected = false
  const disconnect = () => {
    if (disconnected) {
      return
    }
    disconnected = true
    try {
      observer.disconnect()
    }
    catch {
      // 忽略平台差异导致的断开异常，避免影响页面卸载流程
    }
  }

  onUnload(disconnect)
  onDetached(disconnect)

  return observer
}
