import type { Ref } from './ref'
import { isObject } from './reactive'
import { isRef } from './ref'

/**
 * readonly creates a shallow readonly proxy for objects/arrays and
 * a readonly wrapper for Refs. It is intentionally shallow to keep
 * the implementation light for the mini-program environment.
 */
export function readonly<T extends object>(target: T): T
export function readonly<T>(target: Ref<T>): Readonly<Ref<T>>
export function readonly(target: any): any {
  if (isRef(target)) {
    const source = target
    return {
      get value() {
        return source.value
      },
      set value(_v: any) {
        throw new Error('Cannot assign to a readonly ref')
      },
    }
  }
  if (!isObject(target)) {
    return target
  }
  return new Proxy(target as object, {
    set() {
      throw new Error('Cannot set property on readonly object')
    },
    deleteProperty() {
      throw new Error('Cannot delete property on readonly object')
    },
    defineProperty() {
      throw new Error('Cannot define property on readonly object')
    },
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver)
      // keep it shallow - return as is for nested objects
      return res
    },
  })
}
