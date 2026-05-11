import type { InternalRuntimeState, RuntimeInstance } from '../../types'
import type { SetupInstanceMethodName } from './setupContext'
import {
  WEVU_NATIVE_INSTANCE_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
} from '@weapp-core/constants'
import { isNativeBridgeMethod } from '../../nativeBridge'
import { setupInstanceMethodNames } from './setupContext'

function hasNativeApis(instance: unknown) {
  if (!instance || typeof instance !== 'object') {
    return false
  }
  return typeof (instance as any).triggerEvent === 'function'
    || typeof (instance as any).createSelectorQuery === 'function'
    || typeof (instance as any).createIntersectionObserver === 'function'
    || typeof (instance as any).setData === 'function'
}

function isBridgeMethod(runtime: RuntimeInstance<any, any, any>, instance: any, methodName: 'triggerEvent' | 'createSelectorQuery' | 'createIntersectionObserver' | 'setData') {
  const instanceMethod = instance?.[methodName]
  if (typeof instanceMethod !== 'function') {
    return false
  }
  if (isNativeBridgeMethod(instanceMethod)) {
    return true
  }
  const runtimeProxy = runtime?.proxy as Record<string, any> | undefined
  return typeof runtimeProxy?.[methodName] === 'function' && instanceMethod === runtimeProxy[methodName]
}

function syncRuntimeNativeInstance(runtime: RuntimeInstance<any, any, any>, instance: unknown) {
  if (!runtime || !hasNativeApis(instance)) {
    return
  }
  if (instance === runtime.proxy) {
    return
  }
  const nativeCandidate = instance as Record<string, any>
  if (
    isBridgeMethod(runtime, nativeCandidate, 'triggerEvent')
    || isBridgeMethod(runtime, nativeCandidate, 'createSelectorQuery')
    || isBridgeMethod(runtime, nativeCandidate, 'createIntersectionObserver')
    || isBridgeMethod(runtime, nativeCandidate, 'setData')
  ) {
    return
  }
  const runtimeState = runtime.state
  if (!runtimeState || typeof runtimeState !== 'object') {
    return
  }
  try {
    Object.defineProperty(runtimeState, WEVU_NATIVE_INSTANCE_KEY, {
      value: nativeCandidate,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(runtimeState as any)[WEVU_NATIVE_INSTANCE_KEY] = nativeCandidate
  }
}

export function bridgeRuntimeMethodsToTarget(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
) {
  try {
    const methods = (runtime.methods as unknown) as Record<string, any>
    for (const name of Object.keys(methods)) {
      if (setupInstanceMethodNames.includes(name as SetupInstanceMethodName)) {
        continue
      }
      if (typeof (target as any)[name] !== 'function') {
        ;(target as any)[name] = function bridged(this: any, ...args: any[]) {
          const runtime = this[WEVU_PUBLIC_RUNTIME_KEY] ?? target[WEVU_PUBLIC_RUNTIME_KEY]
          syncRuntimeNativeInstance(runtime, this)
          const bound = (runtime?.methods as any)?.[name]
          if (typeof bound === 'function') {
            return bound.apply(runtime.proxy, args)
          }
        }
      }
    }
  }
  catch {
    // 桥接过程中若发生错误（如目标被封装）则忽略，避免阻断后续流程
  }
}
