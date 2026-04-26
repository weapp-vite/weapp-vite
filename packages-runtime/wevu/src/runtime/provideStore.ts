const wevuGlobalProvideStore = new Map<any, any>()

/**
 * 写入全局 provide 存储，供运行时内部与兼容层复用。
 */
export function setGlobalProvidedValue<T>(key: any, value: T): void {
  wevuGlobalProvideStore.set(key, value)
}

export function hasGlobalProvidedValue(key: any): boolean {
  return wevuGlobalProvideStore.has(key)
}

export function getGlobalProvidedValue<T>(key: any): T {
  return wevuGlobalProvideStore.get(key) as T
}
