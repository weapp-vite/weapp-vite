import { isObject } from './reactive'

export function traverse(value: any, seen = new Set<object>()): any {
  if (!isObject(value) || seen.has(value)) {
    return value
  }
  seen.add(value)
  for (const key in value as any) {
    traverse((value as any)[key], seen)
  }
  return value
}
