import type { InternalRuntimeState, MethodDefinitions } from '../../types'
import {
  WEVU_INLINE_HANDLER,
  WEVU_INLINE_MAP_KEY,
  WEVU_MODEL_HANDLER,
  WEVU_NATIVE_INSTANCE_KEY,
  WEVU_OWNER_HANDLER,
  WEVU_RESERVED_METHOD_PREFIX,
  WEVU_RUNTIME_KEY,
} from '@weapp-core/constants'
import { parseModelEventValue } from '../../internal'
import { runInlineExpression } from '../inline'

export function createComponentMethods(options: {
  userMethods: Record<string, (...args: any[]) => any>
  runtimeMethods: MethodDefinitions
}) {
  const { userMethods, runtimeMethods } = options
  const finalMethods: Record<string, (...args: any[]) => any> = {
    ...userMethods,
  }

  if (!finalMethods[WEVU_INLINE_HANDLER]) {
    finalMethods[WEVU_INLINE_HANDLER] = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const runtime = (this as any).__wevu
      const ctx = runtime?.proxy ?? this
      const inlineMap = runtime?.methods?.[WEVU_INLINE_MAP_KEY]
      return runInlineExpression(ctx, undefined, event, inlineMap)
    }
  }

  if (!finalMethods[WEVU_MODEL_HANDLER]) {
    finalMethods[WEVU_MODEL_HANDLER] = function __weapp_vite_model(this: InternalRuntimeState, event: any) {
      const path = event?.currentTarget?.dataset?.wvModel ?? event?.target?.dataset?.wvModel
      if (typeof path !== 'string' || !path) {
        return undefined
      }
      const runtime = (this as any).__wevu
      if (!runtime || typeof runtime.bindModel !== 'function') {
        return undefined
      }
      const value = parseModelEventValue(event)
      try {
        runtime.bindModel(path).update(value)
      }
      catch {
        // 忽略异常
      }
      return undefined
    }
  }

  if (!finalMethods[WEVU_OWNER_HANDLER] && typeof (runtimeMethods as any)?.[WEVU_OWNER_HANDLER] === 'function') {
    finalMethods[WEVU_OWNER_HANDLER] = (runtimeMethods as any)[WEVU_OWNER_HANDLER]
  }

  const methodNames = Object.keys(runtimeMethods ?? {})

  function resolveRuntime(instance: InternalRuntimeState) {
    const directRuntime = (instance as any).__wevu
    if (directRuntime) {
      return directRuntime
    }
    const runtimeState = (instance as any).$state
    if (runtimeState && typeof runtimeState === 'object') {
      return (runtimeState as any)[WEVU_RUNTIME_KEY]
    }
    return undefined
  }

  function syncRuntimeNativeInstance(runtime: any, instance: InternalRuntimeState) {
    if (runtime?.proxy === instance) {
      return
    }
    const runtimeProxy = runtime?.proxy as Record<string, any> | undefined
    const isBridgeMethod = (
      methodName: 'triggerEvent' | 'createSelectorQuery' | 'createIntersectionObserver' | 'setData',
    ) => {
      const instanceMethod = (instance as any)[methodName]
      if (typeof instanceMethod !== 'function') {
        return false
      }
      const proxyMethod = runtimeProxy?.[methodName]
      return typeof proxyMethod === 'function' && instanceMethod === proxyMethod
    }
    if (
      isBridgeMethod('triggerEvent')
      || isBridgeMethod('createSelectorQuery')
      || isBridgeMethod('createIntersectionObserver')
      || isBridgeMethod('setData')
    ) {
      return
    }
    const hasNativeApis = typeof (instance as any).triggerEvent === 'function'
      || typeof (instance as any).createSelectorQuery === 'function'
      || typeof (instance as any).createIntersectionObserver === 'function'
      || typeof (instance as any).setData === 'function'
    if (!hasNativeApis) {
      return
    }
    const runtimeState = runtime?.state
    if (!runtimeState || typeof runtimeState !== 'object') {
      return
    }
    if ((instance as any).$state === runtimeState) {
      return
    }
    try {
      Object.defineProperty(runtimeState, WEVU_NATIVE_INSTANCE_KEY, {
        value: instance,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
    catch {
      ;(runtimeState as any)[WEVU_NATIVE_INSTANCE_KEY] = instance
    }
  }

  for (const methodName of methodNames) {
    if (
      methodName === WEVU_INLINE_MAP_KEY
      || methodName.startsWith(WEVU_RESERVED_METHOD_PREFIX)
    ) {
      continue
    }
    const userMethod = finalMethods[methodName]
    finalMethods[methodName] = function componentMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = resolveRuntime(this)
      // 事件/方法实际调用时 this 可能是 DevTools 或平台包装后的实例，
      // 这里实时同步，避免 mounted 时缓存的实例与当前调用实例不一致。
      syncRuntimeNativeInstance(runtime, this)
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        const userResult = userMethod.apply(this, args)
        return userResult === undefined ? result : userResult
      }
      return result
    }
  }

  return {
    finalMethods,
  }
}
