export function isObject(val: unknown): val is object {
  return typeof val === 'object' && val !== null
}

export function isPlainObject(val: unknown): val is Record<string, any> {
  if (!isObject(val)) {
    return false
  }
  const proto = Object.getPrototypeOf(val)
  return proto === Object.prototype || proto === null
}
