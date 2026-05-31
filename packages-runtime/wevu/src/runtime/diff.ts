import { getReactiveVersion, isReactive, toRaw, unref } from '../reactivity'
import { hasOwn } from '../utils'
import { isNoSetData } from './noSetData'
import { hasTrackableSetupBinding } from './setupTracking'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export interface ToPlainOptions {
  cache?: WeakMap<object, { version: number, value: any }>
  cacheEligibility?: WeakMap<object, boolean>
  maxDepth?: number
  maxKeys?: number
  includeFunctions?: boolean
  functionPaths?: string[]
  _depth?: number
  _budget?: { keys: number }
  _path?: string
}

function toPlainInternal(
  value: any,
  seen: WeakMap<object, any>,
  visiting: WeakSet<object>,
  cache: WeakMap<object, { version: number, value: any }> | undefined,
  cacheEligibility: WeakMap<object, boolean> | undefined,
  depth: number,
  budget: { keys: number },
  includeFunctions: boolean,
  functionPathSet: Set<string> | undefined,
  currentPath: string,
): any {
  const unwrapped = unref(value)
  if (typeof unwrapped === 'bigint') {
    const asNumber = Number(unwrapped)
    return Number.isSafeInteger(asNumber) ? asNumber : unwrapped.toString()
  }
  if (typeof unwrapped === 'symbol') {
    return unwrapped.toString()
  }
  if (typeof unwrapped === 'function') {
    return includeFunctions || functionPathSet?.has(currentPath) ? unwrapped : undefined
  }
  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return unwrapped
  }
  if (isNoSetData(unwrapped)) {
    return undefined
  }
  const reactiveValue = isReactive(unwrapped)
  const raw = reactiveValue ? toRaw(unwrapped) : unwrapped
  let canUseCache = Boolean(cache) && reactiveValue
  if (cache && !canUseCache) {
    const cachedEligibility = cacheEligibility?.get(raw)
    canUseCache = cachedEligibility ?? !hasTrackableSetupBinding(raw)
    cacheEligibility?.set(raw, canUseCache)
  }
  const cacheRef = canUseCache ? cache : undefined

  if (depth <= 0 || budget.keys <= 0) {
    return raw
  }

  if (cacheRef) {
    const version = getReactiveVersion(raw as any)
    const cached = cacheRef.get(raw)
    if (cached && cached.version === version) {
      return cached.value
    }
  }

  if (visiting.has(raw)) {
    return undefined
  }
  if (seen.has(raw)) {
    return seen.get(raw)
  }
  if (raw instanceof Date) {
    return raw.getTime()
  }
  if (raw instanceof RegExp) {
    return raw.toString()
  }
  if (raw instanceof Map) {
    const entries: any[] = []
    seen.set(raw, entries)
    visiting.add(raw)
    raw.forEach((mapValue, mapKey) => {
      entries.push([
        toPlainInternal(mapKey, seen, visiting, undefined, undefined, Number.POSITIVE_INFINITY, { keys: Number.POSITIVE_INFINITY }, includeFunctions, undefined, ''),
        toPlainInternal(mapValue, seen, visiting, undefined, undefined, Number.POSITIVE_INFINITY, { keys: Number.POSITIVE_INFINITY }, includeFunctions, undefined, ''),
      ])
    })
    visiting.delete(raw)
    return entries
  }
  if (raw instanceof Set) {
    const values: any[] = []
    seen.set(raw, values)
    visiting.add(raw)
    raw.forEach((setValue) => {
      values.push(toPlainInternal(setValue, seen, visiting, undefined, undefined, Number.POSITIVE_INFINITY, { keys: Number.POSITIVE_INFINITY }, includeFunctions, undefined, ''))
    })
    visiting.delete(raw)
    return values
  }
  if (typeof ArrayBuffer !== 'undefined') {
    if (raw instanceof ArrayBuffer) {
      return raw.byteLength
    }
    if (ArrayBuffer.isView(raw)) {
      const view: any = raw as any
      const iter = view[Symbol.iterator]
      if (typeof iter === 'function') {
        const values = [...view]
        seen.set(raw, values)
        return values.map(item => toPlainInternal(item, seen, visiting, undefined, undefined, Number.POSITIVE_INFINITY, { keys: Number.POSITIVE_INFINITY }, includeFunctions, undefined, ''))
      }
      const bytes = [...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)]
      seen.set(raw, bytes)
      return bytes
    }
  }
  if (raw instanceof Error) {
    return {
      name: raw.name,
      message: raw.message,
    }
  }
  if (Array.isArray(raw)) {
    const arr: any[] = []
    seen.set(raw, arr)
    visiting.add(raw)
    const nextDepth = depth - 1
    for (let index = 0; index < raw.length; index += 1) {
      const childPath = currentPath ? `${currentPath}.${index}` : String(index)
      const next = toPlainInternal(raw[index], seen, visiting, cache, cacheEligibility, nextDepth, budget, includeFunctions, functionPathSet, childPath)
      arr[index] = next === undefined ? null : next
    }
    visiting.delete(raw)
    if (cacheRef) {
      cacheRef.set(raw, { version: getReactiveVersion(raw as any), value: arr })
    }
    return arr
  }
  const output: Record<string, any> = {}
  seen.set(raw, output)
  visiting.add(raw)
  const nextDepth = depth - 1
  for (const key of Object.keys(raw)) {
    budget.keys -= 1
    if (budget.keys <= 0) {
      break
    }
    const childPath = currentPath ? `${currentPath}.${key}` : key
    const next = toPlainInternal((raw as any)[key], seen, visiting, cache, cacheEligibility, nextDepth, budget, includeFunctions, functionPathSet, childPath)
    if (next !== undefined) {
      output[key] = next
    }
  }
  visiting.delete(raw)
  if (cacheRef) {
    cacheRef.set(raw, { version: getReactiveVersion(raw as any), value: output })
  }
  return output
}

export function toPlain(value: any, seen = new WeakMap<object, any>(), options?: ToPlainOptions): any {
  const depth = options?._depth ?? (typeof options?.maxDepth === 'number' ? Math.max(0, Math.floor(options.maxDepth)) : Number.POSITIVE_INFINITY)
  const budget = options?._budget ?? (typeof options?.maxKeys === 'number' ? { keys: Math.max(0, Math.floor(options.maxKeys)) } : { keys: Number.POSITIVE_INFINITY })
  const functionPathSet = Array.isArray(options?.functionPaths) && options.functionPaths.length
    ? new Set(options.functionPaths)
    : undefined
  return toPlainInternal(value, seen, new WeakSet(), options?.cache, options?.cacheEligibility, depth, budget, Boolean(options?.includeFunctions), functionPathSet, options?._path ?? '')
}

type DeepEqualCompare = (a: any, b: any) => boolean

function isArrayEqual(a: any[], b: any[], compare: DeepEqualCompare): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (!compare(a[i], b[i])) {
      return false
    }
  }
  return true
}

function isPlainObjectEqual(a: Record<string, any>, b: Record<string, any>, compare: DeepEqualCompare): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const key of aKeys) {
    if (!hasOwn(b, key)) {
      return false
    }
    if (!compare(a[key], b[key])) {
      return false
    }
  }
  return true
}

function isDeepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return isArrayEqual(a, b, isDeepEqual)
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    return isPlainObjectEqual(a, b, isDeepEqual)
  }
  return false
}

function normalizeSetDataValue<T>(value: T): T | null {
  return value === undefined ? null : value
}

function assignNestedDiff(
  prev: any,
  next: any,
  path: string,
  output: Record<string, any>,
) {
  if (isDeepEqual(prev, next)) {
    return
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    for (const key of Object.keys(next)) {
      if (!hasOwn(prev, key)) {
        output[`${path}.${key}`] = normalizeSetDataValue(next[key])
        continue
      }
      assignNestedDiff(prev[key], next[key], `${path}.${key}`, output)
    }
    for (const key of Object.keys(prev)) {
      if (!hasOwn(next, key)) {
        output[`${path}.${key}`] = null
      }
    }
    return
  }

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (!isArrayEqual(prev, next, isDeepEqual)) {
      output[path] = normalizeSetDataValue(next)
    }
    return
  }

  output[path] = normalizeSetDataValue(next)
}

export function diffSnapshots(
  prev: Record<string, any>,
  next: Record<string, any>,
  options?: { skipKeys?: Set<string> },
): Record<string, any> {
  const diff: Record<string, any> = {}
  const skipKeys = options?.skipKeys
  for (const key of Object.keys(next)) {
    if (skipKeys?.has(key)) {
      continue
    }
    assignNestedDiff(prev[key], next[key], key, diff)
  }
  for (const key of Object.keys(prev)) {
    if (skipKeys?.has(key)) {
      continue
    }
    if (!hasOwn(next, key)) {
      diff[key] = null
    }
  }
  return diff
}
