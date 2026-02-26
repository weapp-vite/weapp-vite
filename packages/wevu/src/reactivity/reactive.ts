import type { MutationKind, MutationOp } from './reactive/mutation'
import { track, trigger } from './core'
import { mutationRecorders } from './reactive/mutation'
import {
  bumpAncestorVersions,
  bumpRawVersion,
  getRawVersion,
  rawMultiParentSet,
  rawParentsMap,
  rawPathMap,
  rawRootMap,
  rawVersionMap,
  recordParentLink,
  removeParentLink,
  resolvePathToTarget,
} from './reactive/patchState'
import { isArrayIndexKey, isObject, ReactiveFlags, toRaw, VERSION_KEY } from './reactive/shared'
import { rawMap, reactiveMap } from './reactive/state'

export { addMutationRecorder, removeMutationRecorder } from './reactive/mutation'
export type { MutationKind, MutationOp, MutationRecord } from './reactive/mutation'
export type { PrelinkReactiveTreeOptions } from './reactive/patch'
export { clearPatchIndices, prelinkReactiveTree, touchReactive } from './reactive/patch'
export { isShallowReactive, shallowReactive } from './reactive/shallow'
export { isObject, ReactiveFlags, toRaw } from './reactive/shared'

/**
 * 读取响应式版本号（框架内部调试能力）。
 * @internal
 */
export function getReactiveVersion(target: object) {
  const raw = toRaw(target as any) as object
  return getRawVersion(raw)
}

function emitMutation(target: object, key: PropertyKey, op: MutationOp) {
  if (!mutationRecorders.size) {
    return
  }
  if (typeof key !== 'string') {
    return
  }
  if (key.startsWith('__r_')) {
    return
  }
  const root = rawRootMap.get(target) ?? target
  const isArray = Array.isArray(target)
  const kind: MutationKind = isArray && (key === 'length' || isArrayIndexKey(key)) ? 'array' : 'property'

  const baseSegments = resolvePathToTarget(root, target)
  if (!baseSegments) {
    // 路径不唯一/无法解析：尝试从父引用收集可能的顶层 key，供 patch 模式做“局部回退”。
    const fallback = new Set<string>()
    const parents = rawParentsMap.get(target)
    if (parents) {
      for (const [parent, keys] of parents) {
        const parentPath = rawPathMap.get(parent)
        const topFromParentPath = parentPath ? parentPath.split('.', 1)[0] : undefined
        const topFromResolve = !topFromParentPath
          ? (resolvePathToTarget(root, parent)?.[0] as string | undefined)
          : undefined
        for (const k of keys) {
          if (typeof k !== 'string') {
            continue
          }
          fallback.add(topFromParentPath ?? topFromResolve ?? k)
        }
      }
    }
    else {
      // 若目标就是 root 的直接子属性（未记录 parent link），仍可用 key 作为顶层回退
      fallback.add(key)
    }
    for (const recorder of mutationRecorders) {
      recorder({ root, kind, op, path: undefined, fallbackTopKeys: fallback.size ? Array.from(fallback) : undefined })
    }
    return
  }

  // 若目标位于数组内部（例如 arr[0].x），直接回退到数组本身的路径，保持“数组整体替换”的策略。
  const arrayIndexPos = baseSegments.findIndex(seg => isArrayIndexKey(seg))
  if (arrayIndexPos !== -1) {
    const arrayPath = baseSegments.slice(0, arrayIndexPos).join('.')
    const path = arrayPath || undefined
    for (const recorder of mutationRecorders) {
      recorder({ root, kind: 'array', op, path })
    }
    return
  }

  const basePath = baseSegments.length ? baseSegments.join('.') : ''
  const path = kind === 'array' ? (basePath || undefined) : (basePath ? `${basePath}.${key}` : (key as string))

  for (const recorder of mutationRecorders) {
    recorder({
      root,
      kind,
      op,
      path,
    })
  }
}

const mutableHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    if (key === ReactiveFlags.RAW) {
      return target
    }
    const res = Reflect.get(target, key, receiver)
    track(target, key)
    if (isObject(res)) {
      // 检查返回值是否被 markRaw 标记为跳过响应式
      if ((res as any)[ReactiveFlags.SKIP]) {
        return res
      }
      // 确保子对象的根引用与当前目标一致，便于版本号级联
      const parentRoot = rawRootMap.get(target) ?? target
      const childRaw = ((res as any)?.[ReactiveFlags.RAW] ?? res) as object
      if (!rawRootMap.has(childRaw)) {
        rawRootMap.set(childRaw, parentRoot)
      }
      recordParentLink(childRaw, target, key)
      const parentPath = rawPathMap.get(target)
      if (mutationRecorders.size && typeof key === 'string' && parentPath != null && !rawMultiParentSet.has(childRaw)) {
        const nextPath = parentPath ? `${parentPath}.${key}` : key
        rawPathMap.set(childRaw, nextPath)
      }
      // eslint-disable-next-line ts/no-use-before-define -- 避免递归调用的顺序警告
      return reactive(res)
    }
    return res
  },
  set(target, key, value, receiver) {
    const isArr = Array.isArray(target)
    const oldLength = isArr ? target.length : 0
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      const oldRaw = isObject(oldValue) ? (((oldValue as any)?.[ReactiveFlags.RAW] ?? oldValue) as object) : undefined
      if (oldRaw) {
        removeParentLink(oldRaw, target, key)
      }
      if (isObject(value) && !(value as any)[ReactiveFlags.SKIP]) {
        const root = rawRootMap.get(target) ?? target
        const childRaw = ((value as any)?.[ReactiveFlags.RAW] ?? value) as object
        if (!rawRootMap.has(childRaw)) {
          rawRootMap.set(childRaw, root)
        }
        recordParentLink(childRaw, target, key)
        const parentPath = rawPathMap.get(target)
        if (mutationRecorders.size && typeof key === 'string' && parentPath != null && !rawMultiParentSet.has(childRaw)) {
          const nextPath = parentPath ? `${parentPath}.${key}` : key
          rawPathMap.set(childRaw, nextPath)
        }
      }
      trigger(target, key)
      if (isArr && typeof key === 'string' && isArrayIndexKey(key) && Number(key) >= oldLength) {
        trigger(target, 'length')
      }
      // 任意写操作都提升通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
      bumpAncestorVersions(target)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
        bumpRawVersion(root)
      }
      emitMutation(target, key, 'set')
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const oldValue = hadKey ? (target as any)[key] : undefined
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      const oldRaw = isObject(oldValue) ? (((oldValue as any)?.[ReactiveFlags.RAW] ?? oldValue) as object) : undefined
      if (oldRaw) {
        removeParentLink(oldRaw, target, key)
      }
      trigger(target, key)
      // 删除同样提升通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
      bumpAncestorVersions(target)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
        bumpRawVersion(root)
      }
      emitMutation(target, key, 'delete')
    }
    return result
  },
  ownKeys(target) {
    track(target, Symbol.iterator)
    // 遍历时也订阅通用版本号，确保新增/删除键可触发
    track(target, VERSION_KEY)
    return Reflect.ownKeys(target)
  },
}

export function reactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target
  }
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const proxy = new Proxy(target, mutableHandlers)
  reactiveMap.set(target, proxy)
  rawMap.set(proxy, target)
  if (!rawVersionMap.has(target)) {
    rawVersionMap.set(target, 0)
  }
  // 新的原始对象在被观察时初始化根节点映射
  if (!rawRootMap.has(target)) {
    rawRootMap.set(target, target)
  }
  return proxy
}

export function isReactive(value: unknown): boolean {
  return Boolean(value && (value as any)[ReactiveFlags.IS_REACTIVE])
}

export function convertToReactive<T>(value: T): T {
  return isObject(value) ? reactive(value as any) : value
}

// ============================================================================
// 标记对象跳过响应式转换（markRaw）
// ============================================================================

/**
 * 标记对象为“原始”状态，后续不会被转换为响应式，返回原对象本身。
 *
 * @param value 需要标记的对象
 * @returns 带有跳过标记的原对象
 *
 * @example
 * ```ts
 * const foo = markRaw({
 *   nested: {}
 * })
 *
 * const state = reactive({
 *   foo
 * })
 *
 * state.foo // 不是响应式对象
 * ```
 */
export function markRaw<T extends object>(value: T): T {
  if (!isObject(value)) {
    return value
  }
  Object.defineProperty(value, ReactiveFlags.SKIP, {
    value: true,
    configurable: true,
    enumerable: false,
    writable: true,
  })
  return value
}

/**
 * 判断某个值是否被标记为原始（即不应转换为响应式）。
 *
 * @param value 待检测的值
 * @returns 若含有跳过标记则返回 true
 */
export function isRaw(value: unknown): boolean {
  return isObject(value) && ReactiveFlags.SKIP in (value as object)
}
