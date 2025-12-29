import { queueJob } from '../scheduler'

export type EffectScheduler = () => void

export type Dep = Set<ReactiveEffect>

export interface ReactiveEffect<T = any> {
  (): T
  deps: Dep[]
  scheduler?: EffectScheduler
  active: boolean
  _running: boolean
  _fn: () => T
  onStop?: () => void
}

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>()

let activeEffect: ReactiveEffect | null = null
const effectStack: ReactiveEffect[] = []

let batchDepth = 0
const batchedEffects = new Set<ReactiveEffect>()

export function startBatch() {
  batchDepth++
}

export function endBatch() {
  if (batchDepth === 0) {
    return
  }
  batchDepth--
  if (batchDepth === 0) {
    flushBatchedEffects()
  }
}

export function batch<T>(fn: () => T): T {
  startBatch()
  try {
    return fn()
  }
  finally {
    endBatch()
  }
}

function flushBatchedEffects() {
  while (batchedEffects.size) {
    const effects = Array.from(batchedEffects)
    batchedEffects.clear()
    for (const ef of effects) {
      ef()
    }
  }
}

export interface EffectScope {
  active: boolean
  effects: ReactiveEffect[]
  cleanups: (() => void)[]
  run: <T>(fn: () => T) => T | undefined
  stop: () => void
}

let activeEffectScope: EffectScopeImpl | undefined

class EffectScopeImpl implements EffectScope {
  active = true
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []
  private parent: EffectScopeImpl | undefined
  private scopes: EffectScopeImpl[] | undefined

  constructor(private detached = false) {
    if (!detached && activeEffectScope) {
      this.parent = activeEffectScope
      ;(activeEffectScope.scopes ||= []).push(this)
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (!this.active) {
      return
    }
    const prev = activeEffectScope
    // eslint-disable-next-line ts/no-this-alias
    activeEffectScope = this
    try {
      return fn()
    }
    finally {
      activeEffectScope = prev
    }
  }

  stop(): void {
    if (!this.active) {
      return
    }
    this.active = false

    for (const effect of this.effects) {
      stop(effect)
    }
    this.effects.length = 0

    for (const cleanup of this.cleanups) {
      cleanup()
    }
    this.cleanups.length = 0

    if (this.scopes) {
      for (const scope of this.scopes) {
        scope.stop()
      }
      this.scopes.length = 0
    }

    if (this.parent?.scopes) {
      const index = this.parent.scopes.indexOf(this)
      if (index >= 0) {
        this.parent.scopes.splice(index, 1)
      }
    }
    this.parent = undefined
  }
}

export function effectScope(detached = false): EffectScope {
  return new EffectScopeImpl(detached)
}

export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void): void {
  if (activeEffectScope?.active) {
    activeEffectScope.cleanups.push(fn)
  }
}

function recordEffectScope(effect: ReactiveEffect) {
  if (activeEffectScope?.active) {
    activeEffectScope.effects.push(effect)
  }
}

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
    if (effect._running) {
      return fn()
    }
    cleanupEffect(effect)
    try {
      effect._running = true
      effectStack.push(effect)
      activeEffect = effect
      return fn()
    }
    finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1] ?? null
      effect._running = false
    }
  } as ReactiveEffect<T>

  effect.deps = []
  effect.scheduler = options.scheduler
  effect.onStop = options.onStop
  effect.active = true
  effect._running = false
  effect._fn = fn

  return effect
}

export function effect<T = any>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  const _effect = createReactiveEffect(fn, options)
  recordEffectScope(_effect)
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
  effectsToRun.forEach(scheduleEffect)
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
  dep.forEach(scheduleEffect)
}

function scheduleEffect(ef: ReactiveEffect) {
  if (ef.scheduler) {
    ef.scheduler()
    return
  }
  if (batchDepth > 0) {
    batchedEffects.add(ef)
    return
  }
  ef()
}

// 导出队列调度工具，供 watch/watchEffect 等高层 API 复用同一批处理逻辑
export { queueJob }
