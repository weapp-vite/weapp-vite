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

export function mergeShallow(target: Record<string, any>, patch: Record<string, any>) {
  for (const k in patch) {
    target[k] = patch[k]
  }
}

export function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item)) as T
  }
  if (isPlainObject(value)) {
    const result: Record<string, any> = {}
    for (const key in value) {
      result[key] = cloneDeep((value as any)[key])
    }
    return result as T
  }
  return value
}

export function resetObject(target: Record<string, any>, snapshot: Record<string, any> | any[]) {
  if (Array.isArray(target) && Array.isArray(snapshot)) {
    target.length = 0
    snapshot.forEach((item, index) => {
      target[index] = cloneDeep(item)
    })
    return
  }
  if (!isObject(snapshot)) {
    return
  }
  for (const key in target) {
    if (!(key in snapshot)) {
      delete target[key]
    }
  }
  for (const key in snapshot) {
    const snapValue = (snapshot as any)[key]
    const currentValue = target[key]
    if (Array.isArray(snapValue) && Array.isArray(currentValue)) {
      resetObject(currentValue, snapValue)
      continue
    }
    if (isPlainObject(snapValue) && isPlainObject(currentValue)) {
      resetObject(currentValue, snapValue)
      continue
    }
    target[key] = cloneDeep(snapValue)
  }
}
