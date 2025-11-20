import type { Ref } from '../reactivity'
import { computed, isRef } from '../reactivity'

type StoreToRefsResult<T extends Record<string, any>> = {
  [K in keyof T]:
    T[K] extends (...args: any[]) => any
      ? T[K]
      : T[K] extends Ref<infer V>
        ? Ref<V>
        : Ref<T[K]>
}

export function storeToRefs<T extends Record<string, any>>(store: T): StoreToRefsResult<T> {
  const result: Record<string, any> = {}
  for (const key in store) {
    const value = (store as any)[key]
    if (typeof value === 'function') {
      result[key] = value
      continue
    }
    if (isRef(value)) {
      result[key] = value
    }
    else {
      result[key] = computed({
        get: () => (store as any)[key],
        set: (v: any) => {
          ;(store as any)[key] = v
        },
      })
    }
  }
  return result as StoreToRefsResult<T>
}
