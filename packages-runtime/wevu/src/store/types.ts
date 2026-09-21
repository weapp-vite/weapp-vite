import type { UnwrapRef } from 'vue'
import type { ComputedRef, Ref, WritableComputedRef } from '../reactivity'
import type { EffectScope } from '../reactivity/core'
import type { WatchOptions } from '../reactivity/watch/types'

/** 与 Pinia 一致的变更类型和值。 */
export const MutationType = {
  direct: 'direct',
  patchObject: 'patch object',
  patchFunction: 'patch function',
} as const
// eslint-disable-next-line ts/no-redeclare -- 与 Pinia 一致，同时导出类型和运行时值
export type MutationType = typeof MutationType[keyof typeof MutationType]
export type StateTree = Record<PropertyKey, any>
export type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> }
export type SubscriptionCallbackMutation<S>
  = | { type: 'direct' | 'patch function', storeId: string }
    | { type: 'patch object', storeId: string, payload: DeepPartial<S> }
export interface SubscriptionCallback<S = any> {
  (mutation: SubscriptionCallbackMutation<S>, state: S): void
}
/** detached 订阅不随注册时的页面或组件作用域卸载。 */
export interface StoreSubscribeOptions extends WatchOptions<boolean> {
  detached?: boolean
}
export interface ActionContext<TStore = any, TResult = any> {
  name: string
  store: TStore
  args: any[]
  after: (callback: (result: TResult) => void) => void
  onError: (callback: (error: any) => void) => void
}
export interface ActionSubscriber<TStore = any, TResult = any> {
  (context: ActionContext<TStore, TResult>): void
}
export interface PiniaPluginContext {
  store: any
  pinia: Pinia
  app: any
  options: Record<string, any>
}
export interface PiniaPlugin {
  (context: PiniaPluginContext): Partial<PiniaCustomProperties> & Record<string, any> | void
}
/** 应用的 Store 管理器，独立保存实例与状态。 */
export interface Pinia {
  state: Ref<Record<string, StateTree>>
  install: (app: any) => void
  use: (plugin: PiniaPlugin) => Pinia
  _e: EffectScope
  _s: Map<string, any>
  _p: PiniaPlugin[]
  _a: any
  /** @deprecated 使用公开的 Pinia API。 */
  _stores: Map<string, any>
  /** @deprecated 使用 use() 注册插件。 */
  _plugins: PiniaPlugin[]
}
/** @deprecated 使用 Pinia。 */
export type StoreManager = Pinia

export interface PiniaCustomProperties {}

// eslint-disable-next-line ts/no-unused-vars -- 保留 Pinia 的泛型参数名，供消费者声明合并
export interface PiniaCustomStateProperties<S extends StateTree = StateTree> {}

export interface StoreDefinition<Id extends string = string, T = any> {
  (pinia?: Pinia | null): T
  $id: Id
}
export interface StoreSetupOptions { [key: string]: any }
export type GetterTree<S extends Record<string, any>> = Record<string, (state: S) => any>
export type StoreGetters<G> = { readonly [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never }
/** 通过 action 名称同时收窄参数与异步解包后的返回值。 */
type StoreActionContext<TStore, A> = {
  [K in keyof A]: A[K] extends (...args: infer Args) => infer Result
    ? Omit<ActionContext<TStore, Awaited<Result>>, 'name' | 'args'> & { name: K, args: Args }
    : never
}[keyof A]
export interface StoreApi<Id extends string, S, TStore, A> {
  $id: Id
  $state: keyof PiniaCustomStateProperties extends never ? S : S & PiniaCustomStateProperties
  $patch: (patch: DeepPartial<S> | ((state: S) => void)) => void
  $reset: () => void
  $subscribe: (callback: SubscriptionCallback<S>, options?: StoreSubscribeOptions) => () => void
  $onAction: (callback: (context: StoreActionContext<TStore, A>) => void, detached?: boolean) => () => void
  $dispose: () => void
}
export type OptionsStore<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>, Id extends string = string>
  = UnwrapRef<S> & StoreGetters<G> & A & PiniaCustomProperties & PiniaCustomStateProperties<S>
    & StoreApi<Id, UnwrapRef<S>, OptionsStore<S, G, A, Id>, A>
export interface DefineStoreOptions<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>> {
  state?: () => S
  getters?: G & Record<string, (state: UnwrapRef<S>) => any> & ThisType<OptionsStore<S, G, A>>
  actions?: A & ThisType<OptionsStore<S, G, A>>
  [key: string]: any
}
type SetupActions<T> = { [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K] }
type SetupState<T> = { [K in keyof T as T[K] extends ComputedRef<any> | WritableComputedRef<any> | ((...args: any[]) => any) ? never : K]: UnwrapRef<T[K]> }
type SetupValues<T> = { [K in keyof T as T[K] extends ComputedRef<any> ? never : K]: UnwrapRef<T[K]> }
  & { readonly [K in keyof T as T[K] extends ComputedRef<any> ? K : never]: UnwrapRef<T[K]> }
export type SetupStore<Id extends string, T extends Record<string, any>> = SetupValues<T> & PiniaCustomProperties
  & StoreApi<Id, SetupState<T>, SetupStore<Id, T>, SetupActions<T>>
export type StoreGeneric = Record<string, any> & StoreApi<string, any, any, any>
export type StoreState<T extends StoreGeneric> = T['$state']
export type StoreActions<T extends StoreGeneric> = SetupActions<Omit<T, keyof StoreApi<any, any, any, any>>>
export type StoreGettersType<T extends StoreGeneric> = Omit<T, keyof StoreState<T> | keyof StoreActions<T> | keyof StoreApi<any, any, any, any>>
