import { isReactive, isRef, reactive, toRaw } from '../reactivity'
import { ReactiveFlags } from '../reactivity/reactive/shared'
import { isPlainObject } from './utils'

const views = new WeakMap<object, any>()

/** 仅在 Store 边界解包 ref，所有读写仍转发到原始响应式来源。 */
export function storeView<T extends object>(source: T): T {
  if ((source as any)[ReactiveFlags.SKIP]) {
    return source
  }
  if (!isPlainObject(source) && !Array.isArray(source)) {
    return source
  }
  const target = isReactive(source) ? source : reactive(source)
  const cached = views.get(target)
  if (cached) {
    return cached
  }
  const storeViewValue = (value: any): any => value && typeof value === 'object' ? storeView(value) : value
  const view = new Proxy(target, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver)
      if (key === ReactiveFlags.RAW || key === ReactiveFlags.SKIP) {
        return value
      }
      if (isRef(value)) {
        return Array.isArray(object) && typeof key === 'string' && /^\d+$/.test(key)
          ? value
          : storeViewValue(value.value)
      }
      return storeViewValue(value)
    },
    set(object, key, value, receiver) {
      const previous = Reflect.get(object, key, receiver)
      if (isRef(previous) && !isRef(value) && !Array.isArray(object)) {
        previous.value = value
        return true
      }
      return Reflect.set(object, key, value, receiver)
    },
  })
  views.set(target, view)
  views.set(view, view)
  return view
}

/** 合并普通对象，数组替换；保留 ref 和已有响应式对象的写入语义。 */
export function mergeState(target: Record<string, any>, patch: Record<string, any>) {
  if (target instanceof Map && patch instanceof Map) {
    patch.forEach((value, key) => target.set(key, value))
  }
  else if (target instanceof Set && patch instanceof Set) {
    patch.forEach(value => target.add(value))
  }
  for (const key of Object.keys(patch ?? {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }
    const value = patch[key]
    if (isPlainObject(target[key]) && isPlainObject(value) && !isRef(value) && !isReactive(value)) {
      mergeState(target[key], value)
    }
    else {
      target[key] = value
    }
  }
}

/** 返回尚未解包的属性，供 storeToRefs 保留 state/getter 的来源。 */
export function rawStore(store: object): Record<string, any> {
  return toRaw(store)
}
