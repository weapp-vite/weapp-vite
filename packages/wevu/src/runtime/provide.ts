const __wevuProvideStore = new Map<any, any>()

export function provide<T>(key: any, value: T): void {
  __wevuProvideStore.set(key, value)
}

export function inject<T>(key: any, defaultValue?: T): T {
  if (__wevuProvideStore.has(key)) {
    return __wevuProvideStore.get(key) as T
  }
  if (arguments.length >= 2) {
    return defaultValue as T
  }
  throw new Error(`wevu.inject: no value found for key`)
}
