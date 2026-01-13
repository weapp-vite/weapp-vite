import { isReactive, toRaw } from '../../../reactivity'
import { toPlain } from '../../diff'

export function normalizeSetDataValue<T>(value: T): T | null {
  return value === undefined ? null : value
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
    if (!Object.prototype.hasOwnProperty.call(b, k)) {
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
    if (!Object.prototype.hasOwnProperty.call(b, k)) {
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
