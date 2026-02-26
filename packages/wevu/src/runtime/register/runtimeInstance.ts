import type { WatchStopHandle } from '../../reactivity'
import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  MiniProgramAdapter,
  RuntimeApp,
  RuntimeInstance,
  SetupContextNativeInstance,
  TriggerEventOptions,
} from '../types'
import type { WatchMap } from './watch'
import { isReactive, shallowReactive, toRaw } from '../../reactivity'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '../hooks'
import { isNativeBridgeMethod, markNativeBridgeMethod } from '../nativeBridge'
import { markNoSetData } from '../noSetData'
import { getMiniProgramGlobalObject } from '../platform'
import { allocateOwnerId, attachOwnerSnapshot, removeOwner, updateOwnerSnapshot } from '../scopedSlots'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../templateRefs'
import { runSetupFunction } from './setup'
import { registerWatches } from './watch'

type AdapterWithSetData = Required<MiniProgramAdapter> & { __wevu_enableSetData?: () => void }
type RuntimeSetupFunction<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  | DefineAppOptions<D, C, M>['setup']

function createSetupSlotsFallback() {
  return Object.freeze(Object.create(null)) as Record<string, never>
}

function createNoopWatchStopHandle(): WatchStopHandle {
  const stopHandle = (() => {}) as WatchStopHandle
  stopHandle.stop = () => {}
  stopHandle.pause = () => {}
  stopHandle.resume = () => {}
  return stopHandle
}

function safeMarkNoSetData<T extends object>(value: T): T {
  try {
    return markNoSetData(value)
  }
  catch {
    return value
  }
}

function isTriggerEventOptions(value: unknown): value is TriggerEventOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return (
    Object.prototype.hasOwnProperty.call(value, 'bubbles')
    || Object.prototype.hasOwnProperty.call(value, 'composed')
    || Object.prototype.hasOwnProperty.call(value, 'capturePhase')
  )
}

function normalizeEmitPayload(args: any[]): { detail: any, options: TriggerEventOptions | undefined } {
  if (args.length === 0) {
    return {
      detail: undefined,
      options: undefined,
    }
  }

  if (args.length === 1) {
    return {
      detail: args[0],
      options: undefined,
    }
  }

  const maybeOptions = args[args.length - 1]
  if (isTriggerEventOptions(maybeOptions)) {
    const detailArgs = args.slice(0, -1)
    return {
      detail: detailArgs.length <= 1 ? detailArgs[0] : detailArgs,
      options: maybeOptions,
    }
  }

  return {
    detail: args,
    options: undefined,
  }
}

type SetupInstanceMethodName = 'triggerEvent' | 'createSelectorQuery' | 'setData'
const setupInstanceMethodNames: SetupInstanceMethodName[] = ['triggerEvent', 'createSelectorQuery', 'setData']
const SETUP_CONTEXT_INSTANCE_KEY = '__wevuSetupContextInstance'

function resolveRuntimeNativeMethodOwner(
  runtime: RuntimeInstance<any, any, any>,
  target: InternalRuntimeState,
  methodName: SetupInstanceMethodName,
) {
  const runtimeState = runtime?.state
  const runtimeRawState = runtimeState && typeof runtimeState === 'object'
    ? toRaw(runtimeState as any)
    : undefined
  const runtimeProxy = runtime?.proxy as object | undefined
  const isBridgeMethod = (candidate: object) => {
    const candidateMethod = (candidate as any)[methodName]
    if (typeof candidateMethod !== 'function') {
      return false
    }
    if (isNativeBridgeMethod(candidateMethod)) {
      return true
    }
    const targetMethod = (target as any)[methodName]
    return typeof targetMethod === 'function' && candidateMethod === targetMethod
  }
  const isValidNativeCandidate = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') {
      return false
    }
    if (candidate === target || candidate === runtimeProxy) {
      return false
    }
    if (isBridgeMethod(candidate)) {
      return false
    }
    return typeof (candidate as any)[methodName] === 'function'
  }
  const nativeFromState = runtimeRawState ? (runtimeRawState as any).__wevuNativeInstance : undefined
  if (isValidNativeCandidate(nativeFromState)) {
    return nativeFromState as InternalRuntimeState
  }

  const runtimeInstance = (runtime as any)?.instance
  if (isValidNativeCandidate(runtimeInstance)) {
    return runtimeInstance as InternalRuntimeState
  }
  return undefined
}

function defineSetupInstanceMethod(
  target: Record<string, any>,
  methodName: SetupInstanceMethodName,
  handler: (...args: any[]) => any,
) {
  markNativeBridgeMethod(handler)
  try {
    Object.defineProperty(target, methodName, {
      value: handler,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(target as any)[methodName] = handler
  }
}

function ensureSetupContextInstance(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
) {
  const maybeCached = (target as any)[SETUP_CONTEXT_INSTANCE_KEY]
  if (maybeCached && typeof maybeCached === 'object') {
    return maybeCached as SetupContextNativeInstance
  }

  const setupInstanceBridge: Record<string, any> = Object.create(null)
  const resolveSetupBridgeOwner = (methodName: SetupInstanceMethodName) => {
    const owner = resolveRuntimeNativeMethodOwner(runtime, target, methodName)
    if (owner) {
      return owner
    }
    const fallbackMethod = (target as any)[methodName]
    if (typeof fallbackMethod === 'function' && !isNativeBridgeMethod(fallbackMethod)) {
      return target
    }
    return undefined
  }

  defineSetupInstanceMethod(setupInstanceBridge, 'triggerEvent', (...args: [string, any?, TriggerEventOptions?]) => {
    const [eventName, detail, options] = args
    const nativeOwner = resolveSetupBridgeOwner('triggerEvent')
    if (nativeOwner && typeof (nativeOwner as any).triggerEvent === 'function') {
      if (args.length >= 3) {
        ;(nativeOwner as any).triggerEvent(eventName, detail, options)
      }
      else {
        ;(nativeOwner as any).triggerEvent(eventName, detail)
      }
    }
  })

  defineSetupInstanceMethod(setupInstanceBridge, 'createSelectorQuery', () => {
    const nativeOwner = resolveSetupBridgeOwner('createSelectorQuery')
    if (nativeOwner && typeof (nativeOwner as any).createSelectorQuery === 'function') {
      return (nativeOwner as any).createSelectorQuery()
    }

    const miniProgramGlobal = getMiniProgramGlobalObject()
    if (!miniProgramGlobal || typeof miniProgramGlobal.createSelectorQuery !== 'function') {
      return undefined
    }

    const query = miniProgramGlobal.createSelectorQuery()
    if (!query || typeof query.in !== 'function') {
      return query
    }

    const scopedOwner = resolveRuntimeNativeMethodOwner(runtime, target, 'setData') ?? target
    return query.in(scopedOwner as any)
  })

  defineSetupInstanceMethod(setupInstanceBridge, 'setData', (payload: Record<string, any>, callback?: () => void) => {
    const nativeOwner = resolveSetupBridgeOwner('setData')
    if (nativeOwner && typeof (nativeOwner as any).setData === 'function') {
      return (nativeOwner as any).setData(payload, callback)
    }

    const adapter = runtime?.adapter
    const result = typeof adapter?.setData === 'function'
      ? adapter.setData(payload)
      : undefined
    if (typeof callback === 'function') {
      callback()
    }
    return result
  })

  const setupInstance = safeMarkNoSetData(new Proxy(setupInstanceBridge, {
    get(bridgeTarget, key, receiver) {
      if (Reflect.has(bridgeTarget, key)) {
        return Reflect.get(bridgeTarget, key, receiver)
      }
      const value = (target as any)[key as any]
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    },
    has(bridgeTarget, key) {
      return Reflect.has(bridgeTarget, key) || key in (target as any)
    },
    set(bridgeTarget, key, value) {
      if (Reflect.has(bridgeTarget, key)) {
        // 仅覆写 setup 暴露的 bridge 方法，避免回写原生实例引发递归调用。
        ;(bridgeTarget as any)[key as any] = value
        return true
      }
      ;(target as any)[key as any] = value
      return true
    },
  }) as SetupContextNativeInstance)

  try {
    Object.defineProperty(target as Record<string, any>, SETUP_CONTEXT_INSTANCE_KEY, {
      value: setupInstance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(target as any)[SETUP_CONTEXT_INSTANCE_KEY] = setupInstance
  }

  return setupInstance
}

function attachRuntimeProxyProps(state: Record<string, any>, props: Record<string, any>) {
  try {
    Object.defineProperty(state, '__wevuProps', {
      value: props,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(state as any).__wevuProps = props
  }
}

function attachNativeInstanceRef(state: Record<string, any>, instance: InternalRuntimeState) {
  try {
    Object.defineProperty(state, '__wevuNativeInstance', {
      value: instance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(state as any).__wevuNativeInstance = instance
  }
}

function attachRuntimeRef(state: Record<string, any>, runtime: RuntimeInstance<any, any, any>) {
  try {
    Object.defineProperty(state, '__wevuRuntime', {
      value: runtime,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(state as any).__wevuRuntime = runtime
  }
}

function attachRuntimeInstance(runtime: RuntimeInstance<any, any, any>, instance: InternalRuntimeState) {
  try {
    Object.defineProperty(runtime as Record<string, any>, 'instance', {
      value: instance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    try {
      ;(runtime as Record<string, any>).instance = instance
    }
    catch {
      // 忽略冻结对象写入失败
    }
  }
}

function resolveNativeSetData(instance: InternalRuntimeState) {
  const setupInstance = (instance as any)[SETUP_CONTEXT_INSTANCE_KEY] as SetupContextNativeInstance | undefined
  const setupOverride = setupInstance && typeof setupInstance.setData === 'function'
    ? setupInstance.setData
    : undefined
  if (typeof setupOverride === 'function' && !isNativeBridgeMethod(setupOverride)) {
    return setupOverride as (payload: Record<string, any>) => unknown
  }

  const candidate = (instance as any).setData
  if (typeof candidate !== 'function') {
    return undefined
  }
  if (isNativeBridgeMethod(candidate)) {
    return undefined
  }
  return candidate as (payload: Record<string, any>) => unknown
}

function getRuntimeOwnerLabel(instance: InternalRuntimeState) {
  const route = (instance as any).route
  if (typeof route === 'string' && route) {
    return route
  }
  const is = (instance as any).is
  if (typeof is === 'string' && is) {
    return is
  }
  return 'unknown'
}

function callNativeSetData(
  instance: InternalRuntimeState,
  setData: (payload: Record<string, any>) => unknown,
  payload: Record<string, any>,
) {
  try {
    return setData.call(instance, payload)
  }
  catch (error) {
    const owner = getRuntimeOwnerLabel(instance)
    throw new Error(`[wevu] setData failed (${owner}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

function syncRuntimeProps(props: Record<string, any>, mpProperties: Record<string, any>) {
  const currentKeys = Object.keys(props)
  for (const key of currentKeys) {
    if (!Object.prototype.hasOwnProperty.call(mpProperties, key)) {
      try {
        delete props[key]
      }
      catch {
        // 忽略异常
      }
    }
  }
  for (const [key, value] of Object.entries(mpProperties)) {
    props[key] = value
  }
}

/**
 * 挂载运行时实例（框架内部注册流程使用）。
 * @internal
 */
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
  safeMarkNoSetData(target)
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
        const setData = resolveNativeSetData(instance)
        if (setData) {
          return callNativeSetData(instance, setData, payload)
        }
        return undefined
      },
    }
    adapter.__wevu_enableSetData = () => {
      enabled = true
      const setData = resolveNativeSetData(instance)
      if (pending && Object.keys(pending).length && setData) {
        const payload = pending
        pending = undefined
        callNativeSetData(instance, setData, payload)
      }
    }
    return adapter
  }

  const baseAdapter: AdapterWithSetData = options?.deferSetData
    ? createDeferredAdapter(target)
    : {
        setData(payload: Record<string, any>) {
          const setData = resolveNativeSetData(target)
          if (setData) {
            return callNativeSetData(target, setData, payload)
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
      scheduleTemplateRefUpdate(target)
      return result
    },
  }

  const runtime = runtimeApp.mount({
    ...(adapter as any),
  })
  runtimeRef = runtime
  attachRuntimeInstance(runtime as RuntimeInstance<any, any, any>, target)
  const runtimeProxy = runtime?.proxy ?? {}
  const runtimeState = runtime?.state ?? {}
  if (runtimeState && typeof runtimeState === 'object') {
    attachRuntimeRef(runtimeState as Record<string, any>, runtime)
    attachNativeInstanceRef(runtimeState as Record<string, any>, target)
  }
  const runtimeComputed = (runtime as any)?.computed ?? Object.create(null)
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
  const runtimeWatch = (runtime as any)?.watch ?? (() => createNoopWatchStopHandle())
  const runtimeBindModel = (runtime as any)?.bindModel ?? (() => {})
  const runtimeWithDefaults: RuntimeInstance<any, any, any> = {
    ...(runtime ?? {}),
    state: runtimeState,
    proxy: runtimeProxy,
    methods: runtimeMethods,
    computed: runtimeComputed,
    watch: runtimeWatch,
    bindModel: runtimeBindModel,
    snapshot: (runtime as any)?.snapshot ?? (() => Object.create(null)),
    unmount: (runtime as any)?.unmount ?? (() => {}),
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
    // 从小程序 properties 提取 props 供 setup 使用，并复用 runtime state 上的 props 容器，
    // 避免 computed 首次求值早于 setup 时丢失依赖。
    const mpProperties = ((target as any).properties || {}) as Record<string, any>
    const runtimeProps = runtimeState && typeof runtimeState === 'object'
      ? ((runtimeState as any).__wevuProps as Record<string, any> | undefined)
      : undefined
    const props = runtimeProps && typeof runtimeProps === 'object'
      ? runtimeProps
      : shallowReactive({}) as Record<string, any>
    syncRuntimeProps(props, mpProperties)
    if (runtimeState && typeof runtimeState === 'object') {
      attachRuntimeProxyProps(runtimeState as Record<string, any>, props)
    }
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

    // 与 Vue 3 对齐：attrs = 非 props 的 attributes。
    // 在小程序场景中，attrs 来源于 instance.properties 中“未声明在 props/properties 的字段”。
    const attrs = shallowReactive(Object.create(null)) as Record<string, any>
    const declaredPropKeys = new Set(
      Array.isArray((target as any).__wevuPropKeys)
        ? ((target as any).__wevuPropKeys as string[])
        : [],
    )
    const hasRuntimeStateKey = (key: string) => {
      return runtimeState != null
        && typeof runtimeState === 'object'
        && Object.prototype.hasOwnProperty.call(runtimeState as Record<string, unknown>, key)
    }
    const syncAttrsFromProperties = () => {
      const next = ((target as any).properties && typeof (target as any).properties === 'object')
        ? ((target as any).properties as Record<string, unknown>)
        : undefined

      for (const existingKey of Object.keys(attrs)) {
        if (
          !next
          || !Object.prototype.hasOwnProperty.call(next, existingKey)
          || declaredPropKeys.has(existingKey)
          || hasRuntimeStateKey(existingKey)
        ) {
          delete attrs[existingKey]
        }
      }

      if (!next) {
        return
      }

      for (const [key, value] of Object.entries(next)) {
        if (declaredPropKeys.has(key) || hasRuntimeStateKey(key)) {
          continue
        }
        attrs[key] = value
      }
    }
    syncAttrsFromProperties()

    try {
      Object.defineProperty(target, '__wevuAttrs', {
        value: attrs,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(target as any).__wevuAttrs = attrs
    }

    const setupInstance = ensureSetupContextInstance(target, runtimeWithDefaults)

    const context: any = {
      // 与 Vue 3 对齐的 ctx.props
      props,

      // 现有运行时能力
      runtime: runtimeWithDefaults,
      state: runtimeState,
      proxy: runtimeProxy,
      bindModel: runtimeBindModel.bind(runtimeWithDefaults),
      watch: runtimeWatch.bind(runtimeWithDefaults),
      instance: setupInstance,

      // 通过小程序 triggerEvent 派发事件，并兼容 Vue 3 的 emit(event, ...args) 形式。
      emit: (event: string, ...args: any[]) => {
        const { detail, options } = normalizeEmitPayload(args)
        setupInstance.triggerEvent(event, detail, options)
      },

      // 与 Vue 3 对齐的 expose
      expose: (exposed: Record<string, any>) => {
        target.__wevuExposed = exposed
      },

      // 与 Vue 3 对齐的 attrs（小程序中为非 props 属性集合）
      attrs,

      // 与 Vue 3 对齐的 slots（小程序场景不提供可调用 slots 函数，兜底只读空对象）
      slots: createSetupSlotsFallback(),
    }

    // 仅在同步 setup 执行期间暴露 current instance
    setCurrentInstance(target)
    setCurrentSetupContext(context)
    try {
      const result = runSetupFunction(setup, props, context)
      let methodsChanged = false
      if (result && typeof result === 'object') {
        const runtimeRawState = isReactive(runtime.state)
          ? toRaw(runtime.state)
          : runtime.state
        Object.keys(result).forEach((key) => {
          const val = (result as any)[key]
          if (typeof val === 'function') {
            ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
            methodsChanged = true
          }
          else {
            if (declaredPropKeys.has(key)) {
              let fallbackValue = val
              try {
                Object.defineProperty(runtimeRawState as Record<string, unknown>, key, {
                  configurable: true,
                  enumerable: false,
                  get() {
                    const propsSource = (runtimeRawState as any).__wevuProps
                    if (propsSource && typeof propsSource === 'object' && Object.prototype.hasOwnProperty.call(propsSource, key)) {
                      return (propsSource as any)[key]
                    }
                    return fallbackValue
                  },
                  set(next: unknown) {
                    fallbackValue = next
                    const propsSource = (runtimeRawState as any).__wevuProps
                    if (!propsSource || typeof propsSource !== 'object') {
                      return
                    }
                    try {
                      ;(propsSource as any)[key] = next
                    }
                    catch {
                      // 忽略异常
                    }
                  },
                })
              }
              catch {
                ;(runtime.state as any)[key] = val
              }
              return
            }
            ;(runtime.state as any)[key] = val
          }
        })
      }
      if (methodsChanged) {
        ;(runtime as any).__wevu_touchSetupMethodsVersion?.()
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
      if (setupInstanceMethodNames.includes(name as SetupInstanceMethodName)) {
        continue
      }
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

export function enableDeferredSetData(target: InternalRuntimeState) {
  const adapter = (target as any).__wevu?.adapter
  if (adapter && typeof (adapter as any).__wevu_enableSetData === 'function') {
    ;(adapter as any).__wevu_enableSetData()
  }
}

/**
 * 卸载运行时实例（框架内部注册流程使用）。
 * @internal
 */
export function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  const ownerId = (target as any).__wvOwnerId
  if (ownerId) {
    removeOwner(ownerId)
  }
  clearTemplateRefs(target)
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
