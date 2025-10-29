import { queueJob } from './scheduler'

export type EffectScheduler = () => void

type Dep = Set<ReactiveEffect>

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

function createReactiveEffect<T>(fn: () => T, options: EffectOptions = {}): ReactiveEffect<T> {
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

function track(target: object, key: PropertyKey) {
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

function trigger(target: object, key: PropertyKey) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  const effects = depsMap.get(key)
  if (!effects) {
    return
  }
  const effectsToRun = new Set<ReactiveEffect>()
  effects.forEach((effect) => {
    if (effect !== activeEffect) {
      effectsToRun.add(effect)
    }
  })
  effectsToRun.forEach((effect) => {
    if (effect.scheduler) {
      effect.scheduler()
    }
    else {
      effect()
    }
  })
}

const reactiveMap = new WeakMap<object, any>()
const rawMap = new WeakMap<any, object>()

enum ReactiveFlags {
  IS_REACTIVE = '__r_isReactive',
  RAW = '__r_raw',
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

const mutableHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    if (key === ReactiveFlags.RAW) {
      return target
    }
    const res = Reflect.get(target, key, receiver)
    track(target, key)
    if (isObject(res)) {
      // eslint-disable-next-line ts/no-use-before-define
      return reactive(res)
    }
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      trigger(target, key)
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      trigger(target, key)
    }
    return result
  },
  ownKeys(target) {
    track(target, Symbol.iterator)
    return Reflect.ownKeys(target)
  },
}

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target
  }
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const proxy = new Proxy(target, mutableHandlers)
  reactiveMap.set(target, proxy)
  rawMap.set(proxy, target)
  return proxy
}

export function isReactive(value: unknown): boolean {
  return Boolean(value && (value as any)[ReactiveFlags.IS_REACTIVE])
}

export function toRaw<T>(observed: T): T {
  return ((observed as any)?.[ReactiveFlags.RAW] ?? observed) as T
}

function convertToReactive<T>(value: T): T {
  return isObject(value) ? reactive(value as any) : value
}

export interface Ref<T = any> {
  value: T
}

export function isRef(value: unknown): value is Ref<any> {
  return Boolean(value && typeof value === 'object' && 'value' in (value as any))
}

function trackEffects(dep: Dep) {
  if (!activeEffect) {
    return
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

function triggerEffects(dep: Dep) {
  dep.forEach((effect) => {
    if (effect.scheduler) {
      effect.scheduler()
    }
    else {
      effect()
    }
  })
}

function trackRefValue(refImpl: RefImpl<any>) {
  if (activeEffect) {
    refImpl.dep = refImpl.dep || new Set()
    trackEffects(refImpl.dep)
  }
}

class RefImpl<T> {
  private _value: T
  private _rawValue: T
  public dep: Dep | undefined
  constructor(value: T) {
    this._rawValue = value
    this._value = convertToReactive(value)
  }

  get value(): T {
    trackRefValue(this)
    return this._value
  }

  set value(newValue: T) {
    if (!Object.is(newValue, this._rawValue)) {
      this._rawValue = newValue
      this._value = convertToReactive(newValue)
      this.dep && triggerEffects(this.dep)
    }
  }
}

export function ref<T>(value: T): Ref<T> {
  if (isRef(value)) {
    return value
  }
  return new RefImpl(value)
}

export function unref<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value
}

export type ComputedGetter<T> = () => T
export type ComputedSetter<T> = (value: T) => void

export interface ComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T> {
  value: T
}

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRef<T> | WritableComputedRef<T> {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  const onlyGetter = typeof getterOrOptions === 'function'
  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {
      throw new Error('Computed value is readonly')
    }
  }
  else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  let value: T
  let dirty = true
  let runner: ReactiveEffect<T>
  const obj: any = {
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      track(obj, 'value')
      return value
    },
    set value(newValue: T) {
      setter(newValue)
    },
  }
  runner = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    },
  })
  return (onlyGetter ? obj as ComputedRef<T> : obj as WritableComputedRef<T>)
}

export interface WatchOptions {
  immediate?: boolean
  deep?: boolean
}

type WatchSource<T = any> = (() => T) | Ref<T> | object

export type WatchStopHandle = () => void

function traverse(value: any, seen = new Set<object>()): any {
  if (!isObject(value) || seen.has(value)) {
    return value
  }
  seen.add(value)
  for (const key in value as any) {
    traverse((value as any)[key], seen)
  }
  return value
}

export function watch<T>(
  source: WatchSource<T>,
  cb: (value: T, oldValue: T, onCleanup: (cleanupFn: () => void) => void) => void,
  options: WatchOptions = {},
): WatchStopHandle {
  let getter: () => T
  if (typeof source === 'function') {
    getter = source as () => T
  }
  else if (isRef(source)) {
    getter = () => source.value
  }
  else if (isReactive(source)) {
    getter = () => source as unknown as T
  }
  else {
    throw new Error('Invalid watch source')
  }

  if (options.deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: (() => void) | undefined
  const onCleanup = (fn: () => void) => {
    cleanup = fn
  }

  let oldValue: T
  let runner: ReactiveEffect<T>

  const job = () => {
    if (!runner.active) {
      return
    }
    const newValue = runner()
    cleanup?.()
    cb(newValue, oldValue, onCleanup)
    oldValue = newValue
  }

  runner = effect(() => getter(), {
    scheduler: () => queueJob(job),
    lazy: true,
  })

  if (options.immediate) {
    job()
  }
  else {
    oldValue = runner()
  }

  return () => {
    cleanup?.()
    stop(runner)
  }
}

export { traverse }
