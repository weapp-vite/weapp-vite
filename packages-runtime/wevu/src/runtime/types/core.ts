import type { ComputedDefinitions, ExtractComputed, ExtractMethods, MethodDefinitions } from '../../types/definitions'

export type { ComputedDefinitions, ExtractComputed, ExtractMethods, MethodDefinitions } from '../../types/definitions'

export type ComponentPublicInstance<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
  P = Record<string, any>,
  S = Record<string, any>,
> = D & ExtractComputed<C> & ExtractMethods<M> & {
  $attrs: Record<string, any>
  $props: P
  $refs: Record<string, any>
  $slots: S
  $set: <T extends object, K extends PropertyKey>(object: T, property: K, value: any) => any
  $delete: (object: object, property: PropertyKey) => boolean
  $emit: (event: string, ...args: any[]) => void
  $nextTick: <T = void>(fn?: (this: ComponentPublicInstance<D, C, M, P, S>) => T) => Promise<T>
  $options: { name?: string }
  $parent?: ComponentPublicInstance
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
