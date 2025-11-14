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

declare const Page: (options: Record<string, any>) => void
declare const Component: (options: Record<string, any>) => void
declare const App: (options: Record<string, any>) => void

export type ComputedDefinitions = Record<string, ComputedGetter<any> | WritableComputedOptions<any>>
export type MethodDefinitions = Record<string, (...args: any[]) => any>

type WatchHandler = (this: any, value: any, oldValue: any) => void

type WatchDescriptor = WatchHandler | string | {
  handler: WatchHandler | string
  immediate?: boolean
  deep?: boolean
}

type WatchMap = Record<string, WatchDescriptor>

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

export interface AppConfig {
  globalProperties: Record<string, any>
}

export type WevuPlugin = ((app: RuntimeApp<any, any, any>, ...options: any[]) => any) | {
  install: (app: RuntimeApp<any, any, any>, ...options: any[]) => any
}

export interface RuntimeApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  mount: (adapter?: MiniProgramAdapter) => RuntimeInstance<D, C, M>
  use: (plugin: WevuPlugin, ...options: any[]) => RuntimeApp<D, C, M>
  config: AppConfig
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

interface SetupContext<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
  runtime: RuntimeInstance<D, C, M>
  state: D
  proxy: ComponentPublicInstance<D, C, M>
  bindModel: RuntimeInstance<D, C, M>['bindModel']
  watch: RuntimeInstance<D, C, M>['watch']
  instance: InternalRuntimeState
}

interface InternalRuntimeState {
  __wevu?: RuntimeInstance<any, any, any>
  __wevuWatchStops?: WatchStopHandle[]
  $wevu?: RuntimeInstance<any, any, any>
}

// Current instance for use inside synchronous setup() only.
let __currentInstance: InternalRuntimeState | undefined
export function getCurrentInstance(): any {
  return __currentInstance
}

export interface DefineComponentOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends CreateAppOptions<D, C, M> {
  type?: 'page' | 'component'
  watch?: WatchMap
  setup?: (ctx: SetupContext<D, C, M>) => void
  [key: string]: any
}

export interface DefineAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> {
  watch?: WatchMap
  setup?: (ctx: SetupContext<D, C, M>) => void
  [key: string]: any
}

export interface CreateAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends DefineAppOptions<D, C, M> {
  data?: () => D
  computed?: C
  methods?: M
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

function isDeepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    // eslint-disable-next-line ts/no-use-before-define
    return isArrayEqual(a, b)
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    // eslint-disable-next-line ts/no-use-before-define
    return isPlainObjectEqual(a, b)
  }
  return false
}

function isArrayEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (!isDeepEqual(a[i], b[i])) {
      return false
    }
  }
  return true
}

function isPlainObjectEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false
    }
    if (!isDeepEqual(a[key], b[key])) {
      return false
    }
  }
  return true
}

function normalizeSetDataValue<T>(value: T): T | null {
  return value === undefined ? null : value
}

function assignNestedDiff(
  prev: any,
  next: any,
  path: string,
  output: Record<string, any>,
) {
  if (isDeepEqual(prev, next)) {
    return
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        output[`${path}.${key}`] = null
        return
      }
      assignNestedDiff(prev[key], next[key], `${path}.${key}`, output)
    })
    return
  }

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (!isArrayEqual(prev, next)) {
      output[path] = normalizeSetDataValue(next)
    }
    return
  }

  output[path] = normalizeSetDataValue(next)
}

function diffSnapshots(
  prev: Record<string, any>,
  next: Record<string, any>,
): Record<string, any> {
  const diff: Record<string, any> = {}
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  keys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      diff[key] = null
      return
    }
    assignNestedDiff(prev[key], next[key], key, diff)
  })
  return diff
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
  const {
    data,
    computed: computedOptions,
    methods,
    watch: appWatch,
    setup: appSetup,
    ...mpOptions
  } = options
  const resolvedMethods = methods ?? ({} as M)
  const resolvedComputed = computedOptions ?? ({} as C)

  const installedPlugins = new Set<WevuPlugin>()
  const appConfig: AppConfig = { globalProperties: {} }

  const runtimeApp: RuntimeApp<D, C, M> = {
    mount(adapter?: MiniProgramAdapter): RuntimeInstance<D, C, M> {
      const dataFn = data ?? (() => ({}) as D)
      const rawState = dataFn()
      if (!isReactive(rawState) && !isPlainObject(rawState)) {
        throw new Error('data() must return a plain object')
      }
      const state = reactive(rawState)
      const computedDefs = resolvedComputed
      const methodDefs = resolvedMethods

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
            if (Object.prototype.hasOwnProperty.call(appConfig.globalProperties, key)) {
              return (appConfig.globalProperties as any)[key]
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
        const diff = diffSnapshots(latestSnapshot, snapshot)
        latestSnapshot = snapshot
        if (!Object.keys(diff).length) {
          return
        }
        if (typeof currentAdapter.setData === 'function') {
          const result = currentAdapter.setData(diff)
          if (result && typeof (result as Promise<any>).then === 'function') {
            (result as Promise<any>).catch(() => {})
          }
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
    use(plugin: WevuPlugin, ...options: any[]) {
      if (!plugin || installedPlugins.has(plugin)) {
        return runtimeApp
      }
      installedPlugins.add(plugin)
      if (typeof plugin === 'function') {
        plugin(runtimeApp, ...options)
      }
      else if (typeof plugin.install === 'function') {
        plugin.install(runtimeApp, ...options)
      }
      else {
        throw new TypeError('A plugin must be a function or an object with an install method')
      }
      return runtimeApp
    },
    config: appConfig,
  }

  const shouldRegisterApp = typeof App === 'function'
    && (appWatch !== undefined || appSetup !== undefined || Object.keys(mpOptions).length > 0)
  if (shouldRegisterApp) {
    // eslint-disable-next-line ts/no-use-before-define
    registerApp<D, C, M>(runtimeApp, resolvedMethods as MethodDefinitions, appWatch, appSetup, mpOptions)
  }

  return runtimeApp
}

function normalizeWatchDescriptor(
  descriptor: WatchDescriptor,
  runtime: RuntimeInstance<any, any, any>,
  instance: InternalRuntimeState,
): { handler: WatchHandler, options: WatchOptions } | undefined {
  if (typeof descriptor === 'function') {
    return {
      handler: descriptor.bind(runtime.proxy),
      options: {},
    }
  }

  if (typeof descriptor === 'string') {
    const method = runtime.methods?.[descriptor] ?? (instance as any)[descriptor]
    if (typeof method === 'function') {
      return {
        handler: method.bind(runtime.proxy),
        options: {},
      }
    }
    return undefined
  }

  if (!descriptor || typeof descriptor !== 'object') {
    return undefined
  }

  const base = normalizeWatchDescriptor(descriptor.handler, runtime, instance)
  if (!base) {
    return undefined
  }

  const options: WatchOptions = {
    ...base.options,
  }

  if (descriptor.immediate !== undefined) {
    options.immediate = descriptor.immediate
  }
  if (descriptor.deep !== undefined) {
    options.deep = descriptor.deep
  }

  return {
    handler: base.handler,
    options,
  }
}

function createPathGetter(target: ComponentPublicInstance<any, any, any>, path: string) {
  const segments = path.split('.').map(segment => segment.trim()).filter(Boolean)
  if (!segments.length) {
    return () => target
  }

  return () => {
    let current: any = target
    for (const segment of segments) {
      if (current == null) {
        return current
      }
      current = current[segment]
    }
    return current
  }
}

function registerWatches(
  runtime: RuntimeInstance<any, any, any>,
  watchMap: WatchMap,
  instance: InternalRuntimeState,
) {
  const stops: WatchStopHandle[] = []
  const proxy = runtime.proxy

  for (const [expression, descriptor] of Object.entries(watchMap)) {
    const normalized = normalizeWatchDescriptor(descriptor, runtime, instance)
    if (!normalized) {
      continue
    }
    const getter = createPathGetter(proxy, expression)
    const stop = runtime.watch(getter, normalized.handler, normalized.options)
    stops.push(stop)
  }

  return stops
}

function mountRuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<D, C, M>,
  watchMap: WatchMap | undefined,
  setup?: DefineComponentOptions<D, C, M>['setup'],
) {
  const runtime = runtimeApp.mount({
    setData(payload: Record<string, any>) {
      if (typeof (target as any).setData === 'function') {
        (target as any).setData(payload)
      }
    },
  })

  Object.defineProperty(target, '$wevu', {
    value: runtime,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  target.__wevu = runtime

  if (watchMap) {
    const stops = registerWatches(runtime, watchMap, target)
    if (stops.length) {
      target.__wevuWatchStops = stops
    }
  }

  if (setup) {
    const context: SetupContext<any, any, any> = {
      runtime,
      state: runtime.state,
      proxy: runtime.proxy,
      bindModel: runtime.bindModel.bind(runtime),
      watch: runtime.watch.bind(runtime),
      instance: target,
    }
    // Expose current instance only during synchronous setup execution.
    __currentInstance = target
    try {
      setup(context)
    }
    finally {
      __currentInstance = undefined
    }
  }

  return runtime
}

function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  const stops = target.__wevuWatchStops
  if (Array.isArray(stops)) {
    for (const stop of stops) {
      try {
        stop()
      }
      catch {
        // ignore teardown errors
      }
    }
  }
  target.__wevuWatchStops = undefined
  if (runtime) {
    runtime.unmount()
  }
  delete target.__wevu
  if ('$wevu' in target) {
    delete (target as any).$wevu
  }
}

function registerApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineAppOptions<D, C, M>['setup'],
  mpOptions: Record<string, any>,
) {
  if (typeof App !== 'function') {
    throw new TypeError('createApp requires the global App constructor to be available')
  }

  const methodNames = Object.keys(methods ?? {})
  const appOptions: Record<string, any> = {
    ...mpOptions,
  }

  appOptions.globalData = appOptions.globalData ?? {}

  const userOnLaunch = appOptions.onLaunch
  appOptions.onLaunch = function onLaunch(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    if (typeof userOnLaunch === 'function') {
      userOnLaunch.apply(this, args)
    }
  }

  for (const methodName of methodNames) {
    const userMethod = appOptions[methodName]
    appOptions[methodName] = function runtimeMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = this.__wevu
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        return userMethod.apply(this, args)
      }
      return result
    }
  }

  App(appOptions)
}

function registerPage<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<D, C, M>['setup'],
  mpOptions: Record<string, any>,
) {
  const methodNames = Object.keys(methods ?? {})
  const userOnLoad = mpOptions.onLoad
  const userOnUnload = mpOptions.onUnload
  const pageOptions: Record<string, any> = {
    ...mpOptions,
  }

  pageOptions.data ??= {}

  pageOptions.onLoad = function onLoad(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    if (typeof userOnLoad === 'function') {
      userOnLoad.apply(this, args)
    }
  }

  pageOptions.onUnload = function onUnload(this: InternalRuntimeState, ...args: any[]) {
    teardownRuntimeInstance(this)
    if (typeof userOnUnload === 'function') {
      return userOnUnload.apply(this, args)
    }
  }

  for (const methodName of methodNames) {
    const userMethod = mpOptions[methodName]
    pageOptions[methodName] = function runtimeMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = this.__wevu
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        return userMethod.apply(this, args)
      }
      return result
    }
  }

  Page(pageOptions)
}

function registerComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<D, C, M>['setup'],
  mpOptions: Record<string, any>,
) {
  const {
    methods: userMethods = {},
    lifetimes: userLifetimes = {},
    ...rest
  } = mpOptions

  const finalMethods: Record<string, (...args: any[]) => any> = {
    ...userMethods,
  }
  const methodNames = Object.keys(methods ?? {})

  for (const methodName of methodNames) {
    const userMethod = finalMethods[methodName]
    finalMethods[methodName] = function componentMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = this.__wevu
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        return userMethod.apply(this, args)
      }
      return result
    }
  }

  const lifetimes = {
    ...userLifetimes,
  }

  const userAttached = lifetimes.attached
  lifetimes.attached = function attached(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    if (typeof userAttached === 'function') {
      userAttached.apply(this, args)
    }
  }

  const userDetached = lifetimes.detached
  lifetimes.detached = function detached(this: InternalRuntimeState, ...args: any[]) {
    teardownRuntimeInstance(this)
    if (typeof userDetached === 'function') {
      return userDetached.apply(this, args)
    }
  }

  const componentOptions: Record<string, any> = {
    ...rest,
    methods: finalMethods,
    lifetimes,
  }

  componentOptions.data ??= {}

  Component(componentOptions)
}

export function defineComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<D, C, M>,
) {
  const {
    type = 'page',
    data,
    computed,
    methods,
    watch,
    setup,
    ...mpOptions
  } = options

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
  })

  if (type === 'component') {
    registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch, setup, mpOptions)
  }
  else {
    registerPage<D, C, M>(runtimeApp, methods ?? {}, watch, setup, mpOptions)
  }
}
