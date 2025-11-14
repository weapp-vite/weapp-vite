import type { Ref } from './reactivity'
import { computed, isRef } from './reactivity'

export interface Store {
  install: (app: any) => void
  _stores: Map<string, any>
  use: (plugin: (context: { store: any }) => void) => void
  _plugins: Array<(context: { store: any }) => void>
}

export function createStore(): Store {
  const store: Store = {
    _stores: new Map(),
    _plugins: [],
    install(_app: any) {
      // no-op for mini program runtime
    },
    use(plugin: (context: { store: any }) => void) {
      if (typeof plugin === 'function') {
        store._plugins.push(plugin)
      }
      return store
    },
  }
  return store
}

type StoreDefinition<T> = () => T

export function defineStore<T extends Record<string, any>>(_id: string, setup: StoreDefinition<T>) {
  let instance: T | undefined
  const manager = (createStore as any)._instance as Store | undefined
  return function useStore(): T {
    if (!instance) {
      instance = setup()
      // apply simple plugins if any
      const plugins = manager?._plugins ?? []
      for (const plugin of plugins) {
        try {
          plugin({ store: instance })
        }
        catch {
          // ignore plugin errors
        }
      }
    }
    return instance as T
  }
}

export function storeToRefs<T extends Record<string, any>>(store: T): {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : Ref<T[K]>
} {
  const result: Record<string, any> = {}
  for (const key in store) {
    const value = (store as any)[key]
    if (typeof value === 'function') {
      // skip functions; keep original
      result[key] = value
      continue
    }
    if (isRef(value)) {
      result[key] = value
    }
    else {
      result[key] = computed({
        get: () => (store as any)[key],
        set: (v: any) => {
          ;(store as any)[key] = v
        },
      })
    }
  }
  return result as any
}
