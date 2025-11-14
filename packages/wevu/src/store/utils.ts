export function isObject(val: unknown): val is object {
  return typeof val === 'object' && val !== null
}

export function mergeShallow(target: Record<string, any>, patch: Record<string, any>) {
  for (const k in patch) {
    target[k] = patch[k]
  }
}
