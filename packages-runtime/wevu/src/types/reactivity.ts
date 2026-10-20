import type { Ref as VueRef, ShallowRef as VueShallowRef } from '@vue/reactivity'

/** 保持 Vue Ref 的品牌和读写泛型，不加载模板或宿主声明。 */
export type Ref<T = any, S = T> = VueRef<T, S>
export type ShallowRef<T = any, S = T> = VueShallowRef<T, S>

export type ComputedGetter<T> = () => T
export type ComputedSetter<T> = (value: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}
