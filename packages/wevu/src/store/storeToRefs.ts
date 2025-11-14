import type { Ref } from '../reactivity'
import { computed, isRef } from '../reactivity'

export function storeToRefs<T extends Record<string, any>>(store: T): {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : Ref<T[K]>
} {
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
  return result as any
}
