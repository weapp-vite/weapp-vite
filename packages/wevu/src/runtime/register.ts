import type { WatchMap } from './register/watch'
import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  MiniProgramAdapter,
  MiniProgramAppOptions,
  MiniProgramComponentRawOptions,
  PageFeatures,
  RuntimeApp,
  RuntimeInstance,
  TriggerEventOptions,
} from './types'
import { shallowReactive } from '../reactivity'
import { callHookList, callHookReturn, setCurrentInstance, setCurrentSetupContext } from './hooks'
import { parseModelEventValue } from './internal'
import { runInlineExpression } from './register/inline'
import { runSetupFunction } from './register/setup'
import { refreshOwnerSnapshotFromInstance } from './register/snapshot'
import { registerWatches } from './register/watch'
import { allocateOwnerId, attachOwnerSnapshot, removeOwner, updateOwnerSnapshot } from './scopedSlots'

export { runSetupFunction }

type AdapterWithSetData = Required<MiniProgramAdapter> & { __wevu_enableSetData?: () => void }
type RuntimeSetupFunction<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  | DefineAppOptions<D, C, M>['setup']

export function mountRuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<D, C, M>,
  watchMap: WatchMap | undefined,
  setup?: RuntimeSetupFunction<D, C, M>,
  options?: { deferSetData?: boolean },
) {
  if (target.__wevu) {
    return target.__wevu as RuntimeInstance<D, C, M>
  }
  const ownerId = allocateOwnerId()
  const createDeferredAdapter = (instance: InternalRuntimeState): AdapterWithSetData => {
    let pending: Record<string, any> | undefined
    let enabled = false
    const adapter: AdapterWithSetData = {
      setData(payload: Record<string, any>) {
        if (!enabled) {
          pending = {
            ...(pending ?? {}),
            ...payload,
          }
          return undefined
        }
        if (typeof (instance as any).setData === 'function') {
          return (instance as any).setData(payload)
        }
        return undefined
      },
    }
    adapter.__wevu_enableSetData = () => {
      enabled = true
      if (pending && Object.keys(pending).length && typeof (instance as any).setData === 'function') {
        const payload = pending
        pending = undefined
        ;(instance as any).setData(payload)
      }
    }
    return adapter
  }

  const baseAdapter: AdapterWithSetData = options?.deferSetData
    ? createDeferredAdapter(target)
    : {
        setData(payload: Record<string, any>) {
          if (typeof (target as any).setData === 'function') {
            return (target as any).setData(payload)
          }
          return undefined
        },
      }
  let runtimeRef: RuntimeInstance<any, any, any> | undefined
  const refreshOwnerSnapshot = () => {
    if (!runtimeRef) {
      return
    }
    if (typeof runtimeRef.snapshot !== 'function') {
      return
    }
    const snapshot = runtimeRef.snapshot()
    const propsSource = (target as any).__wevuProps ?? (target as any).properties
    if (propsSource && typeof propsSource === 'object') {
      for (const [key, value] of Object.entries(propsSource)) {
        snapshot[key] = value
      }
    }
    updateOwnerSnapshot(ownerId, snapshot, runtimeRef.proxy)
  }
  const adapter: AdapterWithSetData = {
    ...(baseAdapter as any),
    setData(payload: Record<string, any>) {
      const result = baseAdapter.setData(payload)
      refreshOwnerSnapshot()
      return result
    },
  }

  const runtime = runtimeApp.mount({
    ...(adapter as any),
  })
  runtimeRef = runtime
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

  attachOwnerSnapshot(target, runtimeWithDefaults as any, ownerId)

  if (watchMap) {
    const stops = registerWatches(runtimeWithDefaults, watchMap, target)
    if (stops.length) {
      target.__wevuWatchStops = stops
    }
  }

  if (setup) {
    // 从小程序 properties 提取 props 供 setup 使用
    const mpProperties = (target as any).properties || {}
    const props = shallowReactive({ ...(mpProperties as any) }) as any
    try {
      Object.defineProperty(target, '__wevuProps', {
        value: props,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(target as any).__wevuProps = props
    }

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

      // 与 Vue 3 对齐的 slots（小程序场景暂不支持运行时 slots，兜底为空对象）
      slots: Object.create(null),
    }

    // 仅在同步 setup 执行期间暴露 current instance
    setCurrentInstance(target)
    setCurrentSetupContext(context)
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
      setCurrentSetupContext(undefined)
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

function enableDeferredSetData(target: InternalRuntimeState) {
  const adapter = (target as any).__wevu?.adapter
  if (adapter && typeof (adapter as any).__wevu_enableSetData === 'function') {
    ;(adapter as any).__wevu_enableSetData()
  }
}

export function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  const ownerId = (target as any).__wvOwnerId
  if (ownerId) {
    removeOwner(ownerId)
  }
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
    throw new TypeError('createApp 需要全局 App 构造器可用')
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
    callHookList(this, 'onLaunch', args)
    if (typeof userOnLaunch === 'function') {
      userOnLaunch.apply(this, args)
    }
  }

  const userOnShow = appOptions.onShow
  appOptions.onShow = function onShow(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onShow', args)
    if (typeof userOnShow === 'function') {
      userOnShow.apply(this, args)
    }
  }

  const userOnHide = appOptions.onHide
  appOptions.onHide = function onHide(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onHide', args)
    if (typeof userOnHide === 'function') {
      userOnHide.apply(this, args)
    }
  }

  const userOnError = appOptions.onError
  appOptions.onError = function onError(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onError', args)
    if (typeof userOnError === 'function') {
      userOnError.apply(this, args)
    }
  }

  const userOnPageNotFound = (appOptions as any).onPageNotFound
  ;(appOptions as any).onPageNotFound = function onPageNotFound(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onPageNotFound', args)
    if (typeof userOnPageNotFound === 'function') {
      userOnPageNotFound.apply(this, args)
    }
  }

  const userOnUnhandledRejection = (appOptions as any).onUnhandledRejection
  ;(appOptions as any).onUnhandledRejection = function onUnhandledRejection(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onUnhandledRejection', args)
    if (typeof userOnUnhandledRejection === 'function') {
      userOnUnhandledRejection.apply(this, args)
    }
  }

  const userOnThemeChange = (appOptions as any).onThemeChange
  ;(appOptions as any).onThemeChange = function onThemeChange(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onThemeChange', args)
    if (typeof userOnThemeChange === 'function') {
      userOnThemeChange.apply(this, args)
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
  const userOnPullDownRefresh = (rest as any).onPullDownRefresh
  const userOnReachBottom = (rest as any).onReachBottom
  const userOnPageScroll = (rest as any).onPageScroll
  const userOnRouteDone = (rest as any).onRouteDone
  const userOnTabItemTap = (rest as any).onTabItemTap
  const userOnResize = (rest as any).onResize
  const userOnShareAppMessage = (rest as any).onShareAppMessage
  const userOnShareTimeline = (rest as any).onShareTimeline
  const userOnAddToFavorites = (rest as any).onAddToFavorites
  const features = ((rest as any).features ?? {}) as PageFeatures

  const restOptions: Record<string, any> = {
    ...(rest as any),
  }
  const userObservers = (restOptions as any).observers as Record<string, any> | undefined
  const legacyCreated = restOptions.created
  delete restOptions.features
  delete restOptions.created
  delete restOptions.onLoad
  delete restOptions.onUnload
  delete restOptions.onShow
  delete restOptions.onHide
  delete restOptions.onReady

  // 页面级钩子仅在需要时启用：
  // - 可能影响渲染/逻辑线程的事件派发，甚至界面行为（如分享菜单）。
  // - 仅当用户显式定义对应原生处理函数时才桥接。
  const enableOnPullDownRefresh = typeof userOnPullDownRefresh === 'function' || Boolean(features.enableOnPullDownRefresh)
  const enableOnReachBottom = typeof userOnReachBottom === 'function' || Boolean(features.enableOnReachBottom)
  const enableOnPageScroll = typeof userOnPageScroll === 'function' || Boolean(features.enableOnPageScroll)
  const enableOnRouteDone = typeof userOnRouteDone === 'function' || Boolean(features.enableOnRouteDone)
  const enableOnTabItemTap = typeof userOnTabItemTap === 'function' || Boolean(features.enableOnTabItemTap)
  const enableOnResize = typeof userOnResize === 'function' || Boolean(features.enableOnResize)
  const enableOnShareAppMessage = typeof userOnShareAppMessage === 'function' || Boolean(features.enableOnShareAppMessage)
  const enableOnShareTimeline = typeof userOnShareTimeline === 'function' || Boolean(features.enableOnShareTimeline)
  const enableOnAddToFavorites = typeof userOnAddToFavorites === 'function' || Boolean(features.enableOnAddToFavorites)
  const enableOnSaveExitState = typeof userOnSaveExitState === 'function' || Boolean(features.enableOnSaveExitState)

  const fallbackNoop = () => {}
  const fallbackShareContent = () => ({})
  const fallbackTimelineContent = () => ({})

  const effectiveOnSaveExitState = (typeof userOnSaveExitState === 'function'
    ? userOnSaveExitState
    : (() => ({ data: undefined })) as any)
  const effectiveOnPullDownRefresh = typeof userOnPullDownRefresh === 'function' ? userOnPullDownRefresh : fallbackNoop
  const effectiveOnReachBottom = typeof userOnReachBottom === 'function' ? userOnReachBottom : fallbackNoop
  const effectiveOnPageScroll = typeof userOnPageScroll === 'function' ? userOnPageScroll : fallbackNoop
  const effectiveOnRouteDone = typeof userOnRouteDone === 'function' ? userOnRouteDone : fallbackNoop
  const effectiveOnTabItemTap = typeof userOnTabItemTap === 'function' ? userOnTabItemTap : fallbackNoop
  const effectiveOnResize = typeof userOnResize === 'function' ? userOnResize : fallbackNoop
  const effectiveOnShareAppMessage = typeof userOnShareAppMessage === 'function' ? userOnShareAppMessage : (fallbackShareContent as any)
  const effectiveOnShareTimeline = typeof userOnShareTimeline === 'function' ? userOnShareTimeline : (fallbackTimelineContent as any)
  const effectiveOnAddToFavorites = (typeof userOnAddToFavorites === 'function' ? userOnAddToFavorites : (() => ({})) as any)

  const hasHook = (target: InternalRuntimeState, name: string) => {
    const hooks = target.__wevuHooks
    if (!hooks) {
      return false
    }
    const entry = (hooks as any)[name]
    if (!entry) {
      return false
    }
    if (Array.isArray(entry)) {
      return entry.length > 0
    }
    return typeof entry === 'function'
  }

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

  const syncWevuPropsFromInstance = (instance: InternalRuntimeState) => {
    const propsProxy = (instance as any).__wevuProps
    const properties = (instance as any).properties
    if (!propsProxy || typeof propsProxy !== 'object') {
      return
    }
    if (!properties || typeof properties !== 'object') {
      return
    }
    const next = properties as any
    const currentKeys = Object.keys(propsProxy as any)
    for (const existingKey of currentKeys) {
      if (!Object.prototype.hasOwnProperty.call(next, existingKey)) {
        try {
          delete (propsProxy as any)[existingKey]
        }
        catch {
          // 忽略异常
        }
      }
    }
    for (const [k, v] of Object.entries(next)) {
      try {
        ;(propsProxy as any)[k] = v
      }
      catch {
        // 忽略异常
      }
    }
    refreshOwnerSnapshotFromInstance(instance)
  }

  const syncWevuPropValue = (instance: InternalRuntimeState, key: string, value: unknown) => {
    const propsProxy = (instance as any).__wevuProps
    if (!propsProxy || typeof propsProxy !== 'object') {
      return
    }
    try {
      ;(propsProxy as any)[key] = value
    }
    catch {
      // 忽略异常
    }
    refreshOwnerSnapshotFromInstance(instance)
  }

  // 同步小程序 properties -> setup 返回的 `props` 绑定（Vue SFC 常见写法：const props = defineProps()）
  // 背景：在 created 阶段 props 可能仍是空值（父组件尚未 setData），后续 properties 更新时需要把变化同步到 runtime.state.props，
  // 否则模板中使用 `props.xxx` 会出现 devtools 中 props 仍为旧值/undefined 的现象。
  const propKeys = restOptions.properties && typeof restOptions.properties === 'object'
    ? Object.keys(restOptions.properties as any)
    : []
  const injectedObservers: Record<string, any> = {}
  if (propKeys.length) {
    for (const key of propKeys) {
      injectedObservers[key] = function __wevu_prop_observer(this: InternalRuntimeState, newValue: unknown) {
        // 注意：在部分小程序运行时中，observer 回调触发时 `this.properties` 可能尚未更新，
        // 因此这里以 observer 的 newValue 为准写入 propsProxy，避免出现 props 仍为旧值/undefined。
        syncWevuPropValue(this, key, newValue)
      }
    }
  }

  const finalObservers: Record<string, any> = {
    ...(userObservers ?? {}),
  }
  for (const [key, injected] of Object.entries(injectedObservers)) {
    const existing = finalObservers[key]
    if (typeof existing === 'function') {
      finalObservers[key] = function chainedObserver(this: InternalRuntimeState, ...args: any[]) {
        existing.apply(this, args)
        injected.apply(this, args)
      }
    }
    else {
      finalObservers[key] = injected
    }
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
  if (!finalMethods.__weapp_vite_model) {
    finalMethods.__weapp_vite_model = function __weapp_vite_model(this: InternalRuntimeState, event: any) {
      const path = event?.currentTarget?.dataset?.wvModel ?? event?.target?.dataset?.wvModel
      if (typeof path !== 'string' || !path) {
        return undefined
      }
      const runtime = (this as any).__wevu
      if (!runtime || typeof runtime.bindModel !== 'function') {
        return undefined
      }
      const value = parseModelEventValue(event)
      try {
        runtime.bindModel(path).update(value)
      }
      catch {
        // 忽略异常
      }
      return undefined
    }
  }
  if (!finalMethods.__weapp_vite_owner && typeof (methods as any)?.__weapp_vite_owner === 'function') {
    finalMethods.__weapp_vite_owner = (methods as any).__weapp_vite_owner
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

  const pageLifecycleHooks: Record<string, any> = {
    onLoad(this: InternalRuntimeState, ...args: any[]) {
      mountRuntimeInstance(this, runtimeApp, watch, setup)
      enableDeferredSetData(this)
      callHookList(this, 'onLoad', args)
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
  }

  if (enableOnSaveExitState) {
    pageLifecycleHooks.onSaveExitState = function onSaveExitState(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onSaveExitState', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnSaveExitState.apply(this, args)
    }
  }
  if (enableOnPullDownRefresh) {
    pageLifecycleHooks.onPullDownRefresh = function onPullDownRefresh(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPullDownRefresh', args)
      if (!hasHook(this, 'onPullDownRefresh')) {
        return effectiveOnPullDownRefresh.apply(this, args)
      }
    }
  }
  if (enableOnReachBottom) {
    pageLifecycleHooks.onReachBottom = function onReachBottom(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onReachBottom', args)
      if (!hasHook(this, 'onReachBottom')) {
        return effectiveOnReachBottom.apply(this, args)
      }
    }
  }
  if (enableOnPageScroll) {
    pageLifecycleHooks.onPageScroll = function onPageScroll(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPageScroll', args)
      if (!hasHook(this, 'onPageScroll')) {
        return effectiveOnPageScroll.apply(this, args)
      }
    }
  }
  if (enableOnRouteDone) {
    pageLifecycleHooks.onRouteDone = function onRouteDone(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onRouteDone', args)
      if (!hasHook(this, 'onRouteDone')) {
        return effectiveOnRouteDone.apply(this, args)
      }
    }
  }
  if (enableOnTabItemTap) {
    pageLifecycleHooks.onTabItemTap = function onTabItemTap(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onTabItemTap', args)
      if (!hasHook(this, 'onTabItemTap')) {
        return effectiveOnTabItemTap.apply(this, args)
      }
    }
  }
  if (enableOnResize) {
    pageLifecycleHooks.onResize = function onResize(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onResize', args)
      if (!hasHook(this, 'onResize')) {
        return effectiveOnResize.apply(this, args)
      }
    }
  }
  if (enableOnShareAppMessage) {
    pageLifecycleHooks.onShareAppMessage = function onShareAppMessage(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareAppMessage', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnShareAppMessage.apply(this, args)
    }
  }
  if (enableOnShareTimeline) {
    pageLifecycleHooks.onShareTimeline = function onShareTimeline(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareTimeline', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnShareTimeline.apply(this, args)
    }
  }
  if (enableOnAddToFavorites) {
    pageLifecycleHooks.onAddToFavorites = function onAddToFavorites(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onAddToFavorites', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnAddToFavorites.apply(this, args)
    }
  }

  Component({
    ...restOptions,
    ...pageLifecycleHooks,
    observers: finalObservers,
    lifetimes: {
      ...userLifetimes,
      created: function created(this: InternalRuntimeState, ...args: any[]) {
        mountRuntimeInstance(this, runtimeApp, watch, setup, { deferSetData: true })
        syncWevuPropsFromInstance(this)
        // 兼容：若用户使用旧式 created（非 lifetimes.created），在定义 lifetimes.created 后会被覆盖，这里手动补齐调用
        if (typeof legacyCreated === 'function') {
          legacyCreated.apply(this, args)
        }
        if (typeof (userLifetimes as any).created === 'function') {
          ;(userLifetimes as any).created.apply(this, args)
        }
      },
      moved: function moved(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onMoved', args)
        if (typeof (userLifetimes as any).moved === 'function') {
          ;(userLifetimes as any).moved.apply(this, args)
        }
      },
      attached: function attached(this: InternalRuntimeState, ...args: any[]) {
        mountRuntimeInstance(this, runtimeApp, watch, setup)
        syncWevuPropsFromInstance(this)
        enableDeferredSetData(this)
        if (typeof (userLifetimes as any).attached === 'function') {
          ;(userLifetimes as any).attached.apply(this, args)
        }
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        if (!(this as any).__wevuReadyCalled) {
          ;(this as any).__wevuReadyCalled = true
          syncWevuPropsFromInstance(this)
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
