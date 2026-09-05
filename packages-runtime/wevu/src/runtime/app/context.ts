import type { WritableComputedOptions } from '../../reactivity'
import type { AppConfig, ComponentPublicInstance, ComputedDefinitions, ExtractMethods, MethodDefinitions } from '../types'
import {
  WEVU_COMPONENT_NAME_KEY,
  WEVU_HOST_COMMIT_PROMISE_KEY,
  WEVU_INLINE_MAP_KEY,
  WEVU_NATIVE_INSTANCE_KEY,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROPS_KEY,
  WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD,
  WEVU_RUNTIME_APP_KEY,
  WEVU_RUNTIME_KEY,
} from '@weapp-core/constants'
import { isRef, ref, toRaw } from '../../reactivity'
import { nextTick } from '../../scheduler'
import { hasOwn } from '../../utils'
import { normalizeEmitEventName, normalizeEmitPayload } from '../emit'
import { setComputedValue } from '../internal'
import { isNativeBridgeMethod, markNativeBridgeMethod } from '../nativeBridge'
import { createComputedAccessors } from './computed'

export function createRuntimeContext<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  state: D
  setupState: Record<string, any>
  computedDefs: C
  methodDefs: M
  appConfig: AppConfig
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
}) {
  const {
    state,
    setupState,
    computedDefs,
    methodDefs,
    appConfig,
    includeComputed,
    setDataStrategy,
  } = options

  const boundMethods = {} as ExtractMethods<M>
  const {
    computedRefs,
    computedSetters,
    dirtyComputedKeys,
    createTrackedComputed,
    computedProxy,
  } = createComputedAccessors({ includeComputed, setDataStrategy })
  const setupMethodVersion = ref(0)
  const instanceFields = Object.create(null) as Record<PropertyKey, any>

  const resolveNativeInstance = (target: object, receiver: object) => {
    const rawTarget = toRaw(target as any) as Record<string, any>
    const runtimeRef = rawTarget[WEVU_RUNTIME_KEY]
    const runtimeProxy = runtimeRef?.proxy as Record<string, any> | undefined
    const isBridgeMethod = (
      candidate: object,
      methodName: 'triggerEvent' | 'createSelectorQuery' | 'createIntersectionObserver' | 'setData',
    ) => {
      const candidateMethod = (candidate as any)[methodName]
      return isNativeBridgeMethod(candidateMethod)
    }
    const isValidNativeCandidate = (candidate: unknown) => {
      if (!candidate || typeof candidate !== 'object') {
        return false
      }
      if (candidate === target || candidate === receiver || candidate === runtimeProxy) {
        return false
      }
      if (
        isBridgeMethod(candidate, 'triggerEvent')
        || isBridgeMethod(candidate, 'createSelectorQuery')
        || isBridgeMethod(candidate, 'createIntersectionObserver')
        || isBridgeMethod(candidate, 'setData')
      ) {
        return false
      }
      return true
    }
    const directNative = rawTarget[WEVU_NATIVE_INSTANCE_KEY]
    if (isValidNativeCandidate(directNative)) {
      return directNative as object
    }
    const runtimeNative = runtimeRef?.instance
    if (isValidNativeCandidate(runtimeNative)) {
      return runtimeNative as object
    }
    return undefined
  }

  const installNativeMethodBridge = (methodName: string) => {
    if (hasOwn(boundMethods, methodName)) {
      return
    }
    const bridge = (...args: any[]) => {
      const nativeInstance = resolveNativeInstance(state as object, state as object)
      if (!nativeInstance) {
        return undefined
      }
      const nativeMethod = Reflect.get(nativeInstance, methodName)
      if (typeof nativeMethod === 'function') {
        return nativeMethod.apply(nativeInstance, args)
      }
      return undefined
    }
    markNativeBridgeMethod(bridge)
    ;(boundMethods as any)[methodName] = bridge
  }

  const resolveGlobalProperty = (nativeInstance: object | undefined, key: string) => {
    const seen = new Set<object>()
    let current = nativeInstance as Record<string, any> | undefined
    while (current && !seen.has(current)) {
      seen.add(current)
      const globalProperties = current[WEVU_RUNTIME_APP_KEY]?.config?.globalProperties
      if (globalProperties && hasOwn(globalProperties, key)) {
        return { found: true, value: globalProperties[key] }
      }
      current = current[WEVU_PARENT_INSTANCE_KEY]
    }

    const getAppFn = typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, any>).getApp
      : undefined
    if (typeof getAppFn === 'function') {
      try {
        const rootAppInstance = getAppFn()
        const globalProperties = rootAppInstance?.[WEVU_RUNTIME_APP_KEY]?.config?.globalProperties
        if (globalProperties && hasOwn(globalProperties, key)) {
          return { found: true, value: globalProperties[key] }
        }
      }
      catch {
        // App 尚未初始化时保持普通属性回退语义。
      }
    }
    return { found: false, value: undefined }
  }

  const resolveParentPublicInstance = (nativeInstance: object | undefined) => {
    const selectOwnerComponent = nativeInstance && Reflect.get(nativeInstance, 'selectOwnerComponent')
    if (typeof selectOwnerComponent !== 'function') {
      return undefined
    }
    try {
      const owner = selectOwnerComponent.call(nativeInstance)
      if (!owner || typeof owner !== 'object') {
        return undefined
      }
      const resolvePublicInstance = Reflect.get(owner, WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD)
      if (typeof resolvePublicInstance === 'function') {
        const publicInstance = resolvePublicInstance.call(owner)
        if (publicInstance) {
          return publicInstance
        }
      }
      return owner[WEVU_RUNTIME_KEY]?.proxy ?? owner.__wevu?.proxy ?? owner
    }
    catch {
      return undefined
    }
  }

  const publicInstance = new Proxy(state as ComponentPublicInstance<D, C, M>, {
    get(target, key, receiver) {
      if (typeof key === 'string') {
        // setup 返回的方法会在运行时后置注入，读取版本号可确保相关 computed 在方法注入后失效重算。
        void setupMethodVersion.value
        if (hasOwn(setupState, key)) {
          return Reflect.get(setupState, key, receiver)
        }
        if (key === 'props') {
          const props = (target as any)[WEVU_PROPS_KEY]
          if (props && typeof props === 'object') {
            return props
          }
        }
        if (key === '$props') {
          const props = (target as any)[WEVU_PROPS_KEY]
          if (props && typeof props === 'object') {
            return props
          }
        }
        const props = (target as any)[WEVU_PROPS_KEY]
        if (props && typeof props === 'object' && hasOwn(props, key)) {
          return Reflect.get(props, key)
        }
        if (key === 'data') {
          return state
        }
        if (key === '$state') {
          return state
        }
        if (key === '$computed') {
          return computedProxy
        }
        if (key === '$emit') {
          return (eventName: string, ...args: any[]) => {
            const nativeInstance = resolveNativeInstance(target as object, receiver as object)
            const triggerEvent = nativeInstance && Reflect.get(nativeInstance, 'triggerEvent')
            if (typeof triggerEvent !== 'function') {
              return undefined
            }
            const { detail, options } = normalizeEmitPayload(args)
            return triggerEvent.call(nativeInstance, normalizeEmitEventName(eventName), detail, options)
          }
        }
        if (key === '$nextTick') {
          return async <T>(fn?: () => T) => {
            await nextTick()
            const nativeInstance = resolveNativeInstance(target as object, receiver as object)
            const hostCommit = nativeInstance && Reflect.get(nativeInstance, WEVU_HOST_COMMIT_PROMISE_KEY)
            if (
              hostCommit
              && (typeof hostCommit === 'object' || typeof hostCommit === 'function')
              && 'then' in hostCommit
              && typeof hostCommit.then === 'function'
            ) {
              await hostCommit
            }
            if (fn) {
              return fn.call(publicInstance)
            }
          }
        }
        if (key === '$set') {
          return (object: Record<PropertyKey, any>, property: PropertyKey, value: any) => {
            Reflect.set(object, property, value)
            return value
          }
        }
        if (key === '$delete') {
          return (object: Record<PropertyKey, any>, property: PropertyKey) => Reflect.deleteProperty(object, property)
        }
        if (key === '$slots') {
          const rawTarget = toRaw(target as any) as Record<string, any>
          return rawTarget.$slots ?? Object.freeze(Object.create(null))
        }
        if (key === '$refs') {
          const rawTarget = toRaw(target as any) as Record<string, any>
          return rawTarget.$refs ?? Object.create(null)
        }
        if (key === '$parent') {
          return resolveParentPublicInstance(resolveNativeInstance(target as object, receiver as object))
        }
        if (key === '$options') {
          const nativeInstance = resolveNativeInstance(target as object, receiver as object) as Record<string, any> | undefined
          return {
            name: nativeInstance?.[WEVU_COMPONENT_NAME_KEY] ?? nativeInstance?.name ?? nativeInstance?.is,
          }
        }
        if (hasOwn(instanceFields, key)) {
          return Reflect.get(instanceFields, key)
        }
        if (hasOwn(boundMethods, key)) {
          return boundMethods[key as keyof ExtractMethods<M>]
        }
        if ((computedRefs as any)[key]) {
          return (computedRefs as any)[key].value
        }
        if (hasOwn(appConfig.globalProperties, key)) {
          return (appConfig.globalProperties as any)[key]
        }
        const globalProperty = resolveGlobalProperty(
          resolveNativeInstance(target as object, receiver as object),
          key,
        )
        if (globalProperty.found) {
          return globalProperty.value
        }
      }
      if (!Reflect.has(target, key)) {
        const nativeInstance = resolveNativeInstance(target as object, receiver as object)
        if (nativeInstance && Reflect.has(nativeInstance, key)) {
          const nativeValue = Reflect.get(nativeInstance, key)
          if (typeof nativeValue === 'function') {
            return nativeValue.bind(nativeInstance)
          }
          return nativeValue
        }
      }
      const targetValue = Reflect.get(target, key, receiver)
      if (typeof key === 'string' && hasOwn(setupState, key)) {
        return Reflect.get(setupState, key, receiver)
      }
      return targetValue
    },
    set(target, key, value, receiver) {
      if (typeof key === 'string' && (computedRefs as any)[key]) {
        setComputedValue(computedSetters, key, value)
        return true
      }
      if (hasOwn(setupState, key)) {
        const existingValue = Reflect.get(setupState, key, receiver)
        if (isRef(existingValue) && !isRef(value)) {
          existingValue.value = value
          return true
        }
        return Reflect.set(setupState, key, value, receiver)
      }
      if (hasOwn(instanceFields, key)) {
        return Reflect.set(instanceFields, key, value)
      }
      if (Reflect.has(target, key)) {
        const existingValue = Reflect.get(target, key, receiver)
        if (isRef(existingValue) && !isRef(value)) {
          existingValue.value = value
          return true
        }
        if (hasOwn((target as any)[WEVU_PROPS_KEY] ?? {}, key)) {
          return Reflect.set(setupState, key, value, receiver)
        }
        return Reflect.set(target, key, value, receiver)
      }
      return Reflect.set(instanceFields, key, value)
    },
    has(target, key) {
      if (
        key === 'data'
        || key === '$emit'
        || key === '$nextTick'
        || key === '$set'
        || key === '$delete'
        || key === '$slots'
        || key === '$refs'
        || key === '$parent'
        || key === '$options'
      ) {
        return true
      }
      if (typeof key === 'string' && (hasOwn(setupState, key) || (computedRefs as any)[key] || hasOwn(boundMethods, key))) {
        return true
      }
      if (hasOwn(instanceFields, key)) {
        return true
      }
      const nativeInstance = resolveNativeInstance(target as object, target as object)
      if (typeof key === 'string' && resolveGlobalProperty(nativeInstance, key).found) {
        return true
      }
      if (nativeInstance && Reflect.has(nativeInstance, key)) {
        return true
      }
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      const keys = new Set<string | symbol>()
      Reflect.ownKeys(target).forEach((key) => {
        keys.add(key as string | symbol)
      })
      Reflect.ownKeys(setupState).forEach((key) => {
        keys.add(key as string | symbol)
      })
      Reflect.ownKeys(instanceFields).forEach(key => keys.add(key))
      Object.keys(boundMethods).forEach(key => keys.add(key))
      Object.keys(computedRefs).forEach(key => keys.add(key))
      return [...keys]
    },
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && hasOwn(setupState, key)) {
        return Object.getOwnPropertyDescriptor(setupState, key)
      }
      if (hasOwn(instanceFields, key)) {
        return Object.getOwnPropertyDescriptor(instanceFields, key)
      }
      if (Reflect.has(target, key)) {
        return Object.getOwnPropertyDescriptor(target, key)
      }
      if (typeof key === 'string') {
        if (key === 'data') {
          return {
            configurable: true,
            enumerable: false,
            get() {
              return state
            },
          }
        }
        if ((computedRefs as any)[key]) {
          return {
            configurable: true,
            enumerable: true,
            get() {
              return (computedRefs as any)[key].value
            },
            set(value: any) {
              setComputedValue(computedSetters, key, value)
            },
          }
        }
        if (hasOwn(boundMethods, key)) {
          return {
            configurable: true,
            enumerable: false,
            value: boundMethods[key as keyof ExtractMethods<M>],
          }
        }
      }
      return undefined
    },
  })

  Object.keys(methodDefs).forEach((key) => {
    const handler = (methodDefs as any)[key]
    if (typeof handler === 'function') {
      ;(boundMethods as any)[key] = (...args: any[]) => handler.apply(publicInstance, args)
      return
    }
    if (key === WEVU_INLINE_MAP_KEY && handler && typeof handler === 'object') {
      ;(boundMethods as any)[key] = handler
    }
  })

  installNativeMethodBridge('triggerEvent')
  installNativeMethodBridge('createSelectorQuery')
  installNativeMethodBridge('createIntersectionObserver')
  installNativeMethodBridge('setData')

  Object.keys(computedDefs).forEach((key) => {
    const definition = (computedDefs as any)[key] as ((this: any) => any) | WritableComputedOptions<any>
    if (typeof definition === 'function') {
      computedRefs[key] = createTrackedComputed(key, () => (definition as any).call(publicInstance))
    }
    else {
      const getter = definition.get?.bind(publicInstance)
      if (!getter) {
        throw new Error(`计算属性 "${key}" 需要提供 getter`)
      }
      const setter = definition.set?.bind(publicInstance)
      if (setter) {
        computedSetters[key] = setter
        computedRefs[key] = createTrackedComputed(key, getter, setter)
      }
      else {
        computedRefs[key] = createTrackedComputed(key, getter)
      }
    }
  })

  return {
    boundMethods,
    computedRefs,
    computedSetters,
    dirtyComputedKeys,
    computedProxy,
    publicInstance,
    touchSetupMethodsVersion() {
      setupMethodVersion.value += 1
    },
  }
}
