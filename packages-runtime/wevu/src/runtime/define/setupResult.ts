import { isReactive, isRef, toRaw } from '../../reactivity'
import { hasTrackableSetupBinding } from '../setupTracking'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function shouldExposeInSnapshot(value: unknown): boolean {
  if (value == null) {
    return true
  }
  if (typeof value !== 'object') {
    return true
  }
  if (isRef(value) || isReactive(value)) {
    return true
  }
  if (Array.isArray(value)) {
    return true
  }
  return isPlainObject(value)
}

export function applySetupResult(
  runtime: any,
  target: any,
  result: any,
  options?: { includeFunctionsInState?: boolean, functionPropPaths?: Set<string> },
) {
  const includeFunctionsInState = Boolean(options?.includeFunctionsInState)
  const functionPropPaths = options?.functionPropPaths
  const methods = runtime?.methods ?? Object.create(null)
  const state = runtime?.state ?? Object.create(null)
  const setupState = runtime?.setupState ?? Object.create(null)
  const rawState = isReactive(state) ? toRaw(state) : state
  let methodsChanged = false
  if (runtime && !runtime.methods) {
    try {
      runtime.methods = methods
    }
    catch {
      // 个别场景 runtime 可能只读，保持兼容行为。
    }
  }
  if (runtime && !runtime.state) {
    try {
      runtime.state = state
    }
    catch {
      // 个别场景 runtime 可能只读，保持兼容行为。
    }
  }
  if (runtime && !runtime.setupState) {
    try {
      runtime.setupState = setupState
    }
    catch {
      // 个别场景 runtime 可能只读，保持兼容行为。
    }
  }
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      const bound = (...args: any[]) => (val as any).apply(runtime?.proxy ?? runtime, args)
      ;(methods as any)[key] = bound
      ;(state as any)[key] = bound
      if (includeFunctionsInState || functionPropPaths?.has(key)) {
        ;(setupState as any)[key] = bound
      }
      methodsChanged = true
    }
    else {
      if (hasTrackableSetupBinding(val)) {
        runtime?.__wevu_trackSetupReactiveKey?.(key)
      }
      ;(state as any)[key] = val
      if (val === target || !shouldExposeInSnapshot(val)) {
        try {
          Object.defineProperty(rawState, key, {
            value: val,
            configurable: true,
            enumerable: false,
            writable: true,
          })
        }
        catch {
          // 保持 state 的兼容写入已完成，这里只兜底非枚举定义。
        }
      }
      ;(setupState as any)[key] = val
    }
  })
  if (runtime) {
    runtime.methods = runtime.methods ?? methods
    runtime.state = runtime.state ?? state
    if (methodsChanged) {
      runtime.__wevu_touchSetupMethodsVersion?.()
    }
  }
}
