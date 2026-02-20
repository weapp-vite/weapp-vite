import type { MutationRecord, WatchOptions, WatchStopHandle } from '../reactivity'
import type {
  AppConfig,
  ComputedDefinitions,
  CreateAppOptions,
  ExtractComputed,
  MethodDefinitions,
  MiniProgramAdapter,
  RuntimeApp,
  RuntimeInstance,
  WevuPlugin,
} from './types'
import { addMutationRecorder, effect, isReactive, isRef, prelinkReactiveTree, reactive, removeMutationRecorder, shallowReactive, stop, toRaw, touchReactive, watch } from '../reactivity'
import { clearPatchIndices } from '../reactivity/reactive'
import { queueJob } from '../scheduler'
import { createRuntimeContext } from './app/context'
import { createSetDataScheduler } from './app/setData/scheduler'
import { resolveSetDataOptions } from './app/setDataOptions'
import { createBindModel } from './bindModel'
import { applyWevuAppDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { registerApp } from './register'

function createWatchStopHandle(cleanup: () => void, baseHandle?: WatchStopHandle): WatchStopHandle {
  const stopHandle = (() => {
    cleanup()
  }) as WatchStopHandle
  stopHandle.stop = () => stopHandle()
  stopHandle.pause = () => {
    baseHandle?.pause?.()
  }
  stopHandle.resume = () => {
    baseHandle?.resume?.()
  }
  return stopHandle
}

export function createApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: CreateAppOptions<D, C, M>,
): RuntimeApp<D, C, M> {
  const defaultsScope = (options as any)[INTERNAL_DEFAULTS_SCOPE_KEY] as string | undefined
  const resolvedOptions = defaultsScope === 'component'
    ? options
    : applyWevuAppDefaults(options)
  const {
    [INTERNAL_DEFAULTS_SCOPE_KEY]: _ignoredDefaultsScope,
    data,
    computed: computedOptions,
    methods,
    setData: setDataOptions,
    watch: appWatch,
    setup: appSetup,
    ...mpOptions
  } = resolvedOptions
  const resolvedMethods = methods ?? ({} as M)
  const resolvedComputed = computedOptions ?? ({} as C)

  const installedPlugins = new Set<WevuPlugin>()
  const appConfig: AppConfig = { globalProperties: {} }

  const runtimeApp: RuntimeApp<D, C, M> = {
    mount(adapter?: MiniProgramAdapter): RuntimeInstance<D, C, M> {
      const dataFn = data ?? (() => ({}) as D)
      const rawState = dataFn()
      // 预置 props 容器，确保编译器生成的 this.__wevuProps 回退表达式
      // 在 computed 首次求值阶段即可建立响应式依赖。
      if (rawState && typeof rawState === 'object' && !Object.prototype.hasOwnProperty.call(rawState as object, '__wevuProps')) {
        try {
          Object.defineProperty(rawState as object, '__wevuProps', {
            value: shallowReactive(Object.create(null)),
            configurable: true,
            enumerable: false,
            writable: false,
          })
        }
        catch {
          // 若 data 返回对象不可扩展，则跳过预置，后续由 mount 阶段兜底注入。
        }
      }
      const state = reactive(rawState)
      const computedDefs = resolvedComputed
      const methodDefs = resolvedMethods

      let mounted = true
      const stopHandles: WatchStopHandle[] = []

      const {
        includeComputed,
        setDataStrategy,
        maxPatchKeys,
        maxPayloadBytes,
        mergeSiblingThreshold,
        mergeSiblingMaxInflationRatio,
        mergeSiblingMaxParentBytes,
        mergeSiblingSkipArray,
        computedCompare,
        computedCompareMaxDepth,
        computedCompareMaxKeys,
        prelinkMaxDepth,
        prelinkMaxKeys,
        debug,
        debugWhen,
        debugSampleRate,
        elevateTopKeyThreshold,
        toPlainMaxDepth,
        toPlainMaxKeys,
        shouldIncludeKey,
      } = resolveSetDataOptions(setDataOptions)

      const {
        boundMethods,
        computedRefs,
        computedSetters,
        dirtyComputedKeys,
        computedProxy,
        publicInstance,
        touchSetupMethodsVersion,
      } = createRuntimeContext({
        state,
        computedDefs,
        methodDefs,
        appConfig,
        includeComputed,
        setDataStrategy,
      })

      const currentAdapter = adapter ?? { setData: () => {} }
      const stateRootRaw = toRaw(state as any) as object
      let tracker: ReturnType<typeof effect> | undefined
      const scheduler = createSetDataScheduler({
        state: state as any,
        computedRefs,
        dirtyComputedKeys,
        includeComputed,
        setDataStrategy,
        computedCompare,
        computedCompareMaxDepth,
        computedCompareMaxKeys,
        currentAdapter,
        shouldIncludeKey,
        maxPatchKeys,
        maxPayloadBytes,
        mergeSiblingThreshold,
        mergeSiblingMaxInflationRatio,
        mergeSiblingMaxParentBytes,
        mergeSiblingSkipArray,
        elevateTopKeyThreshold,
        toPlainMaxDepth,
        toPlainMaxKeys,
        debug,
        debugWhen,
        debugSampleRate,
        runTracker: () => tracker?.(),
        isMounted: () => mounted,
      })
      const job = () => scheduler.job(stateRootRaw)
      const mutationRecorder = (record: MutationRecord) => scheduler.mutationRecorder(record, stateRootRaw)

      tracker = effect(
        () => {
          // 通过根版本信号跟踪任意状态变化
          touchReactive(state as any)
          // 在 setup 返回的 ref/computedRef 变更不会提升 reactive 根版本：
          // 这里额外读取其 `.value` 以建立依赖，从而触发 diff + setData 更新。
          Object.keys(state as any).forEach((key) => {
            const v = (state as any)[key]
            if (isRef(v)) {
              const inner = v.value
              if (isReactive(inner)) {
                // setup 返回的 ref 若持有对象/数组，需要额外订阅其版本号；
                // 否则仅修改 inner 字段（如 items.value[0].quantity）不会触发调度。
                touchReactive(inner as any)
              }
            }
            else if (isReactive(v)) {
              // 让 effect 订阅 setup 返回的浅/深响应式对象的“版本号”，
              // 以捕获从外部直接修改其字段（例如 props 同步）导致的变更。
              touchReactive(v as any)
            }
          })
        },
        {
          lazy: true,
          scheduler: () => queueJob(job),
        },
      )

      job()

      stopHandles.push(createWatchStopHandle(() => stop(tracker)))
      if (setDataStrategy === 'patch') {
        prelinkReactiveTree(state as any, { shouldIncludeTopKey: shouldIncludeKey, maxDepth: prelinkMaxDepth, maxKeys: prelinkMaxKeys })
        addMutationRecorder(mutationRecorder)
        stopHandles.push(createWatchStopHandle(() => removeMutationRecorder(mutationRecorder)))
        stopHandles.push(createWatchStopHandle(() => clearPatchIndices(state as any)))
      }

      function registerWatch<T>(
        source: (() => T) | Record<string, any>,
        cb: (value: T, oldValue: T) => void,
        watchOptions?: WatchOptions,
      ): WatchStopHandle {
        const stopHandle = watch(source as any, (value: T, oldValue: T) => cb(value, oldValue), watchOptions)
        stopHandles.push(stopHandle)
        return createWatchStopHandle(() => {
          stopHandle()
          const index = stopHandles.indexOf(stopHandle)
          if (index >= 0) {
            stopHandles.splice(index, 1)
          }
        }, stopHandle)
      }

      const bindModel = createBindModel(
        publicInstance as any,
        state as any,
        computedRefs,
        computedSetters,
      )

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
            // 卸载阶段忽略 stop 抛错，确保其余清理继续
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
        snapshot: () => scheduler.snapshot(),
        unmount,
        __wevu_touchSetupMethodsVersion: touchSetupMethodsVersion,
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
        throw new TypeError('插件必须是函数，或包含 install 方法的对象')
      }
      return runtimeApp
    },
    config: appConfig,
  }

  const hasGlobalApp = typeof App === 'function'
  if (hasGlobalApp) {
    const globalRuntime = typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, any>)
      : undefined
    const globalObject = typeof wx !== 'undefined'
      ? wx as unknown as Record<string, any>
      : (globalRuntime?.my as Record<string, any> | undefined)
    const hasWxConfig = typeof globalObject?.__wxConfig !== 'undefined'
    const appRegisterKey = '__wevuAppRegistered'
    const hasRegistered = hasWxConfig && globalObject
      ? Boolean(globalObject[appRegisterKey])
      : false
    // 开发者工具/HMR 可能重复执行入口，避免多次 App() 导致 AppService 事件监听累积。
    if (!hasRegistered) {
      if (hasWxConfig && globalObject) {
        globalObject[appRegisterKey] = true
      }
      // 若检测到全局 App 构造器则自动注册小程序 App
      registerApp<D, C, M>(runtimeApp, (methods ?? {}) as any, appWatch as any, appSetup as any, mpOptions as any)
    }
  }

  return runtimeApp
}
