import type { MutationType } from '../types'
import { effect, isReactive, isRef, touchReactive } from '../../reactivity'
import { wrapAction } from '../actions'
import { createBaseApi } from '../base'
import { cloneDeep, resetObject } from '../utils'
import { createSafeNotifier, createStoreMutationTransaction, isTrackableRef, snapshotValue } from './shared'

export function createSetupStyleStore(id: string, setupFactory: () => Record<string, any>, manager: any) {
  const result = setupFactory()
  let notifySubscribers: (type: MutationType) => void = () => {}
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

  let instance: Record<string, any> = {}
  const resetImpl = () => {
    initialSnapshot.forEach((snapValue, key) => {
      const current = (instance as any)[key]
      if (isTrackableRef(current)) {
        try {
          current.value = cloneDeep(snapValue)
        }
        catch {
          // computed / readonly ref 不能写入，reset 时跳过这类派生状态。
        }
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
  }

  const transaction = createStoreMutationTransaction(type => notifySubscribers(type))
  const base = createBaseApi<any>(id, undefined, transaction.notify, resetImpl)
  const rawPatch = base.api.$patch
  base.api.$patch = (patch: Record<string, any> | ((state: any) => void)) => {
    transaction.run(() => {
      rawPatch(patch)
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

  instance = { ...result }
  notifySubscribers = createSafeNotifier(id, base.subs, () => instance)

  // 将 setup 返回值与基础 API 合并，同时保留每个 getter/setter 的描述符，避免覆写访问器行为
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
            transaction.run(() => {
              ;(base.api as any).$state = v
            })
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
          if (!transaction.active) {
            notifySubscribers('direct')
          }
        },
      })
    }
  })

  let dispatchingDirect = false
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
