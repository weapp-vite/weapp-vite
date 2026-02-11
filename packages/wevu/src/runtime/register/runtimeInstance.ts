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
import { resolveRuntimeAttrs } from './component/attrs'
import { runSetupFunction } from './setup'
import { registerWatches } from './watch'

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

    const attrs = shallowReactive(resolveRuntimeAttrs(mpProperties as any, (mpProperties as any).__wvAttrs)) as Record<string, any>
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

      // 与 Vue 3 对齐的 attrs（收集未声明 props）
      attrs,

      // 与 Vue 3 对齐的 slots（小程序场景暂不支持运行时 slots，兜底为空对象）
      slots: Object.create(null),
    }
    ;(target as any).__wevuSetupContext = context

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
  ;(target as any).__wevuSetupContext = undefined
  if (runtime) {
    runtime.unmount()
  }
  delete target.__wevu
  if ('$wevu' in target) {
    delete (target as any).$wevu
  }
}
