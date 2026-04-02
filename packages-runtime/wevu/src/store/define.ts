import type {
  ActionSubscriber,
  DefineStoreOptions,
  StoreGetters,
  StoreManager,
  StoreSubscribeOptions,
  SubscriptionCallback,
} from './types'
import { effectScope } from '../reactivity'
import { createOptionsStyleStore } from './define/optionsStyle'
import { createSetupStyleStore } from './define/setupStyle'
import { createStore } from './manager'

type SetupDefinition<T> = () => T

/**
 * @description 定义一个 setup 风格的 store
 */
export function defineStore<T extends Record<string, any>>(id: string, setup: SetupDefinition<T>): () => T & {
  $id: string
  $patch: (patch: Record<string, any> | ((state: any) => void)) => void
  $reset: () => void
  $subscribe: (cb: SubscriptionCallback<any>, opts?: StoreSubscribeOptions) => () => void
  $onAction: (cb: ActionSubscriber<any>) => () => void
}
/**
 * @description 定义一个 options 风格的 store
 */
export function defineStore<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>>(
  id: string,
  options: DefineStoreOptions<S, G, A>,
): () => S & StoreGetters<G> & A & {
  $id: string
  $state: S
  $patch: (patch: Partial<S> | ((state: S) => void)) => void
  $reset: () => void
  $subscribe: (cb: SubscriptionCallback<S>, opts?: StoreSubscribeOptions) => () => void
  $onAction: (cb: ActionSubscriber<S & StoreGetters<G> & A>) => () => void
}
export function defineStore(id: string, setupOrOptions: any) {
  let instance: any
  let created = false
  const manager = (createStore as any)._instance as StoreManager | undefined

  return function useStore(): any {
    if (created && instance) {
      return instance
    }
    created = true

    const storeScope = effectScope(true)
    instance = storeScope.run(() => {
      return typeof setupOrOptions === 'function'
        ? createSetupStyleStore(id, setupOrOptions, manager)
        : createOptionsStyleStore(id, setupOrOptions as DefineStoreOptions<any, any, any>, manager)
    })

    return instance
  }
}
