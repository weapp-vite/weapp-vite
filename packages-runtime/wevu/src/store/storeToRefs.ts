import type { ComputedRef, Ref } from '../reactivity'
import type { StoreApi } from './types'
import { computed, isReactive, isReadonly, isRef, toRef } from '../reactivity'
import { isComputedRef } from '../reactivity/computed'
import { rawStore } from './view'

type IfEquals<X, Y, Yes, No> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? Yes : No
/** 仅提取状态与 getter，保留 getter 的只读类型。 */
export type StoreToRefsResult<T extends Record<string, any>> = {
  [K in keyof T as K extends keyof StoreApi<any, any, any, any> ? never : T[K] extends (...args: any[]) => any ? never : K]:
  IfEquals<{ [P in K]: T[P] }, { -readonly [P in K]: T[P] }, Ref<T[K]>, ComputedRef<T[K]>>
}
export function storeToRefs<T extends Record<string, any>>(store: T): StoreToRefsResult<T> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(rawStore(store))) {
    if (isComputedRef(value)) {
      result[key] = isReadonly(value)
        ? computed(() => store[key])
        : computed({ get: () => store[key], set: value => (store as any)[key] = value })
    }
    else if (isRef(value) || isReactive(value)) {
      result[key] = toRef(store, key)
    }
  }
  return result as StoreToRefsResult<T>
}
