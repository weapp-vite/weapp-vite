import type { Ref } from './ref'
import { isObject } from './reactive'
import { isRef } from './ref'

/**
 * readonly 会为对象/数组创建一个“浅层”只读代理，并为 Ref 创建只读包装。
 * 选择浅层而非深层递归，是为了在小程序环境中保持实现和运行时开销最小，
 * 仅阻止直接属性写入/删除，嵌套对象仍按原样透传。
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
      // 仅处理顶层属性，嵌套对象维持原引用以避免深拷贝和额外代理
      return res
    },
  })
}
