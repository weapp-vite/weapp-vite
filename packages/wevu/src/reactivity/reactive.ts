import { track, trigger } from './core'

const reactiveMap = new WeakMap<object, any>()
const rawMap = new WeakMap<any, object>()
// Map raw target -> root raw target for version propagation
const rawRootMap = new WeakMap<object, object>()

export enum ReactiveFlags {
  IS_REACTIVE = '__r_isReactive',
  RAW = '__r_raw',
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

// Special key to represent "any change" on a reactive target to avoid deep traverse tracking.
const VERSION_KEY: unique symbol = Symbol('wevu.version')

const mutableHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    if (key === ReactiveFlags.RAW) {
      return target
    }
    const res = Reflect.get(target, key, receiver)
    track(target, key)
    if (isObject(res)) {
      // Ensure child raw points to the same root as current target
      const child = res as object
      const parentRoot = rawRootMap.get(target) ?? target
      if (!rawRootMap.has(child)) {
        rawRootMap.set(child, parentRoot)
      }
      // eslint-disable-next-line ts/no-use-before-define
      return reactive(res)
    }
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      trigger(target, key)
      // bump generic version on any write
      trigger(target, VERSION_KEY)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
      }
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      trigger(target, key)
      // bump generic version on delete
      trigger(target, VERSION_KEY)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
      }
    }
    return result
  },
  ownKeys(target) {
    track(target, Symbol.iterator)
    // also establish dependency on generic version marker
    track(target, VERSION_KEY)
    return Reflect.ownKeys(target)
  },
}

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target
  }
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const proxy = new Proxy(target, mutableHandlers)
  reactiveMap.set(target, proxy)
  rawMap.set(proxy, target)
  // initialize root mapping for a freshly observed raw target
  if (!rawRootMap.has(target)) {
    rawRootMap.set(target, target)
  }
  return proxy
}

export function isReactive(value: unknown): boolean {
  return Boolean(value && (value as any)[ReactiveFlags.IS_REACTIVE])
}

export function toRaw<T>(observed: T): T {
  return ((observed as any)?.[ReactiveFlags.RAW] ?? observed) as T
}

export function convertToReactive<T>(value: T): T {
  return isObject(value) ? reactive(value as any) : value
}

/**
 * Establish a dependency on the whole reactive object "version".
 * This lets effects react to any change on the object without deep traverse.
 */
export function touchReactive(target: object) {
  const raw = toRaw(target as any) as object
  track(raw, VERSION_KEY)
}
