import type { MutationType } from '../types'
import { computed, effect, reactive, toRaw, touchReactive } from '../../reactivity'
import { wrapAction } from '../actions'
import { createBaseApi } from '../base'
import { cloneDeep, resetObject } from '../utils'
import { createSafeNotifier, createStoreMutationTransaction } from './shared'

export function createOptionsStyleStore(id: string, options: any, manager: any) {
  const rawState = options.state ? options.state() : {}
  const state = reactive(rawState)
  const initialSnapshot = cloneDeep(toRaw(rawState))
  let notifySubscribers: (type: MutationType) => void = () => {}
  const transaction = createStoreMutationTransaction(type => notifySubscribers(type))
  const base = createBaseApi<typeof state>(id, state, transaction.notify, () => {
    resetObject(state as any, initialSnapshot)
  })

  const rawPatch = base.api.$patch
  base.api.$patch = (patch: Partial<typeof state> | ((nextState: typeof state) => void)) => {
    transaction.run(() => {
      rawPatch(patch as any)
    })
  }
  if (typeof base.api.$reset === 'function') {
    const rawReset = base.api.$reset
    base.api.$reset = () => {
      transaction.run(() => {
        rawReset()
      })
    }
  }

  notifySubscribers = createSafeNotifier(id, base.subs, () => state as any)

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
            transaction.run(() => {
              ;(base.api as any).$state = v
            })
          },
        })
      }
      else {
        Object.defineProperty(store, key, d)
      }
    }
  }

  const getterDefs = options.getters ?? {}
  Object.keys(getterDefs).forEach((key) => {
    const getter = (getterDefs as any)[key]
    if (typeof getter === 'function') {
      const c = computed(() => getter.call(store, state))
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
  let dispatchingDirect = false
  effect(() => {
    touchReactive(state)
    if (!initialized) {
      initialized = true
      return
    }
    if (transaction.active || dispatchingDirect) {
      return
    }
    dispatchingDirect = true
    try {
      notifySubscribers('direct')
    }
    finally {
      dispatchingDirect = false
    }
  })

  const plugins = manager?._plugins ?? []
  for (const plugin of plugins) {
    try {
      plugin({ store })
    }
    catch {}
  }

  return store
}
