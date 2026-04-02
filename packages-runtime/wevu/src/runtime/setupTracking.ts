import { isReactive, toRaw, touchReactive } from '../reactivity'
import { isRef } from '../reactivity/ref'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function shouldTraverse(value: unknown): value is Record<string, any> | any[] {
  return Array.isArray(value) || isPlainObject(value)
}

function getTrackableChildren(value: Record<string, any> | any[]) {
  if (Array.isArray(value)) {
    return value
  }
  const children: unknown[] = []
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || typeof descriptor.get === 'function') {
      continue
    }
    children.push(descriptor.value)
  }
  return children
}

/**
 * 判断 setup 返回值是否包含需要额外跟踪的 ref/reactive 源。
 */
export function hasTrackableSetupBinding(value: unknown, seen = new WeakSet<object>()): boolean {
  if (isRef(value) || isReactive(value)) {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  if (seen.has(value as object)) {
    return false
  }
  seen.add(value as object)
  if (!shouldTraverse(value)) {
    return false
  }
  return getTrackableChildren(value).some(item => hasTrackableSetupBinding(item, seen))
}

/**
 * 递归触达 setup 返回值中的 ref/reactive，确保异步更新能驱动 setData 调度。
 */
export function touchSetupBinding(value: unknown, seen = new WeakSet<object>()) {
  if (isRef(value)) {
    const inner = value.value
    if (isReactive(inner)) {
      touchReactive(inner as any)
    }
    touchSetupBinding(inner, seen)
    return
  }
  if (isReactive(value)) {
    touchReactive(value as any)
    touchSetupBinding(toRaw(value as any), seen)
    return
  }
  if (!value || typeof value !== 'object') {
    return
  }
  if (seen.has(value as object) || !shouldTraverse(value)) {
    return
  }
  seen.add(value as object)
  getTrackableChildren(value).forEach(item => touchSetupBinding(item, seen))
}
