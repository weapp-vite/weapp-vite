import type { Pinia } from '../types'
import { computed, effectScope, isReactive, isRef, toRef } from '../../reactivity'
import { isComputedRef } from '../../reactivity/computed'
import { wrapAction } from '../actions'
import { createBaseApi } from '../base'
import { setActivePinia } from '../manager'
import { mergeState, storeView } from '../view'

/** 创建 Store 实例；state 与实例缓存分离，释放实例后可继续复用状态。 */
export function createStoreInstance(id: string, definition: any, pinia: Pinia, setupOptions?: any) {
  const scope = pinia._e.run(() => effectScope())
  if (!scope) {
    throw new Error('不能在已释放的 Pinia 上创建 Store')
  }
  const hadState = Object.prototype.hasOwnProperty.call(pinia.state.value, id)
  const isSetup = typeof definition === 'function'
  const raw: Record<string, any> = {}
  const store = storeView(raw)
  const base = createBaseApi(id, pinia, scope, () => store)
  Object.defineProperties(raw, Object.getOwnPropertyDescriptors(base.api))
  pinia._s.set(id, store)

  try {
    scope.run(() => {
      if (!hadState) {
        pinia.state.value[id] = storeView(isSetup ? {} : definition.state?.() ?? {})
      }
      const initial = pinia.state.value[id]
      const result: Record<string, any> = isSetup ? definition() : {}
      const options = isSetup ? { ...setupOptions, actions: {} } : { ...definition }
      const actionDefinitions: Record<string, any> = isSetup ? options.actions : definition.actions ?? {}

      if (!isSetup) {
        for (const key of Object.keys(initial)) {
          result[key] = toRef(initial, key)
        }
        for (const [key, getter] of Object.entries(definition.getters ?? {})) {
          result[key] = computed(() => {
            setActivePinia(pinia)
            return (getter as any).call(store, store)
          })
        }
        Object.assign(result, actionDefinitions)
      }
      raw.$reset = isSetup
        ? () => {
            // eslint-disable-next-line mini-program/no-unsupported-runtime-api, node/prefer-global/process -- 构建期常量，两个发布入口分别替换为 production/development
            if (process.env.NODE_ENV !== 'production') {
              throw new Error(`Store "${id}" 使用 setup 语法，必须自行实现 $reset()`)
            }
          }
        : () => store.$patch((state: any) => Object.assign(state, definition.state?.() ?? {}))

      for (const key of Object.keys(result)) {
        const value = result[key]
        if (typeof value === 'function') {
          actionDefinitions[key] = value
          raw[key] = wrapAction(store, key, value, base.actionSubscriptions, pinia)
        }
        else {
          if (isSetup && ((isRef(value) && !isComputedRef(value)) || isReactive(value))) {
            if (hadState) {
              if (isRef(value)) {
                value.value = initial[key]
              }
              else {
                mergeState(storeView(value), initial[key])
              }
            }
            initial[key] = value
          }
          raw[key] = value
        }
      }
      for (const plugin of pinia._p) {
        Object.assign(store, plugin({ store, pinia, app: pinia._a, options }) ?? {})
      }
    })
    base.activateSubscriptions()
    return store
  }
  catch (error) {
    try {
      scope.stop()
    }
    catch {
      // 初始化异常优先；scope.stop 已逐项执行其余清理。
    }
    if (pinia._s.get(id) === store) {
      pinia._s.delete(id)
    }
    if (!hadState) {
      delete pinia.state.value[id]
    }
    throw error
  }
}
