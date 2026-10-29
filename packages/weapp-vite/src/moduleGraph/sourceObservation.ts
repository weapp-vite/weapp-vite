import type { DevModuleGraphChange, DevModuleGraphObserver } from './devProvider'

export interface DevModuleGraphSourceObservation {
  bind: (observe: DevModuleGraphObserver | undefined) => void
  observe: DevModuleGraphObserver
}

const observations = new WeakMap<object, DevModuleGraphSourceObservation>()

/** 只撤下本代入口；旧插件仍持有自己的纯来源观测视图。 */
export function retireDevModuleGraphSourceObservation(context: object, observation: DevModuleGraphSourceObservation): void {
  if (observations.get(context) === observation) {
    observations.delete(context)
  }
}

/** 观测随既有插件闭包存活，图订阅的关闭不能丢弃重启期间已派发的保存。 */
export function getDevModuleGraphSourceObservation(context: object): DevModuleGraphSourceObservation {
  const existing = observations.get(context)
  if (existing) {
    return existing
  }
  let observe: DevModuleGraphObserver | undefined
  const observation: DevModuleGraphSourceObservation = {
    bind(next) { observe = next },
    observe: (change: DevModuleGraphChange) => observe?.(change) ?? change,
  }
  observations.set(context, observation)
  return observation
}
