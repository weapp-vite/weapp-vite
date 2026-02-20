import { isReactive, isRef, toRaw } from '../../reactivity'

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

export function applySetupResult(runtime: any, target: any, result: any) {
  const declaredPropKeys = new Set<string>(
    Array.isArray(target?.__wevuPropKeys) ? target.__wevuPropKeys : [],
  )
  const methods = runtime?.methods ?? Object.create(null)
  const state = runtime?.state ?? Object.create(null)
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
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      ;(methods as any)[key] = (...args: any[]) => (val as any).apply(runtime?.proxy ?? runtime, args)
      methodsChanged = true
    }
    else {
      if (declaredPropKeys.has(key)) {
        let fallbackValue = val
        try {
          Object.defineProperty(rawState, key, {
            configurable: true,
            enumerable: false,
            get() {
              const propsSource = (rawState as any).__wevuProps
              if (propsSource && typeof propsSource === 'object' && Object.prototype.hasOwnProperty.call(propsSource, key)) {
                return (propsSource as any)[key]
              }
              return fallbackValue
            },
            set(next: unknown) {
              fallbackValue = next
              const propsSource = (rawState as any).__wevuProps
              if (!propsSource || typeof propsSource !== 'object') {
                return
              }
              try {
                ;(propsSource as any)[key] = next
              }
              catch {
                // 忽略异常
              }
            },
          })
        }
        catch {
          ;(state as any)[key] = val
        }
        return
      }
      // 不可序列化的实例不应出现在 setData 快照中。
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
          ;(state as any)[key] = val
        }
      }
      else {
        ;(state as any)[key] = val
      }
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
