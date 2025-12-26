import type { Ref } from './ref'
import { isReactive } from './reactive'
import { customRef, isRef } from './ref'

/**
 * Converts a reactive object to a plain object where each property
 * is a ref pointing to the corresponding property of the original object.
 *
 * @param object - The reactive object to convert
 * @returns A plain object with refs
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
  if (!isReactive(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }

  const result: any = Array.isArray(object) ? Array.from({ length: object.length }) : {}

  for (const key in object) {
    result[key] = toRef(object, key)
  }

  return result
}

/**
 * Creates a ref for a property on a source reactive object.
 * The ref can be used to read and write the property value.
 *
 * @param object - The reactive object
 * @param key - The property key
 * @returns A ref for the property
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
 * Type helper for toRefs return value
 */
export type ToRefs<T extends object> = {
  [K in keyof T]: Ref<T[K]>
}
