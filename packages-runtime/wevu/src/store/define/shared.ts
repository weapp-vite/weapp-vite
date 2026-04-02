import type { MutationType, SubscriptionCallback } from '../types'
import { isReactive, isRef, toRaw } from '../../reactivity'
import { cloneDeep } from '../utils'

const hasOwn = Object.prototype.hasOwnProperty

export function isTrackableRef(value: unknown) {
  return isRef(value) && hasOwn.call(value, 'dep')
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
