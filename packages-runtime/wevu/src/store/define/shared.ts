import type { MutationType, SubscriptionCallback } from '../types'
import { isReactive, isRef, toRaw } from '../../reactivity'
import { cloneDeep } from '../utils'

export function isTrackableRef(value: unknown) {
  return isRef(value)
}

export function snapshotValue(value: unknown) {
  if (isReactive(value)) {
    return cloneDeep(toRaw(value as any))
  }
  if (isTrackableRef(value)) {
    return cloneDeep((value as any).value)
  }
  return cloneDeep(value)
}

export function createSafeNotifier<S>(
  storeId: string,
  subs: Set<SubscriptionCallback<S>>,
  getState: () => S,
) {
  let notifying = false
  return (type: MutationType) => {
    if (notifying) {
      return
    }
    notifying = true
    try {
      const state = getState()
      subs.forEach((cb) => {
        try {
          cb({ type, storeId }, state)
        }
        catch {}
      })
    }
    finally {
      notifying = false
    }
  }
}

export function createStoreMutationTransaction(notify: (type: MutationType) => void) {
  let depth = 0
  let pendingType: MutationType | undefined

  return {
    get active() {
      return depth > 0
    },
    notify(type: MutationType) {
      if (depth === 0) {
        notify(type)
        return
      }
      // 基础 API 最后记录外层 mutation 类型，避免内层 patch/reset 泄漏类型。
      pendingType = type
    },
    run<T>(operation: () => T): T {
      const isOutermost = depth === 0
      let succeeded = false
      depth++
      try {
        const result = operation()
        succeeded = true
        return result
      }
      finally {
        depth--
        if (isOutermost) {
          const type = pendingType
          pendingType = undefined
          if (succeeded && type) {
            notify(type)
          }
        }
      }
    },
  }
}
