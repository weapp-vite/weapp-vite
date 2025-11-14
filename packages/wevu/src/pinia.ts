import type { Ref } from './reactivity'
import { computed, isRef } from './reactivity'

export interface Pinia {
  install: (app: any) => void
  _stores: Map<string, any>
  use: (plugin: (context: { store: any }) => void) => void
  _plugins: Array<(context: { store: any }) => void>
}

export function createPinia(): Pinia {
  const pinia: Pinia = {
    _stores: new Map(),
    _plugins: [],
    install(_app: any) {
      // no-op for mini program runtime
    },
    use(plugin: (context: { store: any }) => void) {
      if (typeof plugin === 'function') {
        pinia._plugins.push(plugin)
      }
      return pinia
    },
  }
  return pinia
}

type StoreDefinition<T> = () => T

export function defineStore<T extends Record<string, any>>(_id: string, setup: StoreDefinition<T>) {
  let store: T | undefined
  const pinia = (createPinia as any)._instance as Pinia | undefined
  return function useStore(): T {
    if (!store) {
      store = setup()
      // apply simple plugins if any
      const plugins = pinia?._plugins ?? []
      for (const plugin of plugins) {
        try {
          plugin({ store })
        }
        catch {
          // ignore plugin errors
        }
      }
    }
    return store as T
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
