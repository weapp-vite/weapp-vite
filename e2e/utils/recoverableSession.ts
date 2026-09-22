/** 保持调用方会话引用稳定，恢复时只替换底层连接；已关闭会话不得复用。 */
export function createRecoverableSession<T extends object>(initial: T) {
  let current: T | undefined = initial
  const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>()
  const requireCurrent = () => {
    if (!current) {
      throw new Error('Runtime session is closed or recovering')
    }
    return current
  }
  const session = new Proxy({} as T, {
    get(_target, key) {
      const target = requireCurrent()
      const value = Reflect.get(target, key, target)
      if (typeof value !== 'function') {
        return value
      }
      let method = methods.get(key)
      if (!method) {
        method = (...args) => {
          const active = requireCurrent()
          const invoke: unknown = Reflect.get(active, key, active)
          if (typeof invoke !== 'function') {
            throw new TypeError(`Runtime session method ${String(key)} is unavailable`)
          }
          return Reflect.apply(invoke, active, args)
        }
        methods.set(key, method)
      }
      return method
    },
    set(_target, key, value) {
      const target = requireCurrent()
      return Reflect.set(target, key, value, target)
    },
  })
  return {
    session,
    replace(next: T) {
      current = next
    },
    clear() {
      const previous = current
      current = undefined
      return previous
    },
  }
}
