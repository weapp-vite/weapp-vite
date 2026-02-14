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
  TriggerEventOptions,
} from '../types'
import type { WatchMap } from './watch'
import { shallowReactive } from '../../reactivity'
import { callHookList, setCurrentInstance, setCurrentSetupContext } from '../hooks'
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
      scheduleTemplateRefUpdate(target)
      return result
    },
  }

  const runtime = runtimeApp.mount({
    ...(adapter as any),
  })
  runtimeRef = runtime
  const runtimeProxy = runtime?.proxy ?? {}
  const runtimeState = runtime?.state ?? {}
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
        Object.keys(result).forEach((key) => {
          const val = (result as any)[key]
          if (typeof val === 'function') {
            ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
            methodsChanged = true
          }
          else {
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
