import type {
  ComponentPropsOptions,
  ComponentPublicInstance,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  PageFeatures,
  RuntimeApp,
  RuntimeInstance,
} from './types'
import { callHookList, callHookReturn, setCurrentInstance } from './hooks'

declare const Page: (options: Record<string, any>) => void
declare const Component: (options: Record<string, any>) => void
declare const App: (options: Record<string, any>) => void

type WatchHandler = (this: any, value: any, oldValue: any) => void
type WatchDescriptor = WatchHandler | string | {
  handler: WatchHandler | string
  immediate?: boolean
  deep?: boolean
}
type WatchMap = Record<string, WatchDescriptor>

export function runSetupFunction(
  setup: ((...args: any[]) => any) | undefined,
  props: Record<string, any>,
  context: any,
) {
  if (typeof setup !== 'function') {
    return undefined
  }
  return setup(props, context)
}

function normalizeWatchDescriptor(
  descriptor: WatchDescriptor,
  runtime: RuntimeInstance<any, any, any>,
  instance: InternalRuntimeState,
): { handler: WatchHandler, options: any } | undefined {
  if (typeof descriptor === 'function') {
    return {
      handler: descriptor.bind(runtime.proxy),
      options: {},
    }
  }

  if (typeof descriptor === 'string') {
    const method = (runtime.methods as any)?.[descriptor] ?? (instance as any)[descriptor]
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

  const base = normalizeWatchDescriptor((descriptor as any).handler, runtime, instance)
  if (!base) {
    return undefined
  }

  const options: any = {
    ...base.options,
  }

  if ((descriptor as any).immediate !== undefined) {
    options.immediate = (descriptor as any).immediate
  }
  if ((descriptor as any).deep !== undefined) {
    options.deep = (descriptor as any).deep
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
  const stops: Array<() => void> = []
  const proxy = runtime.proxy

  for (const [expression, descriptor] of Object.entries(watchMap)) {
    const normalized = normalizeWatchDescriptor(descriptor as any, runtime, instance)
    if (!normalized) {
      continue
    }
    const getter = createPathGetter(proxy, expression)
    const stop = runtime.watch(getter as any, normalized.handler as any, normalized.options)
    stops.push(stop)
  }

  return stops
}

export function mountRuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<D, C, M>,
  watchMap: WatchMap | undefined,
  setup?: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
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
    // Get props from mini-program properties
    const props = (target as any).properties || {}

    const context: any = {
      // Vue 3 compatible: props
      props,

      // Existing properties
      runtime,
      state: (runtime as any).state,
      proxy: (runtime as any).proxy,
      bindModel: (runtime as any).bindModel.bind(runtime),
      watch: (runtime as any).watch.bind(runtime),
      instance: target,

      // Vue 3 compatible: emit
      emit: (event: string, ...args: any[]) => {
        if (typeof (target as any).triggerEvent === 'function') {
          ;(target as any).triggerEvent(event, ...args)
        }
      },

      // Vue 3 compatible: expose
      expose: (exposed: Record<string, any>) => {
        target.__wevuExposed = exposed
      },

      // Vue 3 compatible: attrs (empty for mini-programs)
      attrs: {},
    }

    // Expose current instance only during synchronous setup execution.
    setCurrentInstance(target)
    try {
      const result = runSetupFunction(setup, props, context)
      if (result && typeof result === 'object') {
        Object.keys(result).forEach((key) => {
          const val = (result as any)[key]
          if (typeof val === 'function') {
            ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
          }
          else {
            ;(runtime.state as any)[key] = val
          }
        })
      }
    }
    finally {
      setCurrentInstance(undefined)
    }
  }

  // Bridge runtime.methods to target instance for native event handlers (Page/Component)
  try {
    const methods = (runtime.methods as unknown) as Record<string, any>
    for (const name of Object.keys(methods)) {
      if (typeof (target as any)[name] !== 'function') {
        ;(target as any)[name] = function bridged(this: any, ...args: any[]) {
          const bound = (this.$wevu?.methods as any)?.[name]
          if (typeof bound === 'function') {
            return bound.apply(this.$wevu.proxy, args)
          }
        }
      }
    }
  }
  catch {
    // ignore bridge errors
  }

  return runtime
}

export function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  // clear any registered hooks
  if (target.__wevuHooks) {
    target.__wevuHooks = undefined
  }
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

export function registerApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
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
    // call setup-registered app hooks on launch as an initial lifecycle point
    callHookList(this, 'onAppLaunch', args)
    if (typeof userOnLaunch === 'function') {
      userOnLaunch.apply(this, args)
    }
  }

  const userOnShow = appOptions.onShow
  appOptions.onShow = function onShow(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onAppShow', args)
    if (typeof userOnShow === 'function') {
      userOnShow.apply(this, args)
    }
  }

  const userOnHide = appOptions.onHide
  appOptions.onHide = function onHide(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onAppHide', args)
    if (typeof userOnHide === 'function') {
      userOnHide.apply(this, args)
    }
  }

  const userOnError = appOptions.onError
  appOptions.onError = function onError(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onAppError', args)
    if (typeof userOnError === 'function') {
      userOnError.apply(this, args)
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

export function registerPage<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
  mpOptions: Record<string, any>,
  features?: PageFeatures,
) {
  if (typeof Page !== 'function') {
    throw new TypeError('definePage requires the global Page constructor to be available')
  }

  const methodNames = Object.keys(methods ?? {})
  const pageOptions: Record<string, any> = {
    ...mpOptions,
  }

  const userOnLoad = mpOptions.onLoad
  pageOptions.onLoad = function onLoad(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    callHookList(this, 'onShow', args)
    if (typeof userOnLoad === 'function') {
      userOnLoad.apply(this, args)
    }
  }

  const userOnUnload = mpOptions.onUnload
  pageOptions.onUnload = function onUnload(this: InternalRuntimeState, ...args: any[]) {
    teardownRuntimeInstance(this)
    if (typeof userOnUnload === 'function') {
      userOnUnload.apply(this, args)
    }
  }

  const userOnShow = mpOptions.onShow
  pageOptions.onShow = function onShow(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onShow', args)
    if (typeof userOnShow === 'function') {
      userOnShow.apply(this, args)
    }
  }

  const userOnHide = mpOptions.onHide
  pageOptions.onHide = function onHide(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onHide', args)
    if (typeof userOnHide === 'function') {
      userOnHide.apply(this, args)
    }
  }

  const userOnReady = mpOptions.onReady
  pageOptions.onReady = function onReady(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onReady', args)
    if (typeof userOnReady === 'function') {
      return userOnReady.apply(this, args)
    }
  }

  const userOnSaveExitState = mpOptions.onSaveExitState
  pageOptions.onSaveExitState = function onSaveExitState(this: InternalRuntimeState, ...args: any[]) {
    const ret = callHookReturn(this, 'onSaveExitState', args)
    if (ret !== undefined) {
      return ret
    }
    if (typeof userOnSaveExitState === 'function') {
      return userOnSaveExitState.apply(this, args)
    }
  }

  if (features?.listenPageScroll) {
    const userOnPageScroll = mpOptions.onPageScroll
    pageOptions.onPageScroll = function onPageScroll(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPageScroll', args)
      if (typeof userOnPageScroll === 'function') {
        return userOnPageScroll.apply(this, args)
      }
    }
  }

  if (features?.enableShareAppMessage) {
    const userOnShare = mpOptions.onShareAppMessage
    pageOptions.onShareAppMessage = function pageOnShareAppMessage(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareAppMessage', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnShare === 'function') {
        return userOnShare.apply(this, args)
      }
    }
  }
  if (features?.enableShareTimeline) {
    const userOnShareTimeline = mpOptions.onShareTimeline
    pageOptions.onShareTimeline = function pageOnShareTimeline(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareTimeline', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnShareTimeline === 'function') {
        return userOnShareTimeline.apply(this, args)
      }
    }
  }
  if (features?.enableAddToFavorites) {
    const userOnAddToFavorites = mpOptions.onAddToFavorites
    pageOptions.onAddToFavorites = function pageOnAddToFavorites(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onAddToFavorites', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnAddToFavorites === 'function') {
        return userOnAddToFavorites.apply(this, args)
      }
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

export function registerComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
  mpOptions: Record<string, any>,
) {
  const {
    methods: userMethods = {},
    lifetimes: userLifetimes = {},
    pageLifetimes: userPageLifetimes = {},
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

  // Transform lifetimes/pageLifetimes to onXXX hooks
  const wrapSpecial = (name: string) => {
    const user = (userLifetimes as any)[name] ?? (userPageLifetimes as any)[name]
    ;(finalMethods as any)[name] = function wrapped(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, name, args)
      if (typeof user === 'function') {
        return user.apply(this, args)
      }
    }
  }
  wrapSpecial('onTabItemTap')
  wrapSpecial('onRouteDone')

  Component({
    ...rest,
    lifetimes: {
      ...userLifetimes,
      attached: function attached(this: InternalRuntimeState, ...args: any[]) {
        mountRuntimeInstance(this, runtimeApp, watch, setup)
        if (typeof (userLifetimes as any).attached === 'function') {
          ;(userLifetimes as any).attached.apply(this, args)
        }
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onReady', args)
        if (typeof (userLifetimes as any).ready === 'function') {
          ;(userLifetimes as any).ready.apply(this, args)
        }
      },
      detached: function detached(this: InternalRuntimeState, ...args: any[]) {
        teardownRuntimeInstance(this)
        if (typeof (userLifetimes as any).detached === 'function') {
          ;(userLifetimes as any).detached.apply(this, args)
        }
      },
    },
    pageLifetimes: {
      ...userPageLifetimes,
      show: function show(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onShow', args)
        if (typeof (userPageLifetimes as any).show === 'function') {
          ;(userPageLifetimes as any).show.apply(this, args)
        }
      },
      hide: function hide(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onHide', args)
        if (typeof (userPageLifetimes as any).hide === 'function') {
          ;(userPageLifetimes as any).hide.apply(this, args)
        }
      },
    },
    methods: finalMethods,
  })
}
