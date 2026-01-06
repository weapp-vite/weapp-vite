import { getReactiveVersion, isReactive, toRaw, unref } from '../reactivity'
import { isNoSetData } from './noSetData'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export interface ToPlainOptions {
  cache?: WeakMap<object, { version: number, value: any }>
  maxDepth?: number
  maxKeys?: number
  _depth?: number
  _budget?: { keys: number }
}

export function toPlain(value: any, seen = new WeakMap<object, any>(), options?: ToPlainOptions): any {
  const unwrapped = unref(value)
  if (typeof unwrapped === 'bigint') {
    const asNumber = Number(unwrapped)
    return Number.isSafeInteger(asNumber) ? asNumber : unwrapped.toString()
  }
  if (typeof unwrapped === 'symbol') {
    return unwrapped.toString()
  }
  if (typeof unwrapped === 'function') {
    return undefined
  }
  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return unwrapped
  }
  if (isNoSetData(unwrapped)) {
    return undefined
  }
  const raw = isReactive(unwrapped) ? toRaw(unwrapped) : unwrapped

  const depth = options?._depth ?? (typeof options?.maxDepth === 'number' ? Math.max(0, Math.floor(options!.maxDepth!)) : Number.POSITIVE_INFINITY)
  const budget = options?._budget ?? (typeof options?.maxKeys === 'number' ? { keys: Math.max(0, Math.floor(options!.maxKeys!)) } : { keys: Number.POSITIVE_INFINITY })
  if (depth <= 0 || budget.keys <= 0) {
    return raw
  }

  const cache = options?.cache
  if (cache) {
    const version = getReactiveVersion(raw as any)
    const cached = cache.get(raw)
    if (cached && cached.version === version) {
      return cached.value
    }
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
    raw.forEach((mapValue, mapKey) => {
      entries.push([toPlain(mapKey, seen), toPlain(mapValue, seen)])
    })
    return entries
  }
  if (raw instanceof Set) {
    const values: any[] = []
    seen.set(raw, values)
    raw.forEach((setValue) => {
      values.push(toPlain(setValue, seen))
    })
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
        const values = Array.from(view)
        seen.set(raw, values)
        return values.map(item => toPlain(item, seen))
      }
      const bytes = Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
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
    raw.forEach((item, index) => {
      const next = toPlain(item, seen, {
        ...options,
        _depth: depth - 1,
        _budget: budget,
      })
      arr[index] = next === undefined ? null : next
    })
    if (cache) {
      cache.set(raw, { version: getReactiveVersion(raw as any), value: arr })
    }
    return arr
  }
  const output: Record<string, any> = {}
  seen.set(raw, output)
  Object.keys(raw).forEach((key) => {
    budget.keys -= 1
    if (budget.keys <= 0) {
      return
    }
    const next = toPlain((raw as any)[key], seen, {
      ...options,
      _depth: depth - 1,
      _budget: budget,
    })
    if (next !== undefined) {
      output[key] = next
    }
  })
  if (cache) {
    cache.set(raw, { version: getReactiveVersion(raw as any), value: output })
  }
  return output
}

function isDeepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return isArrayEqual(a, b)
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    return isPlainObjectEqual(a, b)
  }
  return false
}

function isArrayEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (!isDeepEqual(a[i], b[i])) {
      return false
    }
  }
  return true
}

function isPlainObjectEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false
    }
    if (!isDeepEqual(a[key], b[key])) {
      return false
    }
  }
  return true
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
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        output[`${path}.${key}`] = normalizeSetDataValue(next[key])
        continue
      }
      assignNestedDiff(prev[key], next[key], `${path}.${key}`, output)
    }
    for (const key of Object.keys(prev)) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        output[`${path}.${key}`] = null
      }
    }
    return
  }

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (!isArrayEqual(prev, next)) {
      output[path] = normalizeSetDataValue(next)
    }
    return
  }

  output[path] = normalizeSetDataValue(next)
}

export function diffSnapshots(
  prev: Record<string, any>,
  next: Record<string, any>,
): Record<string, any> {
  const diff: Record<string, any> = {}
  for (const key of Object.keys(next)) {
    assignNestedDiff(prev[key], next[key], key, diff)
  }
  for (const key of Object.keys(prev)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      diff[key] = null
    }
  }
  return diff
}
