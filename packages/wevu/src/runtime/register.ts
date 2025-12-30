import type {
  ComponentPropsOptions,
  ComponentPublicInstance,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  MiniProgramAppOptions,
  MiniProgramComponentRawOptions,
  PageFeatures,
  RuntimeApp,
  RuntimeInstance,
  TriggerEventOptions,
} from './types'
import { callHookList, callHookReturn, setCurrentInstance } from './hooks'

type WatchHandler = (this: any, value: any, oldValue: any) => void
type WatchDescriptor = WatchHandler | string | {
  handler: WatchHandler | string
  immediate?: boolean
  deep?: boolean
}
type WatchMap = Record<string, WatchDescriptor>

function runInlineExpression(ctx: any, expr: unknown, event: any) {
  const handlerName = typeof expr === 'string' ? expr : undefined
  if (!handlerName) {
    return undefined
  }
  const argsRaw = (event?.currentTarget as any)?.dataset?.wvArgs ?? (event?.target as any)?.dataset?.wvArgs
  let args: any[] = []
  if (typeof argsRaw === 'string') {
    try {
      args = JSON.parse(argsRaw)
    }
    catch {
      args = []
    }
  }
  const resolvedArgs = args.map((item: any) => item === '$event' ? event : item)
  const handler = (ctx as any)?.[handlerName]
  if (typeof handler === 'function') {
    return handler.apply(ctx, resolvedArgs)
  }
  return undefined
}

export function runSetupFunction(
  setup: ((...args: any[]) => any) | undefined,
  props: Record<string, any>,
  context: any,
) {
  if (typeof setup !== 'function') {
    return undefined
  }
  const runtimeContext = context?.runtime ?? {
    methods: Object.create(null),
    state: {},
    proxy: {},
    watch: () => () => {},
    bindModel: () => {},
  }
  if (context) {
    context.runtime = runtimeContext
  }
  const finalContext = {
    ...(context ?? {}),
    runtime: runtimeContext,
  }
  return setup.length >= 2 ? setup(props, finalContext) : setup(finalContext)
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
  if (target.__wevu) {
    return target.__wevu as RuntimeInstance<D, C, M>
  }
  const runtime = runtimeApp.mount({
    setData(payload: Record<string, any>) {
      if (typeof (target as any).setData === 'function') {
        (target as any).setData(payload)
      }
    },
  })
  const runtimeProxy = runtime?.proxy ?? {}
  const runtimeState = runtime?.state ?? {}
  // 防护：适配器可能返回不完整的 runtime（或被插件篡改），此处兜底补齐
  if (!runtime?.methods) {
    try {
      ;(runtime as any).methods = Object.create(null)
    }
    catch {
      // 若对象只读则忽略，后续将使用兜底 runtimeMethods
    }
  }
  const runtimeMethods = runtime?.methods ?? Object.create(null)
  const runtimeWatch = (runtime as any)?.watch ?? (() => () => {})
  const runtimeBindModel = (runtime as any)?.bindModel ?? (() => {})
  const runtimeWithDefaults = {
    ...(runtime ?? {}),
    state: runtimeState,
    proxy: runtimeProxy,
    methods: runtimeMethods,
    watch: runtimeWatch,
    bindModel: runtimeBindModel,
  }

  Object.defineProperty(target, '$wevu', {
    value: runtimeWithDefaults,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  target.__wevu = runtimeWithDefaults

  if (watchMap) {
    const stops = registerWatches(runtimeWithDefaults, watchMap, target)
    if (stops.length) {
      target.__wevuWatchStops = stops
    }
  }

  if (setup) {
    // 从小程序 properties 提取 props 供 setup 使用
    const props = (target as any).properties || {}

    const context: any = {
      // 与 Vue 3 对齐的 ctx.props
      props,

      // 现有运行时能力
      runtime: runtimeWithDefaults,
      state: runtimeState,
      proxy: runtimeProxy,
      bindModel: runtimeBindModel.bind(runtimeWithDefaults),
      watch: runtimeWatch.bind(runtimeWithDefaults),
      instance: target,

      // 通过小程序 triggerEvent 派发事件：
      // - detail: 事件载荷
      // - options: 控制事件传播行为（与 Vue 3 不同）
      //   - bubbles: 事件是否冒泡
      //   - composed: 事件是否可以穿越组件边界
      //   - capturePhase: 事件是否拥有捕获阶段
      emit: (event: string, detail?: any, options?: TriggerEventOptions) => {
        if (typeof (target as any).triggerEvent === 'function') {
          ;(target as any).triggerEvent(event, detail, options)
        }
      },

      // 与 Vue 3 对齐的 expose
      expose: (exposed: Record<string, any>) => {
        target.__wevuExposed = exposed
      },

      // 与 Vue 3 对齐的 attrs（小程序场景为空对象）
      attrs: {},
    }

    // 仅在同步 setup 执行期间暴露 current instance
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

  // 将 runtime.methods 透传到原生实例，供小程序事件处理直接调用
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
    // 桥接过程中若发生错误（如目标被封装）则忽略，避免阻断后续流程
  }

  return runtime
}

export function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  // 触发卸载钩子（仅在 teardown 首次执行时触发）
  if (runtime && target.__wevuHooks) {
    callHookList(target, 'onUnload', [])
  }
  // 清理注册的生命周期钩子
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
        // 避免 teardown 中断：单个 stop 失败不阻塞其他清理
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
  mpOptions: MiniProgramAppOptions,
) {
  if (typeof App !== 'function') {
    throw new TypeError('createApp requires the global App constructor to be available')
  }

  const methodNames = Object.keys(methods ?? {})
  const appOptions: Record<string, any> = {
    ...mpOptions,
  }

  appOptions.globalData = appOptions.globalData ?? {}

  if (!appOptions.__weapp_vite_inline) {
    appOptions.__weapp_vite_inline = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const expr = event?.currentTarget?.dataset?.wvHandler ?? event?.target?.dataset?.wvHandler
      const ctx = (this as any).__wevu?.proxy ?? this
      return runInlineExpression(ctx, expr, event)
    }
  }

  const userOnLaunch = appOptions.onLaunch
  appOptions.onLaunch = function onLaunch(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    // 触发通过 setup 注册的 app 级别钩子，作为首个生命周期点
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

export function registerComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
  mpOptions: MiniProgramComponentRawOptions,
  features?: PageFeatures,
) {
  const {
    methods: userMethods = {},
    lifetimes: userLifetimes = {},
    pageLifetimes: userPageLifetimes = {},
    options: userOptions = {},
    ...rest
  } = mpOptions

  const userOnLoad = (rest as any).onLoad
  const userOnUnload = (rest as any).onUnload
  const userOnShow = (rest as any).onShow
  const userOnHide = (rest as any).onHide
  const userOnReady = (rest as any).onReady
  const userOnSaveExitState = (rest as any).onSaveExitState
  const userOnPageScroll = (rest as any).onPageScroll
  const userOnShareAppMessage = (rest as any).onShareAppMessage
  const userOnShareTimeline = (rest as any).onShareTimeline
  const userOnAddToFavorites = (rest as any).onAddToFavorites

  const restOptions: Record<string, any> = {
    ...(rest as any),
  }
  delete restOptions.onLoad
  delete restOptions.onUnload
  delete restOptions.onShow
  delete restOptions.onHide
  delete restOptions.onReady
  delete restOptions.onSaveExitState
  delete restOptions.onPageScroll
  delete restOptions.onShareAppMessage
  delete restOptions.onShareTimeline
  delete restOptions.onAddToFavorites

  // 自动对齐 Vue 3 的 expose：
  // - 若用户未提供 component-export 的 export()，默认返回 setup() 中 expose() 写入的 __wevuExposed
  // - 若用户同时提供 export() 与 expose()，则自动浅合并（export() 优先级更高）
  {
    const userExport = (restOptions as any).export
    ;(restOptions as any).export = function __wevu_export(this: InternalRuntimeState) {
      const exposed = (this as any).__wevuExposed ?? {}
      const base = typeof userExport === 'function' ? userExport.call(this) : {}

      if (base && typeof base === 'object' && !Array.isArray(base)) {
        return {
          ...exposed,
          ...base,
        }
      }

      // 若用户 export() 返回非对象（理论上不应发生），则保持原返回值；否则回退 exposed
      return base ?? exposed
    }
  }

  // 默认启用多 slot 以兼容微信小程序具名插槽写法；用户显式配置时保持原值
  const finalOptions = {
    multipleSlots: (userOptions as any).multipleSlots ?? true,
    ...(userOptions as any),
  }

  const finalMethods: Record<string, (...args: any[]) => any> = {
    ...userMethods,
  }
  if (!finalMethods.__weapp_vite_inline) {
    finalMethods.__weapp_vite_inline = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const expr = event?.currentTarget?.dataset?.wvHandler ?? event?.target?.dataset?.wvHandler
      const ctx = (this as any).__wevu?.proxy ?? this
      return runInlineExpression(ctx, expr, event)
    }
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

  // 将 lifetimes/pageLifetimes 中的特殊钩子包装为 onXXX 生命周期调用
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

  const pageLifecycleHooks: Record<string, any> = {
    onLoad(this: InternalRuntimeState, ...args: any[]) {
      mountRuntimeInstance(this, runtimeApp, watch, setup)
      if (typeof userOnLoad === 'function') {
        return userOnLoad.apply(this, args)
      }
    },
    onUnload(this: InternalRuntimeState, ...args: any[]) {
      teardownRuntimeInstance(this)
      if (typeof userOnUnload === 'function') {
        return userOnUnload.apply(this, args)
      }
    },
    onShow(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onShow', args)
      if (typeof userOnShow === 'function') {
        return userOnShow.apply(this, args)
      }
    },
    onHide(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onHide', args)
      if (typeof userOnHide === 'function') {
        return userOnHide.apply(this, args)
      }
    },
    onReady(this: InternalRuntimeState, ...args: any[]) {
      // 兼容：部分平台/模式可能触发 Page.onReady，而非 Component lifetimes.ready
      if (!(this as any).__wevuReadyCalled) {
        ;(this as any).__wevuReadyCalled = true
        callHookList(this, 'onReady', args)
      }
      if (typeof userOnReady === 'function') {
        return userOnReady.apply(this, args)
      }
    },
    onSaveExitState(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onSaveExitState', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnSaveExitState === 'function') {
        return userOnSaveExitState.apply(this, args)
      }
    },
  }

  if (features?.listenPageScroll) {
    pageLifecycleHooks.onPageScroll = function onPageScroll(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPageScroll', args)
      if (typeof userOnPageScroll === 'function') {
        return userOnPageScroll.apply(this, args)
      }
    }
  }
  if (features?.enableShareAppMessage) {
    pageLifecycleHooks.onShareAppMessage = function onShareAppMessage(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareAppMessage', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnShareAppMessage === 'function') {
        return userOnShareAppMessage.apply(this, args)
      }
    }
  }
  if (features?.enableShareTimeline) {
    pageLifecycleHooks.onShareTimeline = function onShareTimeline(this: InternalRuntimeState, ...args: any[]) {
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
    pageLifecycleHooks.onAddToFavorites = function onAddToFavorites(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onAddToFavorites', args)
      if (ret !== undefined) {
        return ret
      }
      if (typeof userOnAddToFavorites === 'function') {
        return userOnAddToFavorites.apply(this, args)
      }
    }
  }

  Component({
    ...restOptions,
    ...pageLifecycleHooks,
    lifetimes: {
      ...userLifetimes,
      moved: function moved(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onMoved', args)
        if (typeof (userLifetimes as any).moved === 'function') {
          ;(userLifetimes as any).moved.apply(this, args)
        }
      },
      attached: function attached(this: InternalRuntimeState, ...args: any[]) {
        mountRuntimeInstance(this, runtimeApp, watch, setup)
        if (typeof (userLifetimes as any).attached === 'function') {
          ;(userLifetimes as any).attached.apply(this, args)
        }
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        if (!(this as any).__wevuReadyCalled) {
          ;(this as any).__wevuReadyCalled = true
          callHookList(this, 'onReady', args)
        }
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
      error: function error(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onError', args)
        if (typeof (userLifetimes as any).error === 'function') {
          ;(userLifetimes as any).error.apply(this, args)
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
      resize: function resize(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onResize', args)
        if (typeof (userPageLifetimes as any).resize === 'function') {
          ;(userPageLifetimes as any).resize.apply(this, args)
        }
      },
    },
    methods: finalMethods,
    options: finalOptions,
  })
}
