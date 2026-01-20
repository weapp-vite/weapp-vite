import type { ComputedGetter, WritableComputedOptions } from '../../reactivity'
import type { TriggerEventOptions } from './miniprogram'

export type ComputedDefinitions = Record<string, ComputedGetter<any> | WritableComputedOptions<any>>
export type MethodDefinitions = Record<string, (...args: any[]) => any>

export type ExtractComputed<C extends ComputedDefinitions> = {
  [K in keyof C]: C[K] extends ComputedGetter<infer R> ? R
    : C[K] extends WritableComputedOptions<infer R> ? R : never
}

export type ExtractMethods<M extends MethodDefinitions> = {
  [K in keyof M]: M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never
}

export type ComponentPublicInstance<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
  P = Record<string, any>,
  S = Record<string, any>,
> = D & ExtractComputed<C> & ExtractMethods<M> & {
  $attrs: Record<string, any>
  $props: P
  $slots: S
  $emit: (event: string, detail?: any, options?: TriggerEventOptions) => void
}

export interface ModelBindingOptions<
  T = any,
  Event extends string = string,
  ValueProp extends string = string,
  Formatted = T,
> {
  event?: Event
  valueProp?: ValueProp
  parser?: (payload: any) => T
  formatter?: (value: T) => Formatted
}

export type ModelBindingPayload<
  T = any,
  Event extends string = 'input',
  ValueProp extends string = 'value',
  Formatted = T,
> = {
  [K in ValueProp]: Formatted
} & {
  [K in `on${Capitalize<Event>}`]: (event: any) => void
}

export interface ModelBinding<T = any> {
  value: T
  update: (value: T) => void
  model: <Event extends string = 'input', ValueProp extends string = 'value', Formatted = T>(
    options?: ModelBindingOptions<T, Event, ValueProp, Formatted>,
  ) => ModelBindingPayload<T, Event, ValueProp, Formatted>
}
