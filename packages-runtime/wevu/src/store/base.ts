import type { EffectScope } from '../reactivity/core'
import type { WatchStopHandle } from '../reactivity/watch'
import type { ActionSubscriber, Pinia, StoreSubscribeOptions, SubscriptionCallback } from './types'
import { isRef, onScopeDispose, toRaw, watch } from '../reactivity'
import { queueBatchCallback, queueJob, track } from '../reactivity/core'
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
  const watchers = new Set<WatchStopHandle>()
  const syncWatchers = new Set<WatchStopHandle>()
  let initialized = false
  let paused = false
  let listening = false
  let syncListening = false
  let listenerVersion = 0
  let disposed = false
  scope.run(() => onScopeDispose(() => {
    subscriptions.clear()
    actionSubscriptions.clear()
    watchers.clear()
    syncWatchers.clear()
  }))

  function pauseSubscriptions() {
    if (!initialized) {
      return
    }
    paused = true
    watchers.forEach(watcher => watcher.pause())
  }

  function resumeWatchers(synchronous: boolean) {
    let failed = false
    let failure: unknown
    watchers.forEach((watcher) => {
      if (syncWatchers.has(watcher) !== synchronous) {
        return
      }
      try {
        watcher.resume()
      }
      catch (error) {
        if (!failed) {
          failure = error
        }
        failed = true
      }
    })
    if (failed) {
      throw failure
    }
  }

  const refreshAsyncDependencies = () => resumeWatchers(false)

  function restoreSubscriptions() {
    try {
      // 仅重收集 Store 订阅，不合并用户显式注册的同步 watcher。
      resumeWatchers(true)
    }
    finally {
      paused = false
      // 默认订阅跨同一轮的多个 patch 合并收集，避免把异步遍历退化成逐次同步遍历。
      queueJob(refreshAsyncDependencies)
      const version = ++listenerVersion
      syncListening = true
      const restoreListening = () => {
        if (listenerVersion === version) {
          listening = true
        }
      }
      // 调度失败仍须恢复监听；原始 nextTick promise 保留错误供调用方处理。
      void nextTick().then(restoreListening, restoreListening)
    }
  }
  const api: Record<string, any> = {
    $id: id,
    $patch(patch: Record<string, any> | ((state: any) => void)) {
      listening = syncListening = false
      pauseSubscriptions()
      try {
        if (typeof patch === 'function') {
          patch(pinia.state.value[id])
        }
        else {
          mergeState(pinia.state.value[id], patch)
        }
      }
      finally {
        // 取消嵌套 patch 恢复后产生的异步任务，外层 batch 排空后再收集最终依赖。
        pauseSubscriptions()
        queueBatchCallback(restoreSubscriptions)
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
      let watcher: WatchStopHandle | undefined
      const remove = addSubscription(subscriptions, callback, options.detached, () => {
        if (watcher) {
          watchers.delete(watcher)
          syncWatchers.delete(watcher)
        }
        stop()
      })
      watcher = scope.run(() => watch(
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
      ))
      if (watcher) {
        stop = watcher
        watchers.add(watcher)
        if (options.flush === 'sync' || options.scheduler) {
          syncWatchers.add(watcher)
        }
        if (paused) {
          watcher.pause()
        }
      }
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
      initialized = true
      listening = syncListening = true
    },
  }
}
