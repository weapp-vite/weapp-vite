import type { WritableComputedOptions } from '../../reactivity'
import type { AppConfig, ComponentPublicInstance, ComputedDefinitions, ExtractMethods, MethodDefinitions } from '../types'
import { ref } from '../../reactivity'
import { setComputedValue } from '../internal'
import { createComputedAccessors } from './computed'

export function createRuntimeContext<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  state: D
  computedDefs: C
  methodDefs: M
  appConfig: AppConfig
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
}) {
  const {
    state,
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

  const publicInstance = new Proxy(state as ComponentPublicInstance<D, C, M>, {
    get(target, key, receiver) {
      if (typeof key === 'string') {
        // setup 返回的方法会在运行时后置注入，读取版本号可确保相关 computed 在方法注入后失效重算。
        void setupMethodVersion.value
        if (key === '$state') {
          return state
        }
        if (key === '$computed') {
          return computedProxy
        }
        if (Object.prototype.hasOwnProperty.call(boundMethods, key)) {
          return boundMethods[key as keyof ExtractMethods<M>]
        }
        if ((computedRefs as any)[key]) {
          return (computedRefs as any)[key].value
        }
        if (Object.prototype.hasOwnProperty.call(appConfig.globalProperties, key)) {
          return (appConfig.globalProperties as any)[key]
        }
      }
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      if (typeof key === 'string' && (computedRefs as any)[key]) {
        setComputedValue(computedSetters, key, value)
        return true
      }
      return Reflect.set(target, key, value, receiver)
    },
    has(target, key) {
      if (typeof key === 'string' && ((computedRefs as any)[key] || Object.prototype.hasOwnProperty.call(boundMethods, key))) {
        return true
      }
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      const keys = new Set<string | symbol>()
      Reflect.ownKeys(target).forEach((key) => {
        keys.add(key as string | symbol)
      })
      Object.keys(boundMethods).forEach(key => keys.add(key))
      Object.keys(computedRefs).forEach(key => keys.add(key))
      return Array.from(keys)
    },
    getOwnPropertyDescriptor(target, key) {
      if (Reflect.has(target, key)) {
        return Object.getOwnPropertyDescriptor(target, key)
      }
      if (typeof key === 'string') {
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
        if (Object.prototype.hasOwnProperty.call(boundMethods, key)) {
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
    if (key === '__weapp_vite_inline_map' && handler && typeof handler === 'object') {
      ;(boundMethods as any)[key] = handler
    }
  })

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
