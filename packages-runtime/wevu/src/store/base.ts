import type { EffectScope } from '../reactivity/core'
import type { ActionSubscriber, Pinia, StoreSubscribeOptions, SubscriptionCallback } from './types'
import { isRef, onScopeDispose, toRaw, watch } from '../reactivity'
import { track } from '../reactivity/core'
import { ReactiveFlags } from '../reactivity/reactive/shared'
import { nextTick } from '../scheduler'
import { addSubscription, noop } from './subscriptions'
import { MutationType } from './types'
import { mergeState } from './view'

/** 逐层追踪公开值与键增删，ref 解包不消耗额外的 state 深度。 */
function trackState(value: any, depth: number, seen = new Map<object, number>()) {
  if (!value || typeof value !== 'object' || depth <= 0) {
    return
  }
  if ((seen.get(value) ?? 0) >= depth) {
    return
  }
  seen.set(value, depth)
  if (isRef(value)) {
    trackState(value.value, depth, seen)
    return
  }
  if (value[ReactiveFlags.SKIP]) {
    return
  }
  const raw = toRaw(value)
  track(raw, Symbol.iterator)
  if (Array.isArray(value)) {
    track(raw, 'length')
  }
  for (const key of Object.keys(raw)) {
    trackState(value[key], depth - 1, seen)
  }
}

/** 管理单个 Store 的事务、订阅和显式释放，状态由 Pinia 持有。 */
export function createBaseApi(id: string, pinia: Pinia, scope: EffectScope, getStore: () => any) {
  const subscriptions = new Set<SubscriptionCallback>()
  const actionSubscriptions = new Set<ActionSubscriber>()
  let listening = false
  let syncListening = false
  let listenerVersion = 0
  let disposed = false
  scope.run(() => onScopeDispose(() => {
    subscriptions.clear()
    actionSubscriptions.clear()
  }))
  const api: Record<string, any> = {
    $id: id,
    $patch(patch: Record<string, any> | ((state: any) => void)) {
      listening = syncListening = false
      try {
        if (typeof patch === 'function') {
          patch(pinia.state.value[id])
        }
        else {
          mergeState(pinia.state.value[id], patch)
        }
      }
      finally {
        // 外层修改完成后才取得版本，避免内层 patch 提前恢复异步监听。
        const version = ++listenerVersion
        syncListening = true
        void nextTick().then(() => {
          if (listenerVersion === version) {
            listening = true
          }
        })
      }
      const mutation = typeof patch === 'function'
        ? { type: MutationType.patchFunction, storeId: id }
        : { type: MutationType.patchObject, storeId: id, payload: patch }
      subscriptions.forEach(callback => callback(mutation, pinia.state.value[id]))
    },
    $subscribe(callback: SubscriptionCallback, options: StoreSubscribeOptions = {}) {
      if (subscriptions.has(callback)) {
        return noop
      }
      let stop = noop
      const remove = addSubscription(subscriptions, callback, options.detached, () => stop())
      stop = scope.run(() => watch(
        () => {
          // Store 按公开状态遍历，避免版本树的整树订阅忽略数字 deep 的边界。
          const state = pinia.state.value[id]
          if (options.deep === false) {
            return state
          }
          trackState(state, typeof options.deep === 'number' ? options.deep : Infinity)
          return { state }
        },
        (value) => {
          if (options.flush === 'sync' ? syncListening : listening) {
            callback({ type: MutationType.direct, storeId: id }, options.deep === false ? value : value.state)
          }
        },
        { ...options, deep: false },
      )) ?? noop
      return remove
    },
    $onAction(callback: ActionSubscriber, detached?: boolean) {
      return addSubscription(actionSubscriptions, callback, detached)
    },
    $dispose() {
      if (disposed) {
        return
      }
      disposed = true
      try {
        scope.stop()
      }
      finally {
        subscriptions.clear()
        actionSubscriptions.clear()
        if (pinia._s.get(id) === getStore()) {
          pinia._s.delete(id)
        }
      }
    },
  }
  Object.defineProperty(api, '$state', {
    configurable: true,
    get: () => pinia.state.value[id],
    set: state => api.$patch((target: any) => Object.assign(target, state)),
  })
  return {
    api,
    actionSubscriptions,
    // 创建流程拥有初始化边界，插件注册的同步订阅不能观察半初始化状态。
    activateSubscriptions() {
      listening = syncListening = true
    },
  }
}
