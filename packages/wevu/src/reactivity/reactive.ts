import { track, trigger } from './core'

const reactiveMap = new WeakMap<object, any>()
const rawMap = new WeakMap<any, object>()
// 记录“原始对象 -> 根原始对象”的映射，用于跨层级传播版本号（VERSION_KEY）的变更
const rawRootMap = new WeakMap<object, object>()
// 记录“原始对象”的变更版本号（用于快照序列化缓存）
const rawVersionMap = new WeakMap<object, number>()
// 记录“子原始对象 -> 父原始对象”的映射（仅在路径唯一时存在），用于在变更时回溯路径
const rawParentMap = new WeakMap<object, { parent: object, key: PropertyKey }>()
// 记录“原始对象 -> 所有父引用”（用于判断路径是否唯一）
const rawParentsMap = new WeakMap<object, Map<object, Set<PropertyKey>>>()
// 记录“存在多个父节点引用/多个 key 引用”的对象：路径不唯一时需要回退到全量快照 diff
const rawMultiParentSet = new WeakSet<object>()
// 记录“原始对象 -> base dot path”，用于 patch 模式快速定位（例如 `a.b`；root 为 ''）
const rawPathMap = new WeakMap<object, string>()
// 记录某个 root 下参与 patch 的节点集合（便于在 unmount 时清理 patch 索引）
const rootPatchNodesMap = new WeakMap<object, Set<object>>()

function getRootPatchNodes(root: object) {
  let nodes = rootPatchNodesMap.get(root)
  if (!nodes) {
    nodes = new Set()
    rootPatchNodesMap.set(root, nodes)
  }
  return nodes
}

function indexPatchNode(root: object, node: object) {
  getRootPatchNodes(root).add(node)
}

function bumpRawVersion(target: object) {
  rawVersionMap.set(target, (rawVersionMap.get(target) ?? 0) + 1)
}

export function getReactiveVersion(target: object) {
  const raw = toRaw(target as any) as object
  return rawVersionMap.get(raw) ?? 0
}

function bumpAncestorVersions(target: object) {
  const visited = new Set<object>()
  const stack: object[] = [target]
  for (let i = 0; i < 2000 && stack.length; i++) {
    const current = stack.pop()!
    const parents = rawParentsMap.get(current)
    if (!parents) {
      continue
    }
    for (const parent of parents.keys()) {
      if (visited.has(parent)) {
        continue
      }
      visited.add(parent)
      bumpRawVersion(parent)
      stack.push(parent)
    }
  }
}

export type MutationOp = 'set' | 'delete'
export type MutationKind = 'property' | 'array'
export interface MutationRecord {
  root: object
  kind: MutationKind
  op: MutationOp
  /**
   * dot path（例如 `a.b.c`）；若路径无法可靠解析则为 undefined。
   */
  path?: string
  /**
   * 当路径不唯一/无法可靠解析时，给 patch 模式的“局部回退”提示顶层 key 集合。
   */
  fallbackTopKeys?: string[]
}

type MutationRecorder = (record: MutationRecord) => void
const mutationRecorders = new Set<MutationRecorder>()

export function addMutationRecorder(recorder: MutationRecorder) {
  mutationRecorders.add(recorder)
}

export function removeMutationRecorder(recorder: MutationRecorder) {
  mutationRecorders.delete(recorder)
}

export enum ReactiveFlags {
  IS_REACTIVE = '__r_isReactive',
  RAW = '__r_raw',
  SKIP = '__r_skip', // 标记此对象无需转换为响应式（用于 markRaw）
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

// 版本键（VERSION_KEY）表示“任意字段发生变化”，用于订阅整体版本避免深度遍历跟踪
const VERSION_KEY: unique symbol = Symbol('wevu.version')

function isArrayIndexKey(key: string) {
  if (!key) {
    return false
  }
  const code0 = key.charCodeAt(0)
  if (code0 < 48 || code0 > 57) {
    return false
  }
  const n = Number(key)
  return Number.isInteger(n) && n >= 0 && String(n) === key
}

function recordParentLink(child: object, parent: object, key: PropertyKey) {
  if (typeof key !== 'string') {
    rawMultiParentSet.add(child)
    rawParentMap.delete(child)
    return
  }

  if (mutationRecorders.size) {
    const root = rawRootMap.get(parent) ?? parent
    indexPatchNode(root, parent)
    indexPatchNode(root, child)
  }

  let parents = rawParentsMap.get(child)
  if (!parents) {
    parents = new Map()
    rawParentsMap.set(child, parents)
  }

  let keys = parents.get(parent)
  if (!keys) {
    keys = new Set()
    parents.set(parent, keys)
  }

  keys.add(key)
  refreshPathUniqueness(child)
}

function removeParentLink(child: object, parent: object, key: PropertyKey) {
  const parents = rawParentsMap.get(child)
  if (!parents) {
    return
  }
  const keys = parents.get(parent)
  if (!keys) {
    return
  }
  keys.delete(key)
  if (!keys.size) {
    parents.delete(parent)
  }
  if (!parents.size) {
    rawParentsMap.delete(child)
  }
  refreshPathUniqueness(child)
}

function refreshPathUniqueness(child: object) {
  const parents = rawParentsMap.get(child)
  if (!parents) {
    rawMultiParentSet.delete(child)
    rawParentMap.delete(child)
    return
  }

  let uniqueParent: object | undefined
  let uniqueKey: PropertyKey | undefined
  let total = 0
  for (const [parent, keys] of parents) {
    for (const k of keys) {
      total += 1
      if (total > 1) {
        break
      }
      uniqueParent = parent
      uniqueKey = k
    }
    if (total > 1) {
      break
    }
  }

  if (total === 1 && uniqueParent && uniqueKey) {
    rawMultiParentSet.delete(child)
    rawParentMap.set(child, { parent: uniqueParent, key: uniqueKey })
    return
  }

  rawMultiParentSet.add(child)
  rawParentMap.delete(child)
}

function resolvePathToTarget(root: object, target: object): string[] | undefined {
  if (target === root) {
    return []
  }
  if (rawMultiParentSet.has(target)) {
    return undefined
  }
  const segments: string[] = []
  let current: object = target
  for (let i = 0; i < 2000; i++) {
    if (current === root) {
      return segments.reverse()
    }
    if (rawMultiParentSet.has(current)) {
      return undefined
    }
    const info = rawParentMap.get(current)
    if (!info) {
      return undefined
    }
    if (typeof info.key !== 'string') {
      return undefined
    }
    segments.push(info.key)
    current = info.parent
  }
  return undefined
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

export function toRaw<T>(observed: T): T {
  return ((observed as any)?.[ReactiveFlags.RAW] ?? observed) as T
}

export function convertToReactive<T>(value: T): T {
  return isObject(value) ? reactive(value as any) : value
}

export interface PrelinkReactiveTreeOptions {
  shouldIncludeTopKey?: (key: string) => boolean
  maxDepth?: number
  maxKeys?: number
}

export function prelinkReactiveTree(root: object, options?: PrelinkReactiveTreeOptions) {
  const rootRaw = toRaw(root as any) as object
  rawPathMap.set(rootRaw, '')
  indexPatchNode(rootRaw, rootRaw)

  const shouldIncludeTopKey = options?.shouldIncludeTopKey
  const maxDepth = typeof options?.maxDepth === 'number' ? Math.max(0, Math.floor(options!.maxDepth!)) : Number.POSITIVE_INFINITY
  const maxKeys = typeof options?.maxKeys === 'number' ? Math.max(0, Math.floor(options!.maxKeys!)) : Number.POSITIVE_INFINITY

  const visited = new WeakSet<object>()
  const stack: Array<{ current: object, path: string, depth: number }> = [{ current: rootRaw, path: '', depth: 0 }]
  let indexed = 0

  while (stack.length) {
    const node = stack.pop()!
    if (visited.has(node.current)) {
      continue
    }
    visited.add(node.current)
    rawPathMap.set(node.current, node.path)
    indexPatchNode(rootRaw, node.current)
    indexed += 1
    if (indexed >= maxKeys) {
      continue
    }

    if (node.depth >= maxDepth) {
      continue
    }
    if (Array.isArray(node.current)) {
      // 数组不预先展开子元素：大列表场景避免 O(n) 初始化开销。
      continue
    }

    const entries = Object.entries(node.current as any)
    for (const [key, value] of entries) {
      if (node.path === '' && shouldIncludeTopKey && !shouldIncludeTopKey(key)) {
        continue
      }
      if (!isObject(value)) {
        continue
      }
      if ((value as any)[ReactiveFlags.SKIP]) {
        continue
      }
      const childRaw = toRaw(value as any) as object
      if (!rawRootMap.has(childRaw)) {
        rawRootMap.set(childRaw, rootRaw)
      }
      recordParentLink(childRaw, node.current, key)
      if (!rawMultiParentSet.has(childRaw)) {
        const childPath = node.path ? `${node.path}.${key}` : key
        rawPathMap.set(childRaw, childPath)
      }
      indexPatchNode(rootRaw, childRaw)
      stack.push({ current: childRaw, path: node.path ? `${node.path}.${key}` : key, depth: node.depth + 1 })
    }
  }
}

export function clearPatchIndices(root: object) {
  const rootRaw = toRaw(root as any) as object
  const nodes = rootPatchNodesMap.get(rootRaw)
  if (!nodes) {
    rawPathMap.delete(rootRaw)
    return
  }

  for (const node of nodes) {
    rawParentMap.delete(node)
    rawParentsMap.delete(node)
    rawPathMap.delete(node)
    rawMultiParentSet.delete(node)
    rawRootMap.delete(node)
    rawVersionMap.delete(node)
  }

  rootPatchNodesMap.delete(rootRaw)
}

/**
 * 让 effect 订阅整个对象的“版本号”，无需深度遍历即可对任何字段变化做出响应。
 */
export function touchReactive(target: object) {
  const raw = toRaw(target as any) as object
  track(raw, VERSION_KEY)
}

// ============================================================================
// 浅层响应式处理
// ============================================================================

const shallowReactiveMap = new WeakMap<object, any>()

const shallowHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }
    if (key === ReactiveFlags.RAW) {
      return target
    }
    const res = Reflect.get(target, key, receiver)
    track(target, key)
    // 浅层模式：不对嵌套对象做自动响应式转换
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      trigger(target, key)
      // 浅层同样维护通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      trigger(target, key)
      // 删除时也同步通用版本号
      trigger(target, VERSION_KEY)
      bumpRawVersion(target)
    }
    return result
  },
  ownKeys(target) {
    track(target, Symbol.iterator)
    // 遍历时订阅通用版本号
    track(target, VERSION_KEY)
    return Reflect.ownKeys(target)
  },
}

/**
 * 创建一个浅层响应式代理：仅跟踪第一层属性变更，不深度递归嵌套对象。
 *
 * @param target 待转换的对象
 * @returns 浅层响应式代理
 *
 * @example
 * ```ts
 * const state = shallowReactive({ nested: { count: 0 } })
 *
 * state.nested.count++ // 不会触发 effect（嵌套对象未深度代理）
 * state.nested = { count: 1 } // 会触发 effect（顶层属性变更）
 * ```
 */
export function shallowReactive<T extends object>(target: T): T {
  if (!isObject(target)) {
    return target
  }
  const existingProxy = shallowReactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
    return target
  }
  const proxy = new Proxy(target, shallowHandlers)
  shallowReactiveMap.set(target, proxy)
  rawMap.set(proxy, target)
  if (!rawVersionMap.has(target)) {
    rawVersionMap.set(target, 0)
  }
  // 浅层响应式不初始化根映射，避免误导深度版本追踪
  return proxy
}

/**
 * 判断一个值是否为 shallowReactive 创建的浅层响应式对象
 */
export function isShallowReactive(value: unknown): boolean {
  const raw = toRaw(value as any)
  return shallowReactiveMap.has(raw)
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
