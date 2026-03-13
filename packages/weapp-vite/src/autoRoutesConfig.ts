import type { WeappAutoRoutesConfig } from './types'

export interface ResolvedWeappAutoRoutesConfig {
  enabled: boolean
  typedRouter: boolean
  persistentCache: boolean
  persistentCachePath?: string
  watch: boolean
}

export function resolveWeappAutoRoutesConfig(config?: boolean | WeappAutoRoutesConfig): ResolvedWeappAutoRoutesConfig {
  if (config == null || config === false) {
    return {
      enabled: false,
      typedRouter: false,
      persistentCache: false,
      watch: false,
    }
  }

  const record = (typeof config === 'object' && config)
    ? config
    : {}

  return {
    enabled: config === true || record.enabled !== false,
    typedRouter: record.typedRouter !== false,
    persistentCache: typeof record.persistentCache === 'string' || record.persistentCache === true,
    persistentCachePath: typeof record.persistentCache === 'string'
      ? record.persistentCache
      : undefined,
    watch: record.watch !== false,
  }
}
