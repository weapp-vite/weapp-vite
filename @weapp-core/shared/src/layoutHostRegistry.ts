export interface MiniProgramLayoutHostWaitOptions {
  interval?: number
  retries?: number
}

export type MiniProgramLayoutHostResolver<TBridge, THost = unknown> = (bridge: TBridge, key: string) => THost | null | undefined

/**
 * @description 对 layout host key 去重并过滤空字符串。
 */
export function normalizeMiniProgramLayoutHostKeys(keys: string | string[]) {
  return Array.from(new Set(Array.isArray(keys) ? keys : [keys]))
    .filter((key): key is string => typeof key === 'string' && key.length > 0)
}

/**
 * @description 创建小程序 layout host 注册表。
 */
export function createMiniProgramLayoutHostRegistry<TBridge>() {
  const registries = new Map<string, Map<string, TBridge>>()

  function register(keys: string | string[], bridge: TBridge, pageKeys: string[]) {
    const normalizedKeys = normalizeMiniProgramLayoutHostKeys(keys)
    if (normalizedKeys.length === 0 || pageKeys.length === 0) {
      return null
    }

    for (const pageKey of pageKeys) {
      const registry = registries.get(pageKey) ?? new Map<string, TBridge>()
      for (const key of normalizedKeys) {
        registry.set(key, bridge)
      }
      registries.set(pageKey, registry)
    }

    return normalizedKeys
  }

  function unregister(keys: string | string[], bridge: TBridge, pageKeys: string[]) {
    const normalizedKeys = normalizeMiniProgramLayoutHostKeys(keys)
    if (normalizedKeys.length === 0 || pageKeys.length === 0) {
      return false
    }

    let removed = false
    for (const pageKey of pageKeys) {
      const registry = registries.get(pageKey)
      if (!registry) {
        continue
      }

      for (const key of normalizedKeys) {
        if (registry.get(key) === bridge) {
          registry.delete(key)
          removed = true
        }
      }

      if (registry.size === 0) {
        registries.delete(pageKey)
      }
    }

    return removed
  }

  function unregisterBridge(bridge: TBridge) {
    let removed = false
    for (const registry of registries.values()) {
      for (const [key, currentBridge] of registry) {
        if (currentBridge === bridge) {
          registry.delete(key)
          removed = true
        }
      }
    }

    for (const [pageKey, registry] of registries) {
      if (registry.size === 0) {
        registries.delete(pageKey)
      }
    }

    return removed
  }

  function resolveBridge(key: string, pageKeys: string[]) {
    return pageKeys
      .map(pageKey => registries.get(pageKey)?.get(key))
      .find(Boolean)
  }

  function resolveHost<THost>(
    key: string,
    pageKeys: string[],
    resolver: MiniProgramLayoutHostResolver<TBridge, THost>,
  ) {
    const bridge = resolveBridge(key, pageKeys)
    if (!bridge) {
      return null
    }
    return resolver(bridge, key) ?? null
  }

  function waitForHost<THost>(
    key: string,
    resolvePageKeys: () => string[],
    resolver: MiniProgramLayoutHostResolver<TBridge, THost>,
    options: MiniProgramLayoutHostWaitOptions = {},
  ): Promise<THost | null> {
    const retries = options.retries ?? 20
    const interval = options.interval ?? 16
    const host = resolveHost(key, resolvePageKeys(), resolver)
    if (host || retries <= 0) {
      return Promise.resolve(host)
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(waitForHost(key, resolvePageKeys, resolver, {
          ...options,
          retries: retries - 1,
        }))
      }, interval)
    })
  }

  return {
    register,
    resolveBridge,
    resolveHost,
    unregister,
    unregisterBridge,
    waitForHost,
  }
}
