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
  _computed?: boolean
  onStop?: () => void
}

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>()

let activeEffect: ReactiveEffect | null = null
const effectStack: ReactiveEffect[] = []

let batchDepth = 0
let isFlushingBatch = false
const batchedComputedEffects = new Set<ReactiveEffect>()
const batchedEffects = new Set<ReactiveEffect>()

function runScheduledEffect(ef: ReactiveEffect) {
  if (ef.scheduler) {
    ef.scheduler()
    return
  }
  ef()
}

export function startBatch() {
  batchDepth++
}

function takeBatchedEffect(effects: Set<ReactiveEffect>): ReactiveEffect | undefined {
  const next = effects.values().next()
  if (next.done) {
    return undefined
  }
  effects.delete(next.value)
  return next.value
}

function flushBatchedEffects() {
  let firstError: unknown
  let hasError = false
  isFlushingBatch = true
  try {
    while (batchedComputedEffects.size || batchedEffects.size) {
      const effect = takeBatchedEffect(batchedComputedEffects)
        ?? takeBatchedEffect(batchedEffects)
      if (!effect) {
        continue
      }
      try {
        runScheduledEffect(effect)
      }
      catch (error) {
        if (!hasError) {
          firstError = error
          hasError = true
        }
      }
    }
  }
  finally {
    isFlushingBatch = false
  }
  if (hasError) {
    throw firstError
  }
}

export function endBatch() {
  if (batchDepth === 0) {
    return
  }
  batchDepth--
  if (batchDepth === 0 && !isFlushingBatch) {
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

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  for (let i = 0; i < deps.length; i++) {
    deps[i].delete(effect)
  }
  deps.length = 0
}

export function stop(runner: ReactiveEffect) {
  if (!runner.active) {
    return
  }
  runner.active = false
  cleanupEffect(runner)
  runner.onStop?.()
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
    // eslint-disable-next-line ts/no-this-alias -- 允许 this 临时别名
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

    let firstError: unknown
    let hasError = false
    const recordError = (error: unknown) => {
      if (hasError) {
        return
      }
      firstError = error
      hasError = true
    }

    const effects = this.effects.splice(0)
    for (const effect of effects) {
      try {
        stop(effect)
      }
      catch (error) {
        recordError(error)
      }
    }

    const cleanups = this.cleanups.splice(0)
    for (const cleanup of cleanups) {
      try {
        cleanup()
      }
      catch (error) {
        recordError(error)
      }
    }

    const scopes = this.scopes
    this.scopes = undefined
    if (scopes) {
      for (const scope of scopes) {
        try {
          scope.stop()
        }
        catch (error) {
          recordError(error)
        }
      }
      scopes.length = 0
    }

    if (this.parent?.scopes) {
      const index = this.parent.scopes.indexOf(this)
      if (index >= 0) {
        this.parent.scopes.splice(index, 1)
      }
    }
    this.parent = undefined

    if (hasError) {
      throw firstError
    }
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

function createEffect<T>(
  fn: () => T,
  options: EffectOptions,
  computed: boolean,
): ReactiveEffect<T> {
  const runner = createReactiveEffect(fn, options)
  runner._computed = computed
  recordEffectScope(runner)
  if (!options.lazy) {
    runner()
  }
  return runner
}

export function effect<T = any>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
  return createEffect(fn, options, false)
}

export function createComputedEffect<T>(
  fn: () => T,
  options: EffectOptions = {},
): ReactiveEffect<T> {
  return createEffect(fn, options, true)
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

function scheduleEffect(ef: ReactiveEffect) {
  if (batchDepth > 0 || isFlushingBatch) {
    const queue = ef._computed ? batchedComputedEffects : batchedEffects
    queue.add(ef)
    return
  }
  runScheduledEffect(ef)
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
  // 迭代时复制依赖集合，避免遍历过程中被重新加入导致死循环。
  const effectsToRun = new Set(dep)
  effectsToRun.forEach(scheduleEffect)
}

// 导出队列调度工具，供 watch/watchEffect 等高层 API 复用同一批处理逻辑
export { queueJob }
