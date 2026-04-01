import type { MutationRecord, WatchOptions, WatchStopHandle } from '../../reactivity'
import type {
  AppConfig,
  ComputedDefinitions,
  CreateAppOptions,
  ExtractComputed,
  MethodDefinitions,
  MiniProgramAdapter,
  RuntimeInstance,
  SetDataDebugInfo,
} from '../types'
import { addMutationRecorder, effect, isReactive, prelinkReactiveTree, reactive, removeMutationRecorder, shallowReactive, stop, toRaw, touchReactive, watch } from '../../reactivity'
import { clearPatchIndices } from '../../reactivity/reactive'
import { queueJob } from '../../scheduler'
import { createBindModel } from '../bindModel'
import { hasTrackableSetupBinding, touchSetupBinding } from '../setupTracking'
import { createRuntimeContext } from './context'
import { createDiagnosticsLogger } from './diagnostics'
import { createSetDataScheduler } from './setData/scheduler'
import { resolveSetDataOptions } from './setDataOptions'

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

type RuntimeInstanceWithSetupMethodsVersion<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = RuntimeInstance<D, C, M> & {
  __wevu_touchSetupMethodsVersion?: () => void
  __wevu_flushSetupSnapshotSync?: () => void
  __wevu_cloneLatestSnapshot?: () => Record<string, any>
  __wevu_trackSetupReactiveKey?: (key: string) => void
}

function resolveDataOption<D extends object>(data: CreateAppOptions<D, any, any>['data']): D {
  if (typeof data === 'function') {
    return data()
  }
  return (data ?? {}) as D
}

export function createRuntimeMount<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  data: CreateAppOptions<D, C, M>['data']
  resolvedComputed: C
  resolvedMethods: M
  appConfig: AppConfig
  setDataOptions: CreateAppOptions<D, C, M>['setData']
}) {
  const {
    data,
    resolvedComputed,
    resolvedMethods,
    appConfig,
    setDataOptions,
  } = options

  return (adapter?: MiniProgramAdapter): RuntimeInstance<D, C, M> => {
    const rawState = resolveDataOption(data)
    // 预置 props 容器，确保编译器生成的 this.__wevuProps 回退表达式
    // 在 computed 首次求值阶段即可建立响应式依赖。
    if (rawState && typeof rawState === 'object' && !Object.hasOwn(rawState as object, '__wevuProps')) {
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
    const trackedSetupReactiveKeys = new Set<string>()
    Object.keys(state as any).forEach((key) => {
      const value = (state as any)[key]
      if (hasTrackableSetupBinding(value)) {
        trackedSetupReactiveKeys.add(key)
      }
    })

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
      diagnostics,
      debugWhen,
      debugSampleRate,
      elevateTopKeyThreshold,
      toPlainMaxDepth,
      toPlainMaxKeys,
      shouldIncludeKey,
    } = resolveSetDataOptions(setDataOptions)
    const diagnosticsLogger = createDiagnosticsLogger(diagnostics)
    const mergedDebug = (debug || diagnosticsLogger)
      ? (info: SetDataDebugInfo) => {
          if (typeof debug === 'function') {
            debug(info)
          }
          diagnosticsLogger?.(info)
        }
      : undefined
    const mergedDebugWhen = diagnostics === 'always'
      ? 'always'
      : debugWhen

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
      debug: mergedDebug,
      debugWhen: mergedDebugWhen,
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
        // __wevuProps / __wevuAttrs 是非枚举属性，需显式跟踪，
        // 否则 props/attrs 更新不会触发 setData 调度。
        const runtimeProps = (state as any).__wevuProps
        if (isReactive(runtimeProps)) {
          touchReactive(runtimeProps as any)
        }
        const runtimeAttrs = (state as any).__wevuAttrs
        if (isReactive(runtimeAttrs)) {
          touchReactive(runtimeAttrs as any)
        }
        // 在 setup 返回的 ref/computedRef 变更不会提升 reactive 根版本：
        // 仅跟踪这些明确注册过的键，避免每轮 flush 扫描整份 state。
        trackedSetupReactiveKeys.forEach((key) => {
          const v = (state as any)[key]
          // setup 返回的组合式对象常常是“普通对象 + 内含 refs/reactive”，
          // 这里递归触达内部响应式源，确保异步更新也能继续驱动 setData。
          touchSetupBinding(v)
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

    const runtimeInstance: RuntimeInstance<D, C, M> = {
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
    }

    try {
      Object.defineProperty(runtimeInstance, '__wevu_touchSetupMethodsVersion', {
        value: touchSetupMethodsVersion,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(runtimeInstance as RuntimeInstanceWithSetupMethodsVersion<D, C, M>).__wevu_touchSetupMethodsVersion = touchSetupMethodsVersion
    }

    try {
      Object.defineProperty(runtimeInstance, '__wevu_flushSetupSnapshotSync', {
        value: job,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(runtimeInstance as RuntimeInstanceWithSetupMethodsVersion<D, C, M>).__wevu_flushSetupSnapshotSync = job
    }

    try {
      Object.defineProperty(runtimeInstance, '__wevu_cloneLatestSnapshot', {
        value: scheduler.cloneLatestSnapshot,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(runtimeInstance as RuntimeInstanceWithSetupMethodsVersion<D, C, M>).__wevu_cloneLatestSnapshot = scheduler.cloneLatestSnapshot
    }

    try {
      Object.defineProperty(runtimeInstance, '__wevu_trackSetupReactiveKey', {
        value: (key: string) => {
          trackedSetupReactiveKeys.add(key)
        },
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(runtimeInstance as RuntimeInstanceWithSetupMethodsVersion<D, C, M>).__wevu_trackSetupReactiveKey = (key: string) => {
        trackedSetupReactiveKeys.add(key)
      }
    }

    return runtimeInstance
  }
}
