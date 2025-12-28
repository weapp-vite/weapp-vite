import { queueJob } from '../scheduler'

export type EffectScheduler = () => void

export type Dep = Set<ReactiveEffect>

export interface ReactiveEffect<T = any> {
  (): T
  deps: Dep[]
  scheduler?: EffectScheduler
  active: boolean
  _fn: () => T
  onStop?: () => void
}

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>()

let activeEffect: ReactiveEffect | null = null
const effectStack: ReactiveEffect[] = []

export interface EffectOptions {
  scheduler?: EffectScheduler
  lazy?: boolean
  onStop?: () => void
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  deps.length = 0
}

export function createReactiveEffect<T>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  const effect = function reactiveEffect() {
    if (!effect.active) {
      return fn()
    }
    if (effectStack.includes(effect)) {
      return fn()
    }
    cleanupEffect(effect)
    try {
      effectStack.push(effect)
      activeEffect = effect
      return fn()
    }
    finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1] ?? null
    }
  } as ReactiveEffect<T>

  effect.deps = []
  effect.scheduler = options.scheduler
  effect.onStop = options.onStop
  effect.active = true
  effect._fn = fn

  return effect
}

export function effect<T = any>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  const _effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    _effect()
  }
  return _effect
}

export function stop(runner: ReactiveEffect) {
  if (!runner.active) {
    return
  }
  runner.active = false
  cleanupEffect(runner)
  runner.onStop?.()
}

export function track(target: object, key: PropertyKey) {
  if (!activeEffect) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

export function trigger(target: object, key: PropertyKey) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  const effects = depsMap.get(key)
  if (!effects) {
    return
  }
  const effectsToRun = new Set<ReactiveEffect>()
  effects.forEach((ef) => {
    if (ef !== activeEffect) {
      effectsToRun.add(ef)
    }
  })
  effectsToRun.forEach((ef) => {
    if (ef.scheduler) {
      ef.scheduler()
    }
    else {
      ef()
    }
  })
}

export function trackEffects(dep: Dep) {
  if (!activeEffect) {
    return
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

export function triggerEffects(dep: Dep) {
  dep.forEach((ef) => {
    if (ef.scheduler) {
      ef.scheduler()
    }
    else {
      ef()
    }
  })
}

// 导出队列调度工具，供 watch/watchEffect 等高层 API 复用同一批处理逻辑
export { queueJob }
