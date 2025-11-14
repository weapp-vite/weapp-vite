import { isReactive, toRaw, unref } from '../reactivity'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function toPlain(value: any, seen = new WeakMap<object, any>()): any {
  const unwrapped = unref(value)
  if (typeof unwrapped !== 'object' || unwrapped === null) {
    return unwrapped
  }
  const raw = isReactive(unwrapped) ? toRaw(unwrapped) : unwrapped
  if (seen.has(raw)) {
    return seen.get(raw)
  }
  if (Array.isArray(raw)) {
    const arr: any[] = []
    seen.set(raw, arr)
    raw.forEach((item, index) => {
      arr[index] = toPlain(item, seen)
    })
    return arr
  }
  const output: Record<string, any> = {}
  seen.set(raw, output)
  Object.keys(raw).forEach((key) => {
    output[key] = toPlain((raw as any)[key], seen)
  })
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
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        output[`${path}.${key}`] = null
        return
      }
      assignNestedDiff(prev[key], next[key], `${path}.${key}`, output)
    })
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
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  keys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      diff[key] = null
      return
    }
    assignNestedDiff(prev[key], next[key], key, diff)
  })
  return diff
}
