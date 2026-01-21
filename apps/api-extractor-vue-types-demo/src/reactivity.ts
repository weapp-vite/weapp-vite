import type {
  ComputedRef,
  MaybeRef,
  MaybeRefOrGetter,
  Ref,
  ShallowRef,
  UnwrapRef,
  WritableComputedRef,
} from 'vue'

export type {
  ComputedRef,
  MaybeRef,
  MaybeRefOrGetter,
  Ref,
  ShallowRef,
  UnwrapRef,
  WritableComputedRef,
}

export type ReadonlyRef<T> = Readonly<Ref<T>>
export type UnwrapMaybeRef<T> = T extends MaybeRef<infer V> ? V : T
