import { isObject, isReactive, toRaw } from './reactive'
import { ReactiveFlags } from './reactive/shared'
import { isRef } from './ref'

export function traverse(value: any, depth: number = Infinity, seen = new Map<object, number>()): any {
  if (depth <= 0 || !isObject(value)) {
    return value
  }
  if (isRef(value)) {
    traverse(value.value, depth - 1, seen)
    return value
  }
  if ((value as any)[ReactiveFlags.SKIP]) {
    return value
  }
  const existingDepth = seen.get(value)
  if (existingDepth !== undefined && existingDepth >= depth) {
    return value
  }
  seen.set(value, depth)
  const nextDepth = depth - 1
  if (Array.isArray(value)) {
    value.forEach(item => traverse(item, nextDepth, seen))
    return value
  }
  if (value instanceof Map) {
    value.forEach(item => traverse(item, nextDepth, seen))
    return value
  }
  if (value instanceof Set) {
    value.forEach(item => traverse(item, nextDepth, seen))
    return value
  }
  const target = isReactive(value) && depth !== Infinity ? toRaw(value) : value
  for (const key in target as any) {
    traverse((value as any)[key], nextDepth, seen)
  }
  return value
}
