import type { ComputedRef } from '../reactivity'
import type { DefineStoreOptions, MutationType, StoreManager } from './types'
import { computed, reactive, toRaw } from '../reactivity'
import { wrapAction } from './actions'
import { createBaseApi } from './base'
import { createStore } from './manager'
import { mergeShallow } from './utils'

type SetupDefinition<T> = () => T

export function defineStore<T extends Record<string, any>>(id: string, setup: SetupDefinition<T>): () => T & {
  $id: string
  $patch: (patch: Record<string, any> | ((state: any) => void)) => void
  $subscribe: (cb: (mutation: { type: MutationType, storeId: string }, state: any) => void, opts?: { detached?: boolean }) => () => void
  $onAction: (cb: (context: any) => void) => () => void
}
export function defineStore<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>>(
  id: string,
  options: DefineStoreOptions<S, G, A>,
): () => S & G & A & {
  $id: string
  $state: S
  $patch: (patch: Partial<S> | ((state: S) => void)) => void
  $reset: () => void
  $subscribe: (cb: (mutation: { type: MutationType, storeId: string }, state: S) => void, opts?: { detached?: boolean }) => () => void
  $onAction: (cb: (context: any) => () => void) => () => void
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
    if (typeof setupOrOptions === 'function') {
      const result = setupOrOptions()
      let notify: (type: MutationType) => void = () => {}
      const base = createBaseApi<any>(id, undefined, t => notify(t))
      notify = (type: MutationType) => {
        base.subs.forEach((cb) => {
          try {
            cb({ type, storeId: id }, instance)
          }
          catch {}
        })
      }
      // compose result with base api while preserving accessors
      instance = Object.assign({}, result)
      for (const key of Object.getOwnPropertyNames(base.api)) {
        const d = Object.getOwnPropertyDescriptor(base.api, key)
        if (d) {
          Object.defineProperty(instance, key, d)
        }
      }
      Object.keys(result).forEach((k) => {
        const val = (result as any)[k]
        if (typeof val === 'function' && !k.startsWith('$')) {
          ;(instance as any)[k] = wrapAction(instance, k, val, base.actionSubs)
        }
      })
      const plugins = manager?._plugins ?? []
      for (const plugin of plugins) {
        try {
          plugin({ store: instance })
        }
        catch {}
      }
      return instance
    }
    // Options store
    const options = setupOrOptions as DefineStoreOptions<any, any, any>
    const rawState = options.state ? options.state() : {}
    const state = reactive(rawState)
    const initialSnapshot = { ...toRaw(rawState) }
    let notify: (type: MutationType) => void = () => {}
    const base = createBaseApi<typeof state>(id, state, t => notify(t), () => {
      mergeShallow(state as any, initialSnapshot)
      notify('patch object')
    })
    notify = (type: MutationType) => {
      base.subs.forEach((cb) => {
        try {
          cb({ type, storeId: id }, state)
        }
        catch {}
      })
    }
    const store: Record<string, any> = {}
    for (const key of Object.getOwnPropertyNames(base.api)) {
      const d = Object.getOwnPropertyDescriptor(base.api, key)
      if (d) {
        Object.defineProperty(store, key, d)
      }
    }
    const getterDefs = options.getters ?? {}
    const computedMap: Record<string, ComputedRef<any>> = {}
    Object.keys(getterDefs).forEach((key) => {
      const getter = (getterDefs as any)[key]
      if (typeof getter === 'function') {
        const c = computed(() => getter.call(store, state))
        computedMap[key] = c
        Object.defineProperty(store, key, {
          enumerable: true,
          configurable: true,
          get() {
            return c.value
          },
        })
      }
    })
    const actionDefs = options.actions ?? {}
    Object.keys(actionDefs).forEach((key) => {
      const act = (actionDefs as any)[key]
      if (typeof act === 'function') {
        const wrapped = wrapAction(store as any, key, (...args: any[]) => {
          return act.apply(store as any, args)
        }, base.actionSubs)
        store[key] = wrapped
      }
    })
    Object.keys(state).forEach((k) => {
      Object.defineProperty(store, k, {
        enumerable: true,
        configurable: true,
        get() {
          return (state as any)[k]
        },
        set(v: any) {
          ;(state as any)[k] = v
        },
      })
    })
    instance = store
    const plugins = manager?._plugins ?? []
    for (const plugin of plugins) {
      try {
        plugin({ store: instance })
      }
      catch {}
    }
    return instance
  }
}
