import { track, trigger } from '../core'
import { bumpRawVersion, rawVersionMap } from './patchState'
import { isObject, ReactiveFlags, toRaw, VERSION_KEY } from './shared'
import { rawMap, shallowReactiveMap } from './state'

const shallowHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    if (key === ReactiveFlags.RAW) {
      return target
    }
    const res = Reflect.get(target, key, receiver)
    track(target, key)
    // 浅层模式：不对嵌套对象做自动响应式转换
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      trigger(target, key)
      // 浅层同样维护通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      trigger(target, key)
      // 删除时也同步通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
    }
    return result
  },
  ownKeys(target) {
    track(target, Symbol.iterator)
    // 遍历时订阅通用版本号
    track(target, VERSION_KEY)
    return Reflect.ownKeys(target)
  },
}

/**
 * 创建一个浅层响应式代理：仅跟踪第一层属性变更，不深度递归嵌套对象。
 *
 * @param target 待转换的对象
 * @returns 浅层响应式代理
 *
 * @example
 * ```ts
 * const state = shallowReactive({ nested: { count: 0 } })
 *
 * state.nested.count++ // 不会触发 effect（嵌套对象未深度代理）
 * state.nested = { count: 1 } // 会触发 effect（顶层属性变更）
 * ```
 */
export function shallowReactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target
  }
  const existingProxy = shallowReactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const proxy = new Proxy(target, shallowHandlers)
  shallowReactiveMap.set(target, proxy)
  rawMap.set(proxy, target)
  if (!rawVersionMap.has(target)) {
    rawVersionMap.set(target, 0)
  }
  // 浅层响应式不初始化根映射，避免误导深度版本追踪
  return proxy
}

/**
 * 判断一个值是否为 shallowReactive 创建的浅层响应式对象
 */
export function isShallowReactive(value: unknown): boolean {
  const raw = toRaw(value as any)
  return shallowReactiveMap.has(raw)
}
