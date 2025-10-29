import type {
  ComputedGetter,
  ComputedRef,
  WatchOptions,
  WatchStopHandle,
  WritableComputedOptions,
} from './reactivity'
import { computed, effect, isReactive, reactive, stop, toRaw, traverse, unref, watch } from './reactivity'
import { queueJob } from './scheduler'
import { capitalize, toPathSegments } from './utils'

export type ComputedDefinitions = Record<string, ComputedGetter<any> | WritableComputedOptions<any>>
export type MethodDefinitions = Record<string, (...args: any[]) => any>

type ExtractComputed<C extends ComputedDefinitions> = {
  [K in keyof C]: C[K] extends ComputedGetter<infer R> ? R
    : C[K] extends WritableComputedOptions<infer R> ? R : never
}

type ExtractMethods<M extends MethodDefinitions> = {
  [K in keyof M]: M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never
}

export type ComponentPublicInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>
  = D & ExtractComputed<C> & ExtractMethods<M>

export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

export interface ModelBindingOptions<T = any> {
  event?: string
  valueProp?: string
  parser?: (payload: any) => T
  formatter?: (value: T) => any
}

export interface ModelBinding<T = any> {
  value: T
  update: (value: T) => void
  model: (options?: ModelBindingOptions<T>) => Record<string, any>
}

export interface CreateAppOptions<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  data?: () => D
  computed?: C
  methods?: M
}

export interface RuntimeApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  mount: (adapter?: MiniProgramAdapter) => RuntimeInstance<D, C, M>
}

export interface RuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  readonly state: D
  readonly proxy: ComponentPublicInstance<D, C, M>
  readonly methods: ExtractMethods<M>
  readonly computed: Readonly<ExtractComputed<C>>
  readonly adapter?: MiniProgramAdapter
  bindModel: <T = any>(path: string, options?: ModelBindingOptions<T>) => ModelBinding<T>
  watch: <T>(
    source: (() => T) | Record<string, any>,
    cb: (value: T, oldValue: T) => void,
    options?: WatchOptions,
  ) => WatchStopHandle
  snapshot: () => Record<string, any>
  unmount: () => void
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function toPlain(value: any, seen = new WeakMap<object, any>()): any {
  const unwrapped = unref(value)
  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return unwrapped
  }
  const raw = isReactive(unwrapped) ? toRaw(unwrapped) : unwrapped
  if (seen.has(raw)) {
    return seen.get(raw)
  }
  if (Array.isArray(raw)) {
    const arr: any[] = []
    seen.set(raw, arr)
    raw.forEach((item, index) => {
      arr[index] = toPlain(item, seen)
    })
    return arr
  }
  const output: Record<string, any> = {}
  seen.set(raw, output)
  Object.keys(raw).forEach((key) => {
    output[key] = toPlain((raw as any)[key], seen)
  })
  return output
}

function getFromPath(target: any, segments: string[]) {
  return segments.reduce((acc, segment) => {
    if (acc == null) {
      return acc
    }
    return acc[segment]
  }, target)
}

function setWithSegments(
  target: Record<string, any>,
  segments: string[],
  value: any,
) {
  let current = target
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[segments[segments.length - 1]] = value
}

function setComputedValue(
  setters: Record<string, (value: any) => void>,
  key: string,
  value: any,
) {
  const setter = setters[key]
  if (!setter) {
    throw new Error(`Computed property "${key}" is readonly`)
  }
  setter(value)
}

function setByPath(
  state: Record<string, any>,
  computedRefs: Record<string, ComputedRef<any>>,
  computedSetters: Record<string, (value: any) => void>,
  segments: string[],
  value: any,
) {
  if (!segments.length) {
    return
  }
  const [head, ...rest] = segments
  if (!rest.length) {
    if (computedRefs[head]) {
      setComputedValue(computedSetters, head, value)
    }
    else {
      state[head] = value
    }
    return
  }
  if (computedRefs[head]) {
    setComputedValue(computedSetters, head, value)
    return
  }
  if (state[head] == null || typeof state[head] !== 'object') {
    state[head] = {}
  }
  setWithSegments(state[head], rest, value)
}

function defaultParser(event: any) {
  if (event == null) {
    return event
  }
  if (typeof event === 'object') {
    if ('detail' in event && event.detail && 'value' in event.detail) {
      return event.detail.value
    }
    if ('target' in event && event.target && 'value' in event.target) {
      return event.target.value
    }
  }
  return event
}

export function createApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: CreateAppOptions<D, C, M>,
): RuntimeApp<D, C, M> {
  return {
    mount(adapter?: MiniProgramAdapter): RuntimeInstance<D, C, M> {
      const dataFn = options.data ?? (() => ({}) as D)
      const rawState = dataFn()
      if (!isReactive(rawState) && !isPlainObject(rawState)) {
        throw new Error('data() must return a plain object')
      }
      const state = reactive(rawState)
      const computedDefs = options.computed ?? ({} as C)
      const methodDefs = options.methods ?? ({} as M)

      const computedRefs: Record<string, ComputedRef<any>> = Object.create(null)
      const computedSetters: Record<string, (value: any) => void> = Object.create(null)
      const boundMethods = {} as ExtractMethods<M>
      let mounted = true
      let latestSnapshot: Record<string, any> = {}
      const stopHandles: WatchStopHandle[] = []

      const computedProxy = new Proxy(
        {},
        {
          get(_target, key: string | symbol) {
            if (typeof key === 'string' && computedRefs[key]) {
              return computedRefs[key].value
            }
            return undefined
          },
          has(_target, key: string | symbol) {
            return typeof key === 'string' && Boolean(computedRefs[key])
          },
          ownKeys() {
            return Object.keys(computedRefs)
          },
          getOwnPropertyDescriptor(_target, key: string | symbol) {
            if (typeof key === 'string' && computedRefs[key]) {
              return {
                configurable: true,
                enumerable: true,
                value: computedRefs[key].value,
              }
            }
            return undefined
          },
        },
      )

      const publicInstance = new Proxy(state as ComponentPublicInstance<D, C, M>, {
        get(target, key, receiver) {
          if (typeof key === 'string') {
            if (key === '$state') {
              return state
            }
            if (key === '$computed') {
              return computedProxy
            }
            if (Object.prototype.hasOwnProperty.call(boundMethods, key)) {
              return boundMethods[key as keyof ExtractMethods<M>]
            }
            if (computedRefs[key]) {
              return computedRefs[key].value
            }
          }
          return Reflect.get(target, key, receiver)
        },
        set(target, key, value, receiver) {
          if (typeof key === 'string' && computedRefs[key]) {
            setComputedValue(computedSetters, key, value)
            return true
          }
          return Reflect.set(target, key, value, receiver)
        },
        has(target, key) {
          if (typeof key === 'string' && (computedRefs[key] || Object.prototype.hasOwnProperty.call(boundMethods, key))) {
            return true
          }
          return Reflect.has(target, key)
        },
        ownKeys(target) {
          const keys = new Set<string | symbol>()
          Reflect.ownKeys(target).forEach((key) => {
            keys.add(key as string | symbol)
          })
          Object.keys(boundMethods).forEach(key => keys.add(key))
          Object.keys(computedRefs).forEach(key => keys.add(key))
          return Array.from(keys)
        },
        getOwnPropertyDescriptor(target, key) {
          if (Reflect.has(target, key)) {
            return Object.getOwnPropertyDescriptor(target, key)
          }
          if (typeof key === 'string') {
            if (computedRefs[key]) {
              return {
                configurable: true,
                enumerable: true,
                get() {
                  return computedRefs[key].value
                },
                set(value: any) {
                  setComputedValue(computedSetters, key, value)
                },
              }
            }
            if (Object.prototype.hasOwnProperty.call(boundMethods, key)) {
              return {
                configurable: true,
                enumerable: false,
                value: boundMethods[key as keyof ExtractMethods<M>],
              }
            }
          }
          return undefined
        },
      })

      Object.keys(methodDefs).forEach((key) => {
        const handler = methodDefs[key]
        if (typeof handler === 'function') {
          boundMethods[key as keyof ExtractMethods<M>] = ((...args: any[]) => handler.apply(publicInstance, args)) as ExtractMethods<M>[keyof ExtractMethods<M>]
        }
      })

      Object.keys(computedDefs).forEach((key) => {
        const definition = computedDefs[key]
        if (typeof definition === 'function') {
          computedRefs[key] = computed(() => definition.call(publicInstance))
        }
        else {
          const getter = definition.get?.bind(publicInstance)
          if (!getter) {
            throw new Error(`Computed property "${key}" requires a getter`)
          }
          const setter = definition.set?.bind(publicInstance)
          if (setter) {
            computedSetters[key] = setter
            computedRefs[key] = computed({
              get: getter,
              set: setter,
            })
          }
          else {
            computedRefs[key] = computed(getter)
          }
        }
      })

      const currentAdapter = adapter ?? { setData: () => {} }

      const collectSnapshot = (): Record<string, any> => {
        const plain = toPlain(state)
        Object.keys(computedRefs).forEach((key) => {
          plain[key] = toPlain(computedRefs[key].value)
        })
        return plain
      }

      const job = () => {
        if (!mounted) {
          return
        }
        const snapshot = collectSnapshot()
        latestSnapshot = snapshot
        if (typeof currentAdapter.setData === 'function') {
          currentAdapter.setData(snapshot)
        }
      }

      const tracker = effect(
        () => {
          traverse(state)
          Object.keys(computedRefs).forEach(key => computedRefs[key].value)
        },
        {
          scheduler: () => queueJob(job),
        },
      )

      job()

      stopHandles.push(() => stop(tracker))

      function registerWatch<T>(
        source: (() => T) | Record<string, any>,
        cb: (value: T, oldValue: T) => void,
        watchOptions?: WatchOptions,
      ): WatchStopHandle {
        const stopHandle = watch(source as any, (value: T, oldValue: T) => cb(value, oldValue), watchOptions)
        stopHandles.push(stopHandle)
        return () => {
          stopHandle()
          const index = stopHandles.indexOf(stopHandle)
          if (index >= 0) {
            stopHandles.splice(index, 1)
          }
        }
      }

      const bindModel = <T = any>(path: string, bindingOptions?: ModelBindingOptions<T>): ModelBinding<T> => {
        const segments = toPathSegments(path)
        if (!segments.length) {
          throw new Error('bindModel requires a non-empty path')
        }
        const resolveValue = () => getFromPath(publicInstance, segments)
        const assignValue = (value: T) => {
          setByPath(state as Record<string, any>, computedRefs, computedSetters, segments, value)
        }
        const defaultOptions: Required<ModelBindingOptions<T>> = {
          event: 'input',
          valueProp: 'value',
          parser: defaultParser,
          formatter: value => value,
          ...bindingOptions,
        }

        return {
          get value() {
            return resolveValue()
          },
          set value(nextValue: T) {
            assignValue(nextValue)
          },
          update(nextValue: T) {
            assignValue(nextValue)
          },
          model(modelOptions?: ModelBindingOptions<T>) {
            const merged = {
              ...defaultOptions,
              ...modelOptions,
            }
            const handlerKey = `on${capitalize(merged.event)}`
            const payload = {
              [merged.valueProp]: merged.formatter(resolveValue()),
            } as Record<string, any>
            payload[handlerKey] = (event: any) => {
              const parsed = merged.parser(event)
              assignValue(parsed)
            }
            return payload
          },
        }
      }

      const unmount = () => {
        if (!mounted) {
          return
        }
        mounted = false
        stopHandles.forEach((handle) => {
          try {
            handle()
          }
          catch {
            // ignore stop errors during teardown
          }
        })
        stopHandles.length = 0
      }

      return {
        get state() {
          return state
        },
        get proxy() {
          return publicInstance
        },
        get methods() {
          return boundMethods
        },
        get computed() {
          return computedProxy as Readonly<ExtractComputed<C>>
        },
        get adapter() {
          return currentAdapter
        },
        bindModel,
        watch: registerWatch,
        snapshot: () => ({ ...latestSnapshot }),
        unmount,
      }
    },
  }
}
