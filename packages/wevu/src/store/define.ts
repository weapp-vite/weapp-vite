import type { ComputedRef } from '../reactivity'
import type { DefineStoreOptions, MutationType, StoreGetters, StoreManager } from './types'
import { computed, effect, isReactive, isRef, reactive, toRaw, touchReactive } from '../reactivity'
import { wrapAction } from './actions'
import { createBaseApi } from './base'
import { createStore } from './manager'
import { cloneDeep, resetObject } from './utils'

type SetupDefinition<T> = () => T
const hasOwn = Object.prototype.hasOwnProperty

function isTrackableRef(value: unknown) {
  return isRef(value) && hasOwn.call(value, 'dep')
}

function snapshotValue(value: unknown) {
  if (isReactive(value)) {
    return cloneDeep(toRaw(value as any))
  }
  if (isTrackableRef(value)) {
    return cloneDeep((value as any).value)
  }
  return cloneDeep(value)
}

export function defineStore<T extends Record<string, any>>(id: string, setup: SetupDefinition<T>): () => T & {
  $id: string
  $patch: (patch: Record<string, any> | ((state: any) => void)) => void
  $reset: () => void
  $subscribe: (cb: (mutation: { type: MutationType, storeId: string }, state: any) => void, opts?: { detached?: boolean }) => () => void
  $onAction: (cb: (context: any) => void) => () => void
}
export function defineStore<S extends Record<string, any>, G extends Record<string, any>, A extends Record<string, any>>(
  id: string,
  options: DefineStoreOptions<S, G, A>,
): () => S & StoreGetters<G> & A & {
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
      const initialSnapshot = new Map<string, any>()
      Object.keys(result).forEach((k) => {
        const val = (result as any)[k]
        if (typeof val === 'function' || k.startsWith('$')) {
          return
        }
        if (isRef(val) && !isTrackableRef(val)) {
          return
        }
        initialSnapshot.set(k, snapshotValue(val))
      })
      const resetImpl = () => {
        initialSnapshot.forEach((snapValue, key) => {
          const current = (instance as any)[key]
          if (isTrackableRef(current)) {
            current.value = cloneDeep(snapValue)
            return
          }
          if (isReactive(current)) {
            resetObject(current as any, snapValue)
            return
          }
          if (isRef(current)) {
            return
          }
          ;(instance as any)[key] = cloneDeep(snapValue)
        })
        notify('patch object')
      }
      const base = createBaseApi<any>(id, undefined, t => notify(t), resetImpl)
      let isPatching = false
      const rawPatch = base.api.$patch
      base.api.$patch = (patch: Record<string, any> | ((state: any) => void)) => {
        isPatching = true
        try {
          rawPatch(patch)
        }
        finally {
          isPatching = false
        }
      }
      if (typeof base.api.$reset === 'function') {
        const rawReset = base.api.$reset
        base.api.$reset = () => {
          isPatching = true
          try {
            rawReset()
          }
          finally {
            isPatching = false
          }
        }
      }
      notify = (type: MutationType) => {
        base.subs.forEach((cb) => {
          try {
            cb({ type, storeId: id }, instance)
          }
          catch {}
        })
      }
      // 将 setup 返回值与基础 API 合并，同时保留每个 getter/setter 的描述符，避免覆写访问器行为
      instance = Object.assign({}, result)
      for (const key of Object.getOwnPropertyNames(base.api)) {
        const d = Object.getOwnPropertyDescriptor(base.api, key)
        if (d) {
          if (key === '$state') {
            Object.defineProperty(instance, key, {
              enumerable: d.enumerable,
              configurable: d.configurable,
              get() {
                return (base.api as any).$state
              },
              set(v: any) {
                isPatching = true
                try {
                  ;(base.api as any).$state = v
                }
                finally {
                  isPatching = false
                }
              },
            })
          }
          else {
            Object.defineProperty(instance, key, d)
          }
        }
      }
      const directSources: any[] = []
      Object.keys(result).forEach((k) => {
        const val = (result as any)[k]
        if (typeof val === 'function' && !k.startsWith('$')) {
          ;(instance as any)[k] = wrapAction(instance, k, val, base.actionSubs)
          return
        }
        if (isTrackableRef(val)) {
          directSources.push(val)
          return
        }
        if (isReactive(val)) {
          directSources.push(val)
          return
        }
        if (isRef(val)) {
          return
        }
        if (!k.startsWith('$')) {
          let innerValue = val
          Object.defineProperty(instance, k, {
            enumerable: true,
            configurable: true,
            get() {
              return innerValue
            },
            set(next: any) {
              innerValue = next
              if (!isPatching) {
                notify('direct')
              }
            },
          })
        }
      })
      if (directSources.length > 0) {
        let initialized = false
        effect(() => {
          directSources.forEach((source) => {
            if (isTrackableRef(source)) {
              void source.value
            }
            else {
              touchReactive(source)
            }
          })
          if (!initialized) {
            initialized = true
            return
          }
          if (isPatching) {
            return
          }
          notify('direct')
        })
      }
      const plugins = manager?._plugins ?? []
      for (const plugin of plugins) {
        try {
          plugin({ store: instance })
        }
        catch {}
      }
      return instance
    }
    // 走选项式定义的分支：使用 state/getters/actions 构建带响应式状态的 store
    const options = setupOrOptions as DefineStoreOptions<any, any, any>
    const rawState = options.state ? options.state() : {}
    const state = reactive(rawState)
    const initialSnapshot = cloneDeep(toRaw(rawState))
    let notify: (type: MutationType) => void = () => {}
    const base = createBaseApi<typeof state>(id, state, t => notify(t), () => {
      resetObject(state as any, initialSnapshot)
      notify('patch object')
    })
    let isPatching = false
    const rawPatch = base.api.$patch
    base.api.$patch = (patch: Partial<typeof state> | ((nextState: typeof state) => void)) => {
      isPatching = true
      try {
        rawPatch(patch as any)
      }
      finally {
        isPatching = false
      }
    }
    if (typeof base.api.$reset === 'function') {
      const rawReset = base.api.$reset
      base.api.$reset = () => {
        isPatching = true
        try {
          rawReset()
        }
        finally {
          isPatching = false
        }
      }
    }
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
        if (key === '$state') {
          Object.defineProperty(store, key, {
            enumerable: d.enumerable,
            configurable: d.configurable,
            get() {
              return (base.api as any).$state
            },
            set(v: any) {
              isPatching = true
              try {
                ;(base.api as any).$state = v
              }
              finally {
                isPatching = false
              }
            },
          })
        }
        else {
          Object.defineProperty(store, key, d)
        }
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
    let initialized = false
    effect(() => {
      touchReactive(state)
      if (!initialized) {
        initialized = true
        return
      }
      if (isPatching) {
        return
      }
      notify('direct')
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
