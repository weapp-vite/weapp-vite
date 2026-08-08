function resolveSlotNames(value: unknown) {
  if (Array.isArray(value)) {
    return new Set(value.filter((name): name is string => typeof name === 'string' && name.length > 0))
  }
  if (!value || typeof value !== 'object') {
    return new Set<string>()
  }
  return new Set(
    Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name),
  )
}

export function createWebSlotsProxy(resolveValue: () => unknown) {
  const hasSlot = (key: PropertyKey) => typeof key === 'string' && resolveSlotNames(resolveValue()).has(key)
  return new Proxy(Object.create(null) as Record<string, true>, {
    get: (_target, key) => hasSlot(key) ? true : undefined,
    has: (_target, key) => hasSlot(key),
    ownKeys: () => Array.from(resolveSlotNames(resolveValue())),
    getOwnPropertyDescriptor: (_target, key) => hasSlot(key)
      ? { configurable: true, enumerable: true, value: true }
      : undefined,
    set: () => false,
  })
}
