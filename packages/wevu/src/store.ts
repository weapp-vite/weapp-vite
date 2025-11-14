import type { ComputedRef, Ref } from './reactivity'
import { computed, isRef, reactive, toRaw } from './reactivity'

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

export function createStore(): StoreManager {
  const manager: StoreManager = {
    _stores: new Map(),
    _plugins: [],
    install(_app: any) {
      // noop in mini-program
    },
    use(plugin: (context: { store: any }) => void) {
      if (typeof plugin === 'function') {
        manager._plugins.push(plugin)
      }
      return manager
    },
  }
  ;(createStore as any)._instance = manager
  return manager
}

function isObject(val: unknown): val is object {
  return typeof val === 'object' && val !== null
}

function mergeShallow(target: Record<string, any>, patch: Record<string, any>) {
  for (const k in patch) {
    target[k] = patch[k]
  }
}

function wrapAction<TStore extends Record<string, any>>(
  store: TStore,
  name: string,
  action: (...args: any[]) => any,
  actionSubs: Set<ActionSubscriber<TStore>>,
) {
  return function wrapped(this: any, ...args: any[]) {
    const afterCbs: Array<(r: any) => void> = []
    const errorCbs: Array<(e: any) => void> = []
    const after = (cb: (r: any) => void) => afterCbs.push(cb)
    const onError = (cb: (e: any) => void) => errorCbs.push(cb)
    actionSubs.forEach((sub) => {
      try {
        sub({ name, store, args, after, onError })
      }
      catch {
        // ignore subscriber error
      }
    })
    let res: any
    try {
      res = action.apply(store, args)
    }
    catch (e) {
      errorCbs.forEach(cb => cb(e))
      throw e
    }
    const finalize = (r: any) => {
      afterCbs.forEach(cb => cb(r))
      return r
    }
    if (res && typeof (res as Promise<any>).then === 'function') {
      return (res as Promise<any>).then(
        r => finalize(r),
        (e) => {
          errorCbs.forEach(cb => cb(e))
          return Promise.reject(e)
        },
      )
    }
    return finalize(res)
  }
}

function createBaseApi<S extends Record<string, any>>(
  id: string,
  stateObj: S | undefined,
  notify: (type: MutationType) => void,
  resetImpl?: () => void,
) {
  const api: any = {
    $id: id,
  }
  Object.defineProperty(api, '$state', {
    get() {
      return stateObj
    },
    set(v: any) {
      if (stateObj && isObject(v)) {
        mergeShallow(stateObj, v)
        notify('patch object')
      }
    },
  })
  api.$patch = (patch: Record<string, any> | ((state: S) => void)) => {
    if (!stateObj) {
      if (typeof patch === 'function') {
        patch(api as S)
        notify('patch function')
      }
      else {
        mergeShallow(api as any, patch)
        notify('patch object')
      }
      return
    }
    if (typeof patch === 'function') {
      patch(stateObj)
      notify('patch function')
    }
    else {
      mergeShallow(stateObj, patch)
      notify('patch object')
    }
  }
  if (resetImpl) {
    api.$reset = () => resetImpl()
  }
  const subs = new Set<SubscriptionCallback<S>>()
  api.$subscribe = (cb: SubscriptionCallback<S>, _opts?: { detached?: boolean }) => {
    subs.add(cb)
    return () => subs.delete(cb)
  }
  const actionSubs = new Set<ActionSubscriber<any>>()
  api.$onAction = (cb: ActionSubscriber<any>) => {
    actionSubs.add(cb)
    return () => actionSubs.delete(cb)
  }
  return { api, subs, actionSubs }
}

type SetupDefinition<T> = () => T

export function defineStore<T extends Record<string, any>>(id: string, setup: SetupDefinition<T>): () => T & {
  $id: string
  $patch: (patch: Record<string, any> | ((state: any) => void)) => void
  $subscribe: (cb: SubscriptionCallback<any>, opts?: { detached?: boolean }) => () => void
  $onAction: (cb: ActionSubscriber<any>) => () => void
}
export function defineStore<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>>(
  id: string,
  options: DefineStoreOptions<S, G, A>,
): () => S & G & A & {
  $id: string
  $state: S
  $patch: (patch: Partial<S> | ((state: S) => void)) => void
  $reset: () => void
  $subscribe: (cb: SubscriptionCallback<S>, opts?: { detached?: boolean }) => () => void
  $onAction: (cb: ActionSubscriber<any>) => () => void
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

export function storeToRefs<T extends Record<string, any>>(store: T): {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : Ref<T[K]>
} {
  const result: Record<string, any> = {}
  for (const key in store) {
    const value = (store as any)[key]
    if (typeof value === 'function') {
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
