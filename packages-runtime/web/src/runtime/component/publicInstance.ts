import type { ComponentPublicInstance } from './types'
import { hasOwn } from '../utils/object'

const componentPublicInstanceTargets = new WeakMap<object, ComponentPublicInstance>()

export function resolveComponentPublicInstanceTarget(value: unknown) {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  return componentPublicInstanceTargets.get(value)
}

export function createComponentPublicInstance(
  target: ComponentPublicInstance,
  runtimePrototype: object,
  resolveComponentMethod?: (key: PropertyKey) => unknown,
  componentProperties?: Readonly<Record<string, unknown>>,
): ComponentPublicInstance {
  type RuntimeMethod = (...args: any[]) => unknown
  const runtimeMethods = new Map<PropertyKey, { source: RuntimeMethod, bound: RuntimeMethod }>()

  const publicInstance = new Proxy(target, {
    get(instance, key) {
      const ownDescriptor = Reflect.getOwnPropertyDescriptor(instance, key)
      // 只有声明的 prop 冲突才优先方法表；普通自有字段与不可配置属性保持宿主语义。
      if (ownDescriptor && (!ownDescriptor.configurable || !componentProperties || !hasOwn(componentProperties, key))) {
        return Reflect.get(instance, key, instance)
      }
      const runtimeDescriptor = Reflect.getOwnPropertyDescriptor(runtimePrototype, key)
      if (runtimeDescriptor && !ownDescriptor) {
        const value = Reflect.get(instance, key, instance)
        if (typeof value !== 'function') {
          return value
        }
        const cached = runtimeMethods.get(key)
        if (cached && cached.source === value) {
          return cached.bound
        }
        const bound = value.bind(instance)
        runtimeMethods.set(key, { source: value, bound })
        return bound
      }
      // 公共实例解析方法；DOM 同名属性仍由父级输入驱动。
      const componentMethod = resolveComponentMethod?.(key)
      if (typeof componentMethod === 'function') {
        return componentMethod
      }
      if (ownDescriptor) {
        return Reflect.get(instance, key, instance)
      }
      return typeof key === 'symbol' ? Reflect.get(instance, key, instance) : undefined
    },
    set(instance, key, value) {
      if (Reflect.getOwnPropertyDescriptor(instance, key) || typeof key === 'symbol') {
        return Reflect.set(instance, key, value, instance)
      }
      Reflect.defineProperty(instance, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      })
      return true
    },
    has(instance, key) {
      return Reflect.getOwnPropertyDescriptor(instance, key) !== undefined
        || Reflect.getOwnPropertyDescriptor(runtimePrototype, key) !== undefined
        || typeof resolveComponentMethod?.(key) === 'function'
        || (typeof key === 'symbol' && Reflect.has(instance, key))
    },
  })
  componentPublicInstanceTargets.set(publicInstance, target)
  return publicInstance
}
