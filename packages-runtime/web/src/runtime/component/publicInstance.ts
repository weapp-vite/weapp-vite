import type { ComponentPublicInstance } from './types'

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
): ComponentPublicInstance {
  type RuntimeMethod = (...args: any[]) => unknown
  const runtimeMethods = new Map<PropertyKey, { source: RuntimeMethod, bound: RuntimeMethod }>()

  const publicInstance = new Proxy(target, {
    get(instance, key) {
      const ownDescriptor = Reflect.getOwnPropertyDescriptor(instance, key)
      if (ownDescriptor) {
        return Reflect.get(instance, key, instance)
      }
      const runtimeDescriptor = Reflect.getOwnPropertyDescriptor(runtimePrototype, key)
      if (runtimeDescriptor) {
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
      const componentMethod = resolveComponentMethod?.(key)
      if (typeof componentMethod === 'function') {
        return componentMethod
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
