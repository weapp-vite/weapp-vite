import type { Ref } from './ref'
import { customRef, isRef } from './ref'

/**
 * 为源响应式对象的单个属性创建 ref，可读可写并与原属性保持同步。
 *
 * @param object 源响应式对象
 * @param key 属性名
 * @returns 指向该属性的 ref
 *
 * @example
 * ```ts
 * const state = reactive({ foo: 1 })
 * const fooRef = toRef(state, 'foo')
 *
 * fooRef.value++
 * console.log(state.foo) // 2
 * ```
 */
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): Ref<T[K]>
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K],
): Ref<T[K]>
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K],
): Ref<T[K]> {
  const value = object[key]

  if (isRef(value)) {
    return value
  }

  return customRef<T[K]>((track, trigger) => ({
    get() {
      track()
      return object[key]
    },
    set(newValue) {
      ;(object as any)[key] = newValue
      trigger()
    },
  }), defaultValue) as Ref<T[K]>
}

/**
 * 将一个响应式对象转换成“同结构的普通对象”，其中每个字段都是指向原对象对应属性的 ref。
 *
 * @param object 待转换的响应式对象
 * @returns 包含若干 ref 的普通对象
 *
 * @example
 * ```ts
 * const state = reactive({ foo: 1, bar: 2 })
 * const stateAsRefs = toRefs(state)
 *
 * stateAsRefs.foo.value++ // 2
 * state.foo // 2
 * ```
 */
export function toRefs<T extends object>(object: T): ToRefs<T> {
  const result: any = Array.isArray(object) ? Array.from({ length: object.length }) : {}

  for (const key in object) {
    result[key] = toRef(object, key)
  }

  return result
}

/**
 * toRefs 返回值的类型辅助
 */
export type ToRefs<T extends object> = {
  [K in keyof T]: Ref<T[K]>
}
