import { track, trigger } from './core'

const reactiveMap = new WeakMap<object, any>()
const rawMap = new WeakMap<any, object>()
// 记录“原始对象 -> 根原始对象”的映射，用于跨层级传播版本号（VERSION_KEY）的变更
const rawRootMap = new WeakMap<object, object>()
// 记录“子原始对象 -> 父原始对象”的映射，用于在变更时回溯路径
const rawParentMap = new WeakMap<object, { parent: object, key: PropertyKey }>()
// 记录“存在多个父节点引用”的对象：路径不唯一时需要回退到全量快照 diff
const rawMultiParentSet = new WeakSet<object>()

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

// VERSION_KEY 表示“任意字段发生变化”，用于订阅整体版本避免深度遍历跟踪
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
  const existing = rawParentMap.get(child)
  if (!existing) {
    rawParentMap.set(child, { parent, key })
    return
  }
  if (existing.parent !== parent || existing.key !== key) {
    rawMultiParentSet.add(child)
  }
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
  const basePath = baseSegments && baseSegments.length ? baseSegments.join('.') : undefined
  const path = kind === 'array' ? basePath : (basePath ? `${basePath}.${key}` : key)

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
      // eslint-disable-next-line ts/no-use-before-define
      return reactive(res)
    }
    return res
  },
  set(target, key, value, receiver) {
    const oldValue = Reflect.get(target, key, receiver)
    const result = Reflect.set(target, key, value, receiver)
    if (!Object.is(oldValue, value)) {
      if (isObject(value) && !(value as any)[ReactiveFlags.SKIP]) {
        const root = rawRootMap.get(target) ?? target
        const childRaw = ((value as any)?.[ReactiveFlags.RAW] ?? value) as object
        if (!rawRootMap.has(childRaw)) {
          rawRootMap.set(childRaw, root)
        }
        recordParentLink(childRaw, target, key)
      }
      trigger(target, key)
      // 任意写操作都提升通用版本号
      trigger(target, VERSION_KEY)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
      }
      emitMutation(target, key, 'set')
    }
    return result
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const result = Reflect.deleteProperty(target, key)
    if (hadKey && result) {
      trigger(target, key)
      // 删除同样提升通用版本号
      trigger(target, VERSION_KEY)
      const root = rawRootMap.get(target)
      if (root && root !== target) {
        trigger(root, VERSION_KEY)
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
// markRaw：标记对象跳过响应式转换
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
