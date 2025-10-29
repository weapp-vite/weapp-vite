import type {
  ComponentPublicInstance,
  ComputedDefinitions,
  MethodDefinitions,
  RuntimeInstance,
  WatchOptions,
  WatchStopHandle,
} from 'wevu'
import { createApp } from 'wevu'

declare const Page: (options: Record<string, any>) => void
declare const Component: (options: Record<string, any>) => void

type WatchHandler = (this: any, value: any, oldValue: any) => void

type WatchDescriptor = WatchHandler | string | {
  handler: WatchHandler | string
  immediate?: boolean
  deep?: boolean
}

type WatchMap = Record<string, WatchDescriptor>

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
}

export interface WevuComponentOptions<D extends object = Record<string, any>, C extends ComputedDefinitions = ComputedDefinitions, M extends MethodDefinitions = MethodDefinitions> {
  type?: 'page' | 'component'
  data?: () => D
  computed?: C
  methods?: M
  watch?: WatchMap
  setup?: (ctx: SetupContext<D, C, M>) => void
  [key: string]: any
}

interface InternalRuntimeState {
  __wevu?: RuntimeInstance<any, any, any>
  __wevuWatchStops?: WatchStopHandle[]
  $wevu?: RuntimeInstance<any, any, any>
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

function mountRuntimeInstance(
  target: InternalRuntimeState,
  runtimeApp: ReturnType<typeof createApp>,
  watchMap: WatchMap | undefined,
  setup?: WevuComponentOptions['setup'],
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
    }
    setup.call(target, context)
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

function registerPage(
  runtimeApp: ReturnType<typeof createApp>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: WevuComponentOptions['setup'],
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

function registerComponent(
  runtimeApp: ReturnType<typeof createApp>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: WevuComponentOptions['setup'],
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

export function createWevuComponent(options: WevuComponentOptions) {
  const {
    type = 'page',
    data,
    computed,
    methods,
    watch,
    setup,
    ...mpOptions
  } = options

  const runtimeApp = createApp({
    data: data ?? (() => ({})),
    computed: computed ?? ({} as any),
    methods: methods ?? ({} as any),
  })

  if (type === 'component') {
    registerComponent(runtimeApp, methods ?? {}, watch, setup, mpOptions)
  }
  else {
    registerPage(runtimeApp, methods ?? {}, watch, setup, mpOptions)
  }
}
