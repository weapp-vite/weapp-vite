import type { DefineStoreOptions, OptionsStore, Pinia, SetupStore, StoreDefinition, StoreSetupOptions } from './types'
import { createStoreInstance } from './define/create'
import { getActivePinia, setActivePinia } from './manager'

/** 定义 Setup Store，返回值在实例上自动解包 ref。 */
export function defineStore<Id extends string, T extends Record<string, any>>(
  id: Id,
  setup: () => T,
  options?: StoreSetupOptions,
): StoreDefinition<Id, SetupStore<Id, T>>
/** 定义 Options Store，共享 state/getters/actions 的 this 类型。 */
export function defineStore<Id extends string, S extends Record<string, any> = Record<never, never>, G extends Record<string, any> = Record<never, never>, A extends Record<string, any> = Record<never, never>>(
  id: Id,
  options: DefineStoreOptions<S, G, A>,
): StoreDefinition<Id, OptionsStore<S, G, A, Id>>
export function defineStore(id: string, setupOrOptions: any, options?: StoreSetupOptions) {
  const useStore = (pinia?: Pinia | null) => {
    const owner = pinia ?? getActivePinia()
    if (!owner) {
      throw new Error('没有活动的 Pinia，请先调用 app.use(createPinia()) 或显式传入 Pinia')
    }
    setActivePinia(owner)
    if (!owner._s.has(id)) {
      createStoreInstance(id, setupOrOptions, owner, options)
    }
    return owner._s.get(id)
  }
  useStore.$id = id
  return useStore
}
