import type { DefineComponent, ExtractPropTypes, PropType } from 'vue'

export type { ExtractPropTypes, PropType }

export type PropsOf<T> = T extends new (...args: any[]) => { $props: infer P }
  ? P
  : never

export type ExtractedProps<T> = T extends { props: infer P }
  ? ExtractPropTypes<P>
  : never

export type PropsFromComponent<T extends DefineComponent> = PropsOf<T>

export type WithDefaults<T, D extends Partial<T>> = Omit<T, keyof D> & Required<D>
