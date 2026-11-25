// A2UI Core 依赖 Object.hasOwn，部分小程序基础库尚未提供该内建。
if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    configurable: true,
    writable: true,
    value(object: unknown, key: PropertyKey) {
      if (object == null) {
        throw new TypeError('Object.hasOwn requires a non-null object')
      }
      return Object.prototype.hasOwnProperty.call(object, key)
    },
  })
}

export {}
