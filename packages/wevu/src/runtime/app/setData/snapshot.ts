import { isReactive, toRaw } from '../../../reactivity'
import { toPlain } from '../../diff'

export function normalizeSetDataValue<T>(value: T): T | null {
  return value === undefined ? null : value
}

export function cloneSnapshotValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneSnapshotValue(item)) as T
  }
  if (!isPlainObjectLike(value)) {
    return value
  }
  // 这里的快照对象会继续进入 setData / WXML / DevTools 热重载链路。
  // 不能使用 Object.create(null)，否则微信运行时内部直接调用 hasOwnProperty 时会报错。
  const out: Record<string, any> = {}
  for (const key of Object.keys(value as Record<string, any>)) {
    out[key] = cloneSnapshotValue((value as Record<string, any>)[key])
  }
  return out as T
}

export function isPlainObjectLike(value: any) {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isShallowEqualValue(a: any, b: any): boolean {
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
  if (!isPlainObjectLike(a) || !isPlainObjectLike(b)) {
    return false
  }
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const k of aKeys) {
    if (!Object.hasOwn(b, k)) {
      return false
    }
    if (!Object.is(a[k], b[k])) {
      return false
    }
  }
  return true
}

export function isDeepEqualValue(
  a: any,
  b: any,
  depth: number,
  budget: { keys: number },
): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (depth <= 0) {
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
    if (!Object.hasOwn(b, k)) {
      return false
    }
    if (!isDeepEqualValue(a[k], b[k], depth - 1, budget)) {
      return false
    }
  }
  return true
}

export function applySnapshotUpdate(
  snapshot: Record<string, any>,
  path: string,
  value: any,
  op: 'set' | 'delete',
) {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) {
    return
  }
  let current: any = snapshot
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]
    if (!Object.hasOwn(current, key) || current[key] == null || typeof current[key] !== 'object') {
      // 中间节点同样会被同步到最新快照并可能参与视图层更新，必须保持普通对象原型。
      current[key] = {}
    }
    current = current[key]
  }
  const leaf = segments.at(-1)!
  if (op === 'delete') {
    try {
      delete current[leaf]
    }
    catch {
      current[leaf] = null
    }
  }
  else {
    current[leaf] = cloneSnapshotValue(value)
  }
}

export function collectSnapshot(options: {
  state: Record<string, any>
  computedRefs: Record<string, { value: any }>
  includeComputed: boolean
  shouldIncludeKey: (key: string) => boolean
  plainCache: WeakMap<object, { version: number, value: any }>
  toPlainMaxDepth: number
  toPlainMaxKeys: number
}) {
  const {
    state,
    computedRefs,
    includeComputed,
    shouldIncludeKey,
    plainCache,
    toPlainMaxDepth,
    toPlainMaxKeys,
  } = options
  const seen = new WeakMap<object, any>()
  // collectSnapshot 的返回值会被 owner snapshot / patch scheduler 复用。
  // 后续维护不要改回 null-prototype 对象，否则热重载下会再次触发 hasOwnProperty 兼容问题。
  const out: Record<string, any> = {}
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
