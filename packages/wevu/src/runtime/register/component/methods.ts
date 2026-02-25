import type { InternalRuntimeState, MethodDefinitions } from '../../types'
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

  if (!finalMethods.__weapp_vite_inline) {
    finalMethods.__weapp_vite_inline = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const runtime = (this as any).__wevu
      const ctx = runtime?.proxy ?? this
      const inlineMap = runtime?.methods?.__weapp_vite_inline_map
      return runInlineExpression(ctx, undefined, event, inlineMap)
    }
  }

  if (!finalMethods.__weapp_vite_model) {
    finalMethods.__weapp_vite_model = function __weapp_vite_model(this: InternalRuntimeState, event: any) {
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

  if (!finalMethods.__weapp_vite_owner && typeof (runtimeMethods as any)?.__weapp_vite_owner === 'function') {
    finalMethods.__weapp_vite_owner = (runtimeMethods as any).__weapp_vite_owner
  }

  const methodNames = Object.keys(runtimeMethods ?? {})

  function resolveRuntime(instance: InternalRuntimeState) {
    const directRuntime = (instance as any).__wevu
    if (directRuntime) {
      return directRuntime
    }
    const runtimeState = (instance as any).$state
    if (runtimeState && typeof runtimeState === 'object') {
      return (runtimeState as any).__wevuRuntime
    }
    return undefined
  }

  function syncRuntimeNativeInstance(runtime: any, instance: InternalRuntimeState) {
    if (runtime?.proxy === instance) {
      return
    }
    const runtimeProxy = runtime?.proxy as Record<string, any> | undefined
    const isBridgeMethod = (methodName: 'triggerEvent' | 'createSelectorQuery' | 'setData') => {
      const instanceMethod = (instance as any)[methodName]
      if (typeof instanceMethod !== 'function') {
        return false
      }
      const proxyMethod = runtimeProxy?.[methodName]
      return typeof proxyMethod === 'function' && instanceMethod === proxyMethod
    }
    if (isBridgeMethod('triggerEvent') || isBridgeMethod('createSelectorQuery') || isBridgeMethod('setData')) {
      return
    }
    const hasNativeApis = typeof (instance as any).triggerEvent === 'function'
      || typeof (instance as any).createSelectorQuery === 'function'
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
      Object.defineProperty(runtimeState, '__wevuNativeInstance', {
        value: instance,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
    catch {
      ;(runtimeState as any).__wevuNativeInstance = instance
    }
  }

  for (const methodName of methodNames) {
    if (methodName.startsWith('__weapp_vite_')) {
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
