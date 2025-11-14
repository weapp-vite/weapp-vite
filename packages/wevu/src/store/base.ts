import type { ActionSubscriber, MutationType, SubscriptionCallback } from './types'
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
