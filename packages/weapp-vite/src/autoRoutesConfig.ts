import type { WeappAutoRoutesConfig } from './types'
import { DEFAULT_AUTO_ROUTE_INCLUDE } from './runtime/autoRoutesPlugin/matcher'

export interface ResolvedWeappAutoRoutesConfig {
  enabled: boolean
  typedRouter: boolean
  include: Array<string | RegExp>
  persistentCache: boolean
  persistentCachePath?: string
  watch: boolean
}

export function resolveWeappAutoRoutesConfig(config?: boolean | WeappAutoRoutesConfig): ResolvedWeappAutoRoutesConfig {
  if (config == null || config === false) {
    return {
      enabled: false,
      typedRouter: false,
      include: [...DEFAULT_AUTO_ROUTE_INCLUDE],
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
    include: record.include == null
      ? [...DEFAULT_AUTO_ROUTE_INCLUDE]
      : Array.isArray(record.include)
        ? [...record.include]
        : [record.include],
    persistentCache: typeof record.persistentCache === 'string' || record.persistentCache === true,
    persistentCachePath: typeof record.persistentCache === 'string'
      ? record.persistentCache
      : undefined,
    watch: record.watch !== false,
  }
}
