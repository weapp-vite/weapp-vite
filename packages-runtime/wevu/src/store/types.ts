/**
 * @description Store 变更类型
 */
export type MutationType = 'patch object' | 'patch function' | 'direct'

/**
 * @description Store 订阅回调签名
 */
export interface SubscriptionCallback<S = any> {
  (mutation: { type: MutationType, storeId: string }, state: S): void
}

/**
 * @description Store 订阅选项
 */
export interface StoreSubscribeOptions {
  /**
   * @description 是否在卸载后仍保留订阅（适用于跨页面生命周期的订阅）
   */
  detached?: boolean
}

/**
 * @description Action 订阅回调上下文
 */
export interface ActionContext<TStore = any> {
  name: string
  store: TStore
  args: any[]
  after: (cb: (result: any) => void) => void
  onError: (cb: (error: any) => void) => void
}

/**
 * @description Action 订阅回调类型
 */
export interface ActionSubscriber<TStore = any> {
  (context: ActionContext<TStore>): void
}

/**
 * @description Store 管理器（插件与共享实例）
 */
export interface StoreManager {
  install: (app: any) => void
  _stores: Map<string, any>
  use: (plugin: (context: { store: any }) => void) => StoreManager
  _plugins: Array<(context: { store: any }) => void>
}

/**
 * @description Getter 定义集合
 */
export type GetterTree<S extends Record<string, any>> = Record<string, (state: S) => any>

/**
 * @description 从 Getter 定义中推导返回类型
 */
export type StoreGetters<G extends GetterTree<any>> = {
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

/**
 * @description defineStore(options) 的配置类型
 */
export interface DefineStoreOptions<
  S extends Record<string, any>,
  G extends GetterTree<S>,
  A extends Record<string, any>,
> {
  state: () => S
  getters?: G & Record<string, (state: S) => any> & ThisType<S & StoreGetters<G> & A>
  actions?: A & ThisType<S & StoreGetters<G> & A>
}
