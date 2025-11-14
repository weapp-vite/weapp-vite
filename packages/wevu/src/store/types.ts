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

export interface DefineStoreOptions<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>> {
  state: () => S
  getters?: G & ThisType<S & G & A>
  actions?: A & ThisType<S & G & A>
}
