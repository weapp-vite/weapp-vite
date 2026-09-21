import type { Pinia, PiniaPlugin } from './types'
import { effectScope, markRaw, ref } from '../reactivity'
import { hasInjectionContext, inject } from '../runtime/provide'
import { storeView } from './view'

const piniaKey = Symbol('wevu.pinia')
let activePinia: Pinia | undefined

/** 设置组件外使用的活动 Store 管理器。 */
export function setActivePinia(pinia: Pinia): Pinia
export function setActivePinia(pinia: undefined): undefined
export function setActivePinia(pinia: Pinia | undefined): Pinia | undefined
export function setActivePinia(pinia: Pinia | undefined) {
  activePinia = pinia
  return pinia
}

/** 优先读取当前应用的注入上下文，再读取活动管理器。 */
export function getActivePinia(): Pinia | undefined {
  return (hasInjectionContext() && inject<Pinia | undefined>(piniaKey, undefined)) || activePinia
}

/** 创建独立的状态树与作用域；安装或显式激活后再使用 Store。 */
export function createPinia(): Pinia {
  const scope = effectScope(true)
  const plugins: PiniaPlugin[] = []
  const pending: PiniaPlugin[] = []
  const instances = new Map<string, any>()
  const pinia: Pinia = markRaw({
    state: scope.run(() => ref<Record<string, any>>(storeView({})))!,
    _e: scope,
    _s: instances,
    _p: plugins,
    _a: null,
    _stores: instances,
    _plugins: plugins,
    install(app: any) {
      setActivePinia(pinia)
      pinia._a = app
      app.provide(piniaKey, pinia)
      app.config.globalProperties.$pinia = pinia
      plugins.push(...pending.splice(0))
    },
    use(plugin: PiniaPlugin) {
      (pinia._a ? plugins : pending).push(plugin)
      return pinia
    },
  })
  return pinia
}

/** @deprecated 使用 createPinia，并通过 app.use 或 setActivePinia 激活。 */
export const createStore = createPinia

/** 释放整个管理器；与单个 Store 的 $dispose 不同，此操作也清除状态。 */
export function disposePinia(pinia: Pinia) {
  try {
    pinia._e.stop()
  }
  finally {
    pinia._s.clear()
    pinia._p.splice(0)
    pinia.state.value = {}
    pinia._a = null
  }
}
