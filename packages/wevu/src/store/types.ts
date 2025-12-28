export type MutationType = 'patch object' | 'patch function'

export interface SubscriptionCallback<S = any> {
  (mutation: { type: MutationType, storeId: string }, state: S): void
}

export interface ActionSubscriber<TStore = any> {
  (context: {
    name: string
    store: TStore
    args: any[]
    after: (cb: (result: any) => void) => void
    onError: (cb: (error: any) => void) => void
  }): void
}

export interface StoreManager {
  install: (app: any) => void
  _stores: Map<string, any>
  use: (plugin: (context: { store: any }) => void) => StoreManager
  _plugins: Array<(context: { store: any }) => void>
}

export type GetterTree<S extends Record<string, any>> = Record<string, (state: S) => any>

export type StoreGetters<G extends GetterTree<any>> = {
  [K in keyof G]: G[K] extends (...args: any[]) => infer R ? R : never
}

export interface DefineStoreOptions<
  S extends Record<string, any>,
  G extends GetterTree<S>,
  A extends Record<string, any>,
> {
  state: () => S
  getters?: G & Record<string, (state: S) => any> & ThisType<S & StoreGetters<G> & A>
  actions?: A & ThisType<S & StoreGetters<G> & A>
}
