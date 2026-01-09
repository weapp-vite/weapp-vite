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
  SetDataDebugInfo,
  WevuPlugin,
} from './types'
import { addMutationRecorder, effect, isReactive, isRef, prelinkReactiveTree, reactive, removeMutationRecorder, stop, toRaw, touchReactive, watch } from '../reactivity'
import { track, trigger } from '../reactivity/core'
import { clearPatchIndices } from '../reactivity/reactive'
import { markAsRef } from '../reactivity/ref'
import { queueJob } from '../scheduler'
import { createBindModel } from './bindModel'
import { applyWevuAppDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { diffSnapshots, toPlain } from './diff'
import { setComputedValue } from './internal'
import { registerApp } from './register'

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
      const mergeSiblingMaxInflationRatio = typeof setDataOptions?.mergeSiblingMaxInflationRatio === 'number'
        ? Math.max(0, setDataOptions!.mergeSiblingMaxInflationRatio!)
        : 1.25
      const mergeSiblingMaxParentBytes = typeof setDataOptions?.mergeSiblingMaxParentBytes === 'number'
        ? Math.max(0, setDataOptions!.mergeSiblingMaxParentBytes!)
        : Number.POSITIVE_INFINITY
      const mergeSiblingSkipArray = setDataOptions?.mergeSiblingSkipArray ?? true
      const computedCompare = setDataOptions?.computedCompare ?? (setDataStrategy === 'patch' ? 'deep' : 'reference')
      const computedCompareMaxDepth = typeof setDataOptions?.computedCompareMaxDepth === 'number'
        ? Math.max(0, Math.floor(setDataOptions!.computedCompareMaxDepth!))
        : 4
      const computedCompareMaxKeys = typeof setDataOptions?.computedCompareMaxKeys === 'number'
        ? Math.max(0, Math.floor(setDataOptions!.computedCompareMaxKeys!))
        : 200
      const prelinkMaxDepth = setDataOptions?.prelinkMaxDepth
      const prelinkMaxKeys = setDataOptions?.prelinkMaxKeys
      const debug = setDataOptions?.debug
      const debugWhen = setDataOptions?.debugWhen ?? 'fallback'
      const debugSampleRate = typeof setDataOptions?.debugSampleRate === 'number'
        ? Math.min(1, Math.max(0, setDataOptions!.debugSampleRate!))
        : 1
      const elevateTopKeyThreshold = typeof setDataOptions?.elevateTopKeyThreshold === 'number'
        ? Math.max(0, Math.floor(setDataOptions!.elevateTopKeyThreshold!))
        : Number.POSITIVE_INFINITY
      const toPlainMaxDepth = typeof setDataOptions?.toPlainMaxDepth === 'number'
        ? Math.max(0, Math.floor(setDataOptions!.toPlainMaxDepth!))
        : Number.POSITIVE_INFINITY
      const toPlainMaxKeys = typeof setDataOptions?.toPlainMaxKeys === 'number'
        ? Math.max(0, Math.floor(setDataOptions!.toPlainMaxKeys!))
        : Number.POSITIVE_INFINITY
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
        markAsRef(obj)
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
      const plainCache = new WeakMap<object, { version: number, value: any }>()

      const normalizeSetDataValue = <T>(value: T): T | null => (value === undefined ? null : value)

      const isPlainObjectLike = (value: any) => {
        if (value == null || typeof value !== 'object') {
          return false
        }
        const proto = Object.getPrototypeOf(value)
        return proto === Object.prototype || proto === null
      }

      const isShallowEqualValue = (a: any, b: any): boolean => {
        if (Object.is(a, b)) {
          return true
        }
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) {
            return false
          }
          for (let i = 0; i < a.length; i++) {
            if (!Object.is(a[i], b[i])) {
              return false
            }
          }
          return true
        }
        if (isPlainObjectLike(a) && isPlainObjectLike(b)) {
          const aKeys = Object.keys(a)
          const bKeys = Object.keys(b)
          if (aKeys.length !== bKeys.length) {
            return false
          }
          for (const k of aKeys) {
            if (!Object.prototype.hasOwnProperty.call(b, k)) {
              return false
            }
            if (!Object.is(a[k], b[k])) {
              return false
            }
          }
          return true
        }
        return false
      }

      const isDeepEqualValue = (
        a: any,
        b: any,
        depth: number,
        budget: { keys: number },
      ): boolean => {
        if (Object.is(a, b)) {
          return true
        }
        if (depth <= 0 || budget.keys <= 0) {
          return false
        }
        if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
          return false
        }
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) {
            return false
          }
          for (let i = 0; i < a.length; i++) {
            if (!isDeepEqualValue(a[i], b[i], depth - 1, budget)) {
              return false
            }
          }
          return true
        }
        if (!isPlainObjectLike(a) || !isPlainObjectLike(b)) {
          return false
        }
        const aKeys = Object.keys(a)
        const bKeys = Object.keys(b)
        if (aKeys.length !== bKeys.length) {
          return false
        }
        for (const k of aKeys) {
          budget.keys -= 1
          if (budget.keys <= 0) {
            return false
          }
          if (!Object.prototype.hasOwnProperty.call(b, k)) {
            return false
          }
          if (!isDeepEqualValue(a[k], b[k], depth - 1, budget)) {
            return false
          }
        }
        return true
      }

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
        const budget = Number.isFinite(toPlainMaxKeys) ? { keys: toPlainMaxKeys } : undefined

        const rawState = (isReactive(state) ? toRaw(state as any) : state) as Record<string, any>
        const stateKeys = Object.keys(rawState)
        const computedKeys = includeComputed ? Object.keys(computedRefs) : []

        for (const key of stateKeys) {
          if (!shouldIncludeKey(key)) {
            continue
          }
          out[key] = toPlain(rawState[key], seen, { cache: plainCache, maxDepth: toPlainMaxDepth, _budget: budget })
        }

        for (const key of computedKeys) {
          if (!shouldIncludeKey(key)) {
            continue
          }
          out[key] = toPlain(computedRefs[key].value, seen, { cache: plainCache, maxDepth: toPlainMaxDepth, _budget: budget })
        }

        return out
      }

      let needsFullSnapshot = setDataStrategy === 'patch'
      const pendingPatches = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>()
      const stateRootRaw = toRaw(state as any) as object
      const fallbackTopKeys = new Set<string>()
      const mutationRecorder = (record: MutationRecord) => {
        if (!mounted) {
          return
        }
        if (record.root !== stateRootRaw) {
          return
        }
        if (!record.path) {
          if (Array.isArray(record.fallbackTopKeys) && record.fallbackTopKeys.length) {
            for (const key of record.fallbackTopKeys) {
              fallbackTopKeys.add(key)
            }
          }
          else {
            needsFullSnapshot = true
          }
          return
        }
        const topKey = record.path.split('.', 1)[0]
        if (!shouldIncludeKey(topKey)) {
          return
        }
        pendingPatches.set(record.path, { kind: record.kind, op: record.op })
      }

      let latestComputedSnapshot: Record<string, any> = Object.create(null)

      const emitDebug = (info: SetDataDebugInfo) => {
        if (!debug) {
          return
        }
        const isFallback = info.reason !== 'patch' && info.reason !== 'diff'
        if (debugWhen === 'fallback' && !isFallback) {
          return
        }
        if (debugSampleRate < 1 && Math.random() > debugSampleRate) {
          return
        }
        try {
          debug(info)
        }
        catch {
          // 忽略异常
        }
      }

      const runDiffUpdate = (reason: SetDataDebugInfo['reason'] = 'diff') => {
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
        emitDebug({
          mode: 'diff',
          reason,
          pendingPatchKeys: 0,
          payloadKeys: Object.keys(diff).length,
        })
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
            const pendingCount = pendingPatches.size
            pendingPatches.clear()
            dirtyComputedKeys.clear()
            emitDebug({
              mode: 'diff',
              reason: 'maxPatchKeys',
              pendingPatchKeys: pendingCount,
              payloadKeys: 0,
            })
            runDiffUpdate('maxPatchKeys')
            return
          }
          const seen = new WeakMap<object, any>()
          const plainByPath = new Map<string, any>()
          const payload: Record<string, any> = Object.create(null)
          const patchEntriesRaw = Array.from(pendingPatches.entries())
          if (Number.isFinite(elevateTopKeyThreshold) && elevateTopKeyThreshold > 0) {
            const counts = new Map<string, number>()
            for (const [path] of patchEntriesRaw) {
              const top = path.split('.', 1)[0]
              counts.set(top, (counts.get(top) ?? 0) + 1)
            }
            for (const [top, count] of counts) {
              if (count >= elevateTopKeyThreshold) {
                fallbackTopKeys.add(top)
              }
            }
          }
          const patchEntries = patchEntriesRaw.filter(([path]) => {
            for (const topKey of fallbackTopKeys) {
              if (path === topKey || path.startsWith(`${topKey}.`)) {
                return false
              }
            }
            return true
          })
          const entryMap = new Map(patchEntries)
          pendingPatches.clear()

          const getStateValueByPath = (path: string) => {
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

          const getPlainByPath = (path: string) => {
            if (plainByPath.has(path)) {
              return plainByPath.get(path)
            }
            const value = normalizeSetDataValue(toPlain(getStateValueByPath(path), seen, { cache: plainCache, maxDepth: toPlainMaxDepth, maxKeys: toPlainMaxKeys }))
            plainByPath.set(path, value)
            return value
          }

          if (fallbackTopKeys.size) {
            for (const topKey of fallbackTopKeys) {
              if (!shouldIncludeKey(topKey)) {
                continue
              }
              payload[topKey] = getPlainByPath(topKey)
              entryMap.set(topKey, { kind: 'property', op: 'set' })
            }
            fallbackTopKeys.clear()
          }

          for (const [path, entry] of patchEntries) {
            const effectiveOp = entry.kind === 'array' ? 'set' : entry.op
            if (effectiveOp === 'delete') {
              payload[path] = null
              continue
            }
            payload[path] = getPlainByPath(path)
          }

          let computedDirtyProcessed = 0
          if (includeComputed && dirtyComputedKeys.size) {
            const computedPatch: Record<string, any> = Object.create(null)
            const keys = Array.from(dirtyComputedKeys)
            dirtyComputedKeys.clear()
            computedDirtyProcessed = keys.length
            for (const key of keys) {
              if (!shouldIncludeKey(key)) {
                continue
              }
              const nextValue = toPlain(computedRefs[key].value, seen, { cache: plainCache, maxDepth: toPlainMaxDepth, maxKeys: toPlainMaxKeys })
              const prevValue = latestComputedSnapshot[key]
              const equal = computedCompare === 'deep'
                ? isDeepEqualValue(prevValue, nextValue, computedCompareMaxDepth, { keys: computedCompareMaxKeys })
                : computedCompare === 'shallow'
                  ? isShallowEqualValue(prevValue, nextValue)
                  : Object.is(prevValue, nextValue)
              if (equal) {
                continue
              }
              computedPatch[key] = normalizeSetDataValue(nextValue)
              latestComputedSnapshot[key] = nextValue
            }
            Object.assign(payload, computedPatch)
          }

          const collapsePayload = (input: Record<string, any>) => {
            const keys = Object.keys(input).sort()
            if (keys.length <= 1) {
              return input
            }
            const out: Record<string, any> = Object.create(null)
            const prefixStack: string[] = []
            for (const key of keys) {
              while (prefixStack.length) {
                const prefix = prefixStack[prefixStack.length - 1]
                if (key.startsWith(prefix)) {
                  break
                }
                prefixStack.pop()
              }
              if (prefixStack.length) {
                continue
              }
              out[key] = input[key]
              prefixStack.push(`${key}.`)
            }
            return out
          }

          const estimateJsonSize = (
            value: any,
            limit: number,
            seen: WeakSet<object>,
          ): number => {
            if (limit <= 0) {
              return limit + 1
            }
            if (value === null) {
              return 4
            }
            const t = typeof value
            if (t === 'string') {
              // 粗略估算：未计入转义开销；后续会在接近阈值时用 stringify 校验
              return 2 + value.length
            }
            if (t === 'number') {
              return Number.isFinite(value) ? String(value).length : 4 // 空值占位
            }
            if (t === 'boolean') {
              return value ? 4 : 5
            }
            if (t === 'undefined' || t === 'function' || t === 'symbol') {
              return 4 // 空值占位
            }
            if (t !== 'object') {
              return 4
            }

            if (seen.has(value)) {
              return 4
            }
            seen.add(value)

            if (Array.isArray(value)) {
              let size = 2 // []
              for (let i = 0; i < value.length; i++) {
                if (i) {
                  size += 1
                }
                size += estimateJsonSize(value[i], limit - size, seen)
                if (size > limit) {
                  return size
                }
              }
              return size
            }

            let size = 2 // {}
            for (const [k, v] of Object.entries(value)) {
              if (size > 2) {
                size += 1
              }
              // 键名部分：
              size += 2 + k.length + 1
              size += estimateJsonSize(v, limit - size, seen)
              if (size > limit) {
                return size
              }
            }
            return size
          }

          const checkPayloadSize = (payload: Record<string, any>) => {
            if (maxPayloadBytes === Number.POSITIVE_INFINITY) {
              return { fallback: false as const, estimatedBytes: undefined as number | undefined, bytes: undefined as number | undefined }
            }
            const limit = maxPayloadBytes
            const keyCount = Object.keys(payload).length
            const estimated = estimateJsonSize(payload, limit + 1, new WeakSet())
            if (estimated > limit) {
              return { fallback: true as const, estimatedBytes: estimated, bytes: undefined }
            }
            // 接近阈值时再用 stringify 精确判断，避免低估导致未降级
            if (estimated >= limit * 0.85 && keyCount > 2) {
              try {
                const bytes = JSON.stringify(payload).length
                return { fallback: bytes > limit, estimatedBytes: estimated, bytes }
              }
              catch {
                return { fallback: false as const, estimatedBytes: estimated, bytes: undefined }
              }
            }
            return { fallback: false as const, estimatedBytes: estimated, bytes: undefined }
          }

          const mergeSiblingPayload = (
            input: Record<string, any>,
          ): { out: Record<string, any>, merged: number } => {
            if (!mergeSiblingThreshold) {
              return { out: input, merged: 0 }
            }

            const keys = Object.keys(input)
            if (keys.length < mergeSiblingThreshold) {
              return { out: input, merged: 0 }
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
              return { out: input, merged: 0 }
            }

            const out: Record<string, any> = Object.create(null)
            Object.assign(out, input)

            let merged = 0
            const valueSizeCache = new WeakMap<object, number>()
            const estimateValueSize = (value: any) => {
              if (value && typeof value === 'object') {
                const cached = valueSizeCache.get(value as object)
                if (cached !== undefined) {
                  return cached
                }
                const size = estimateJsonSize(value, Number.POSITIVE_INFINITY, new WeakSet())
                valueSizeCache.set(value as object, size)
                return size
              }
              return estimateJsonSize(value, Number.POSITIVE_INFINITY, new WeakSet())
            }
            const estimateEntryBytes = (key: string, value: any) => {
              // 键名部分：
              return (2 + key.length + 1) + estimateValueSize(value)
            }

            for (const [parent, list] of parents) {
              if (Object.prototype.hasOwnProperty.call(out, parent)) {
                continue
              }
              const existingChildren = list.filter(k => Object.prototype.hasOwnProperty.call(out, k))
              if (existingChildren.length < mergeSiblingThreshold) {
                continue
              }
              const parentValue = getPlainByPath(parent)
              if (mergeSiblingSkipArray && Array.isArray(parentValue)) {
                continue
              }
              if (mergeSiblingMaxParentBytes !== Number.POSITIVE_INFINITY) {
                const parentBytes = estimateEntryBytes(parent, parentValue)
                if (parentBytes > mergeSiblingMaxParentBytes) {
                  continue
                }
              }
              if (mergeSiblingMaxInflationRatio !== Number.POSITIVE_INFINITY) {
                let childBytes = 0
                for (const child of existingChildren) {
                  childBytes += estimateEntryBytes(child, out[child])
                }
                const parentBytes = estimateEntryBytes(parent, parentValue)
                if (parentBytes > childBytes * mergeSiblingMaxInflationRatio) {
                  continue
                }
              }
              out[parent] = parentValue
              for (const child of existingChildren) {
                delete out[child]
              }
              merged += 1
            }

            return { out, merged }
          }

          let collapsedPayload = collapsePayload(payload)
          let mergedSiblingParents = 0
          if (mergeSiblingThreshold) {
            const mergedResult = mergeSiblingPayload(collapsedPayload)
            mergedSiblingParents = mergedResult.merged
            collapsedPayload = collapsePayload(mergedResult.out)
          }
          const sizeCheck = checkPayloadSize(collapsedPayload)
          const shouldFallback = sizeCheck.fallback
          emitDebug({
            mode: shouldFallback ? 'diff' : 'patch',
            reason: shouldFallback ? 'maxPayloadBytes' : 'patch',
            pendingPatchKeys: patchEntries.length,
            payloadKeys: Object.keys(collapsedPayload).length,
            mergedSiblingParents: mergedSiblingParents || undefined,
            computedDirtyKeys: computedDirtyProcessed || undefined,
            estimatedBytes: sizeCheck.estimatedBytes,
            bytes: sizeCheck.bytes,
          })
          if (shouldFallback) {
            needsFullSnapshot = true
            pendingPatches.clear()
            dirtyComputedKeys.clear()
            runDiffUpdate('maxPayloadBytes')
            return
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
          emitDebug({
            mode: 'patch',
            reason: 'patch',
            pendingPatchKeys: patchEntries.length,
            payloadKeys: Object.keys(collapsedPayload).length,
          })
        }
        else {
          runDiffUpdate(needsFullSnapshot ? 'needsFullSnapshot' : 'diff')
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
        prelinkReactiveTree(state as any, { shouldIncludeTopKey: shouldIncludeKey, maxDepth: prelinkMaxDepth, maxKeys: prelinkMaxKeys })
        addMutationRecorder(mutationRecorder)
        stopHandles.push(() => removeMutationRecorder(mutationRecorder))
        stopHandles.push(() => clearPatchIndices(state as any))
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
    const globalObject = globalThis as Record<string, any>
    const hasWxConfig = typeof globalObject.__wxConfig !== 'undefined'
    const appRegisterKey = '__wevuAppRegistered'
    // Devtools/HMR 可能重复执行入口，避免多次 App() 导致 AppService 事件监听累积。
    if (!hasWxConfig || !globalObject[appRegisterKey]) {
      if (hasWxConfig) {
        globalObject[appRegisterKey] = true
      }
      // 若检测到全局 App 构造器则自动注册小程序 App
      registerApp<D, C, M>(runtimeApp, (methods ?? {}) as any, appWatch as any, appSetup as any, mpOptions as any)
    }
  }

  return runtimeApp
}
