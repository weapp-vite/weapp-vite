import type { ComputedRef, MutationRecord, WatchOptions, WatchStopHandle, WritableComputedOptions } from '../reactivity'
import type {
  AppConfig,
  ComponentPublicInstance,
  ComputedDefinitions,
  CreateAppOptions,
  ExtractComputed,
  ExtractMethods,
  MethodDefinitions,
  MiniProgramAdapter,
  RuntimeApp,
  RuntimeInstance,
  WevuPlugin,
} from './types'
import { addMutationRecorder, effect, isReactive, isRef, prelinkReactiveTree, reactive, removeMutationRecorder, stop, toRaw, touchReactive, watch } from '../reactivity'
import { track, trigger } from '../reactivity/core'
import { queueJob } from '../scheduler'
import { createBindModel } from './bindModel'
import { diffSnapshots, toPlain } from './diff'
import { setComputedValue } from './internal'
import { registerApp } from './register'

export function createApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: CreateAppOptions<D, C, M>,
): RuntimeApp<D, C, M> {
  const {
    data,
    computed: computedOptions,
    methods,
    setData: setDataOptions,
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
      const state = reactive(rawState)
      const computedDefs = resolvedComputed
      const methodDefs = resolvedMethods

      const computedRefs: Record<string, ComputedRef<any>> = Object.create(null)
      const computedSetters: Record<string, (value: any) => void> = Object.create(null)
      const boundMethods = {} as ExtractMethods<M>
      let mounted = true
      let latestSnapshot: Record<string, any> = {}
      const stopHandles: WatchStopHandle[] = []

      const includeComputed = setDataOptions?.includeComputed ?? true
      const setDataStrategy = setDataOptions?.strategy ?? 'diff'
      const maxPatchKeys = typeof setDataOptions?.maxPatchKeys === 'number'
        ? Math.max(0, setDataOptions!.maxPatchKeys!)
        : Number.POSITIVE_INFINITY
      const maxPayloadBytes = typeof setDataOptions?.maxPayloadBytes === 'number'
        ? Math.max(0, setDataOptions!.maxPayloadBytes!)
        : Number.POSITIVE_INFINITY
      const mergeSiblingThreshold = typeof setDataOptions?.mergeSiblingThreshold === 'number'
        ? Math.max(2, Math.floor(setDataOptions!.mergeSiblingThreshold!))
        : 0
      const pickSet = Array.isArray(setDataOptions?.pick) && setDataOptions!.pick!.length > 0
        ? new Set(setDataOptions!.pick)
        : undefined
      const omitSet = Array.isArray(setDataOptions?.omit) && setDataOptions!.omit!.length > 0
        ? new Set(setDataOptions!.omit)
        : undefined
      const shouldIncludeKey = (key: string) => {
        if (pickSet && !pickSet.has(key)) {
          return false
        }
        if (omitSet && omitSet.has(key)) {
          return false
        }
        return true
      }

      const dirtyComputedKeys = new Set<string>()
      const createTrackedComputed = <T>(
        key: string,
        getter: () => T,
        setter?: (value: T) => void,
      ): ComputedRef<T> => {
        let value: T
        let dirty = true
        let runner!: () => T
        const obj: any = {
          get value() {
            if (dirty) {
              value = runner()
              dirty = false
            }
            track(obj, 'value')
            return value
          },
          set value(nextValue: T) {
            if (!setter) {
              throw new Error('Computed value is readonly')
            }
            setter(nextValue)
          },
        }
        runner = effect(getter, {
          lazy: true,
          scheduler: () => {
            if (!dirty) {
              dirty = true
              if (setDataStrategy === 'patch' && includeComputed) {
                dirtyComputedKeys.add(key)
              }
              trigger(obj, 'value')
            }
          },
        })
        return obj as ComputedRef<T>
      }

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
            if ((computedRefs as any)[key]) {
              return (computedRefs as any)[key].value
            }
            if (Object.prototype.hasOwnProperty.call(appConfig.globalProperties, key)) {
              return (appConfig.globalProperties as any)[key]
            }
          }
          return Reflect.get(target, key, receiver)
        },
        set(target, key, value, receiver) {
          if (typeof key === 'string' && (computedRefs as any)[key]) {
            setComputedValue(computedSetters, key, value)
            return true
          }
          return Reflect.set(target, key, value, receiver)
        },
        has(target, key) {
          if (typeof key === 'string' && ((computedRefs as any)[key] || Object.prototype.hasOwnProperty.call(boundMethods, key))) {
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
            if ((computedRefs as any)[key]) {
              return {
                configurable: true,
                enumerable: true,
                get() {
                  return (computedRefs as any)[key].value
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
        const handler = (methodDefs as any)[key]
        if (typeof handler === 'function') {
          ;(boundMethods as any)[key] = (...args: any[]) => handler.apply(publicInstance, args)
        }
      })

      Object.keys(computedDefs).forEach((key) => {
        const definition = (computedDefs as any)[key] as ((this: any) => any) | WritableComputedOptions<any>
        if (typeof definition === 'function') {
          computedRefs[key] = createTrackedComputed(key, () => (definition as any).call(publicInstance))
        }
        else {
          const getter = definition.get?.bind(publicInstance)
          if (!getter) {
            throw new Error(`Computed property "${key}" requires a getter`)
          }
          const setter = definition.set?.bind(publicInstance)
          if (setter) {
            computedSetters[key] = setter
            computedRefs[key] = createTrackedComputed(key, getter, setter)
          }
          else {
            computedRefs[key] = createTrackedComputed(key, getter)
          }
        }
      })

      const currentAdapter = adapter ?? { setData: () => {} }

      const normalizeSetDataValue = <T>(value: T): T | null => (value === undefined ? null : value)

      const applySnapshotUpdate = (snapshot: Record<string, any>, path: string, value: any, op: 'set' | 'delete') => {
        const segments = path.split('.').filter(Boolean)
        if (!segments.length) {
          return
        }
        let current: any = snapshot
        for (let i = 0; i < segments.length - 1; i++) {
          const key = segments[i]
          if (!Object.prototype.hasOwnProperty.call(current, key) || current[key] == null || typeof current[key] !== 'object') {
            current[key] = Object.create(null)
          }
          current = current[key]
        }
        const leaf = segments[segments.length - 1]
        if (op === 'delete') {
          try {
            delete current[leaf]
          }
          catch {
            current[leaf] = null
          }
        }
        else {
          current[leaf] = value
        }
      }

      const collectSnapshot = (): Record<string, any> => {
        const seen = new WeakMap<object, any>()
        const out: Record<string, any> = Object.create(null)

        const rawState = (isReactive(state) ? toRaw(state as any) : state) as Record<string, any>
        const stateKeys = Object.keys(rawState)
        const computedKeys = includeComputed ? Object.keys(computedRefs) : []

        for (const key of stateKeys) {
          if (!shouldIncludeKey(key)) {
            continue
          }
          out[key] = toPlain(rawState[key], seen)
        }

        for (const key of computedKeys) {
          if (!shouldIncludeKey(key)) {
            continue
          }
          out[key] = toPlain(computedRefs[key].value, seen)
        }

        return out
      }

      let needsFullSnapshot = setDataStrategy === 'patch'
      const pendingPatches = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>()
      const stateRootRaw = toRaw(state as any) as object
      const mutationRecorder = (record: MutationRecord) => {
        if (!mounted) {
          return
        }
        if (record.root !== stateRootRaw) {
          return
        }
        if (!record.path) {
          needsFullSnapshot = true
          return
        }
        const topKey = record.path.split('.', 1)[0]
        if (!shouldIncludeKey(topKey)) {
          return
        }
        pendingPatches.set(record.path, { kind: record.kind, op: record.op })
      }

      let latestComputedSnapshot: Record<string, any> = Object.create(null)

      const runDiffUpdate = () => {
        const snapshot = collectSnapshot()
        const diff = diffSnapshots(latestSnapshot, snapshot)
        latestSnapshot = snapshot
        needsFullSnapshot = false
        pendingPatches.clear()
        if (setDataStrategy === 'patch' && includeComputed) {
          latestComputedSnapshot = Object.create(null)
          for (const key of Object.keys(computedRefs)) {
            if (!shouldIncludeKey(key)) {
              continue
            }
            latestComputedSnapshot[key] = snapshot[key]
          }
          dirtyComputedKeys.clear()
        }
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

      let tracker: ReturnType<typeof effect> | undefined

      const job = () => {
        if (!mounted) {
          return
        }
        // 生成快照前刷新依赖（setup 中的 ref / 新增 key）
        tracker?.()
        // 若存在 beforeUpdate 钩子则调用；需要访问内部实例，完整桥接位于 register.ts

        if (setDataStrategy === 'patch' && !needsFullSnapshot) {
          if (pendingPatches.size > maxPatchKeys) {
            needsFullSnapshot = true
            pendingPatches.clear()
            dirtyComputedKeys.clear()
            runDiffUpdate()
            return
          }
          const seen = new WeakMap<object, any>()
          const payload: Record<string, any> = Object.create(null)
          const patchEntries = Array.from(pendingPatches.entries())
          const entryMap = new Map(patchEntries)
          pendingPatches.clear()
          for (const [path, entry] of patchEntries) {
            const effectiveOp = entry.kind === 'array' ? 'set' : entry.op
            if (effectiveOp === 'delete') {
              payload[path] = null
              continue
            }
            const segments = path.split('.')
            let current: any = state as any
            for (const seg of segments) {
              if (current == null) {
                break
              }
              current = current[seg]
            }
            payload[path] = normalizeSetDataValue(toPlain(current, seen))
          }

          if (includeComputed && dirtyComputedKeys.size) {
            const computedPatch: Record<string, any> = Object.create(null)
            const keys = Array.from(dirtyComputedKeys)
            dirtyComputedKeys.clear()
            for (const key of keys) {
              if (!shouldIncludeKey(key)) {
                continue
              }
              const nextValue = toPlain(computedRefs[key].value, seen)
              const prevValue = latestComputedSnapshot[key]
              const nextDiff = diffSnapshots({ [key]: prevValue }, { [key]: nextValue })
              Object.assign(computedPatch, nextDiff)
              latestComputedSnapshot[key] = nextValue
            }
            Object.assign(payload, computedPatch)
          }

          const collapsePayload = (input: Record<string, any>) => {
            const keys = Object.keys(input)
            if (keys.length <= 1) {
              return input
            }
            const keySet = new Set(keys)
            const out: Record<string, any> = Object.create(null)
            for (const key of keys) {
              const segments = key.split('.').filter(Boolean)
              let hasAncestor = false
              for (let i = segments.length - 1; i >= 1; i--) {
                const parent = segments.slice(0, i).join('.')
                if (keySet.has(parent)) {
                  hasAncestor = true
                  break
                }
              }
              if (!hasAncestor) {
                out[key] = input[key]
              }
            }
            return out
          }

          const mergeSiblingPayload = (
            input: Record<string, any>,
          ) => {
            if (!mergeSiblingThreshold) {
              return input
            }

            const keys = Object.keys(input)
            if (keys.length < mergeSiblingThreshold) {
              return input
            }

            const groups = new Map<string, string[]>()
            const hasDelete = new Set<string>()

            for (const key of keys) {
              const entry = entryMap.get(key)
              if (!entry) {
                continue
              }
              if (input[key] === null || entry.op === 'delete') {
                const dot = key.lastIndexOf('.')
                if (dot > 0) {
                  hasDelete.add(key.slice(0, dot))
                }
                continue
              }
              const dot = key.lastIndexOf('.')
              if (dot <= 0) {
                continue
              }
              const parent = key.slice(0, dot)
              const list = groups.get(parent) ?? []
              list.push(key)
              groups.set(parent, list)
            }

            const parents = Array.from(groups.entries())
              .filter(([parent, list]) => list.length >= mergeSiblingThreshold && !hasDelete.has(parent))
              .sort((a, b) => b[0].split('.').length - a[0].split('.').length)

            if (!parents.length) {
              return input
            }

            const out: Record<string, any> = Object.create(null)
            Object.assign(out, input)

            const getFromStateByPath = (path: string) => {
              const segments = path.split('.').filter(Boolean)
              let current: any = state as any
              for (const seg of segments) {
                if (current == null) {
                  return current
                }
                current = current[seg]
              }
              return current
            }

            for (const [parent, list] of parents) {
              if (Object.prototype.hasOwnProperty.call(out, parent)) {
                continue
              }
              const existingChildren = list.filter(k => Object.prototype.hasOwnProperty.call(out, k))
              if (existingChildren.length < mergeSiblingThreshold) {
                continue
              }
              const parentValue = normalizeSetDataValue(toPlain(getFromStateByPath(parent), seen))
              out[parent] = parentValue
              for (const child of existingChildren) {
                delete out[child]
              }
            }

            return out
          }

          let collapsedPayload = collapsePayload(payload)
          if (mergeSiblingThreshold) {
            collapsedPayload = collapsePayload(mergeSiblingPayload(collapsedPayload))
          }
          if (maxPayloadBytes !== Number.POSITIVE_INFINITY) {
            try {
              const bytes = JSON.stringify(collapsedPayload).length
              if (bytes > maxPayloadBytes) {
                needsFullSnapshot = true
                pendingPatches.clear()
                dirtyComputedKeys.clear()
                runDiffUpdate()
                return
              }
            }
            catch {
              // 若 stringify 失败（例如循环引用），忽略该阈值降级
            }
          }
          if (!Object.keys(collapsedPayload).length) {
            return
          }

          // 维护已下发快照，便于 patch 模式回退 diff。
          for (const [path, value] of Object.entries(collapsedPayload)) {
            const entry = entryMap.get(path)
            if (entry) {
              applySnapshotUpdate(latestSnapshot, path, value, entry.kind === 'array' ? 'set' : entry.op)
            }
            else {
              // computed / 其他由 diffSnapshots 生成的顶层 key
              applySnapshotUpdate(latestSnapshot, path, value, 'set')
            }
          }

          if (typeof currentAdapter.setData === 'function') {
            const result = currentAdapter.setData(collapsedPayload)
            if (result && typeof (result as Promise<any>).then === 'function') {
              (result as Promise<any>).catch(() => {})
            }
          }
        }
        else {
          runDiffUpdate()
        }

        // 若存在 afterUpdate 钩子则调用，同样由 register.ts 负责最终桥接
      }

      tracker = effect(
        () => {
          // 通过根版本信号跟踪任意状态变化
          touchReactive(state as any)
          // setup 返回的 ref/computedRef 变更不会提升 reactive 根版本：
          // 这里额外读取其 `.value` 以建立依赖，从而触发 diff + setData 更新。
          Object.keys(state as any).forEach((key) => {
            const v = (state as any)[key]
            if (isRef(v)) {
              void v.value
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

      stopHandles.push(() => stop(tracker))
      if (setDataStrategy === 'patch') {
        prelinkReactiveTree(state as any, { shouldIncludeTopKey: shouldIncludeKey })
        addMutationRecorder(mutationRecorder)
        stopHandles.push(() => removeMutationRecorder(mutationRecorder))
      }

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
            // teardown 阶段忽略 stop 抛错，确保其余清理继续
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
        snapshot: () => (setDataStrategy === 'patch' ? collectSnapshot() : ({ ...latestSnapshot })),
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

  const hasGlobalApp = typeof (globalThis as any).App === 'function'
  if (hasGlobalApp) {
    // 若检测到全局 App 构造器则自动注册小程序 App
    registerApp<D, C, M>(runtimeApp, (methods ?? {}) as any, appWatch as any, appSetup as any, mpOptions as any)
  }

  return runtimeApp
}
