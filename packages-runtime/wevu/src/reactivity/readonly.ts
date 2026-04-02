import type { Ref } from './ref'
import { isObject, isReactive } from './reactive'
import { ReactiveFlags } from './reactive/shared'
import { isRef, markAsRef } from './ref'

function createReadonlyWrapper(target: any): any {
  if (isRef(target)) {
    const source = target
    const readonlyRef = markAsRef({
      get value() {
        return source.value
      },
      set value(_v: any) {
        throw new Error('无法给只读 ref 赋值')
      },
    })
    Object.defineProperties(readonlyRef, {
      [ReactiveFlags.IS_READONLY]: {
        value: true,
        configurable: true,
      },
      [ReactiveFlags.RAW]: {
        value: source,
        configurable: true,
      },
    })
    return readonlyRef
  }
  if (!isObject(target)) {
    return target
  }
  return new Proxy(target as object, {
    set() {
      throw new Error('无法在只读对象上设置属性')
    },
    deleteProperty() {
      throw new Error('无法在只读对象上删除属性')
    },
    defineProperty() {
      throw new Error('无法在只读对象上定义属性')
    },
    get(target, key, receiver) {
      if (key === ReactiveFlags.IS_READONLY) {
        return true
      }
      if (key === ReactiveFlags.RAW) {
        return target
      }
      const res = Reflect.get(target, key, receiver)
      // 仅处理顶层属性，嵌套对象维持原引用以避免深拷贝和额外代理
      return res
    },
  })
}

/**
 * readonly 会为对象/数组创建一个“浅层”只读代理，并为 Ref 创建只读包装。
 * 选择浅层而非深层递归，是为了在小程序环境中保持实现和运行时开销最小，
 * 仅阻止直接属性写入/删除，嵌套对象仍按原样透传。
 */
export function readonly<T extends object>(target: T): T
export function readonly<T>(target: Ref<T>): Readonly<Ref<T>>
export function readonly(target: any): any {
  return createReadonlyWrapper(target)
}

/**
 * 与 Vue 3 的 `shallowReadonly()` 对齐。
 *
 * 当前 wevu 的只读语义本身就是浅层只读，因此这里直接复用同一套实现，
 * 让依赖 Vue 兼容 API 的代码可以无缝迁移。
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T>
export function shallowReadonly<T>(target: Ref<T>): Readonly<Ref<T>>
export function shallowReadonly(target: any): any {
  return createReadonlyWrapper(target)
}

/**
 * 判断值是否为只读代理或只读 ref 包装。
 */
export function isReadonly(value: unknown): boolean {
  return Boolean(value && (value as any)[ReactiveFlags.IS_READONLY])
}

/**
 * 判断值是否为响应式代理或只读代理。
 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}
