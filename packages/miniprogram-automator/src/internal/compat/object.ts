/**
 * @file 对象与序列化工具。
 */
import { isPlainObject } from './typeGuards'

function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item)) as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, any> = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }

      result[key] = cloneDeep(item)
    }
    return result as T
  }

  return value
}

function stableSerialize(value: unknown) {
  const stack: unknown[] = []
  const keys: string[] = []

  return JSON.stringify(value, function serialize(key, currentValue) {
    if (stack.length > 0) {
      const currentIndex = stack.indexOf(this)
      if (currentIndex >= 0) {
        stack.splice(currentIndex + 1)
        keys.splice(currentIndex, Infinity, key)
      }
      else {
        stack.push(this)
        keys.push(key)
      }

      const valueIndex = stack.indexOf(currentValue)
      if (valueIndex >= 0) {
        if (valueIndex === 0) {
          return '[Circular ~]'
        }

        return `[Circular ~.${keys.slice(0, valueIndex).join('.')}]`
      }
    }
    else {
      stack.push(currentValue)
    }

    if (typeof currentValue === 'function') {
      return `[Function ${currentValue.toString()}]`
    }

    if (currentValue instanceof RegExp) {
      return `[RegExp ${currentValue.toString()}]`
    }

    if (typeof currentValue === 'undefined') {
      return null
    }

    return currentValue
  })
}

/** extendDeep 的方法封装。 */
export function extendDeep<T>(target: T, ...sources: unknown[]): T {
  let result = target

  for (const source of sources) {
    if (isPlainObject(result) && isPlainObject(source)) {
      for (const [key, value] of Object.entries(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue
        }

        result[key as keyof T] = extendDeep((result as any)[key], value)
      }
      continue
    }

    result = cloneDeep(source) as T
  }

  return result
}

/** isEmpty 的方法封装。 */
export function isEmpty(value: unknown) {
  if (value == null) {
    return true
  }

  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}

/** stringify 的方法封装。 */
export function stringify(value: unknown) {
  return stableSerialize(value)
}
