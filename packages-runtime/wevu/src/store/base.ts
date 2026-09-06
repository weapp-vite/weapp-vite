import type { ActionSubscriber, MutationType, SubscriptionCallback } from './types'
import { batch } from '../reactivity'
import { isObject, mergeShallow } from './utils'

export function createBaseApi<S extends Record<string, any>>(
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
  api.$patch = (patch: Record<string, unknown> | ((state: S) => void)) => {
    const mutationType: MutationType = typeof patch === 'function' ? 'patch function' : 'patch object'
    batch(() => {
      const target = stateObj ?? (api as S)
      if (typeof patch === 'function') {
        patch(target)
      }
      else {
        mergeShallow(target, patch)
      }
    })
    notify(mutationType)
  }
  if (resetImpl) {
    api.$reset = () => {
      batch(resetImpl)
      notify('patch object')
    }
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
