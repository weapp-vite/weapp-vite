import type { InlineConfig } from 'vite'

export const WEAPP_VITE_HOST_NAME = 'weapp-vite'

export type WeappViteRuntime = 'miniprogram' | 'web'

export interface WeappViteHostMeta {
  name: typeof WEAPP_VITE_HOST_NAME
  runtime: WeappViteRuntime
}

export function createWeappViteHostMeta(runtime: WeappViteRuntime): WeappViteHostMeta {
  return {
    name: WEAPP_VITE_HOST_NAME,
    runtime,
  }
}

export function applyWeappViteHostMeta(
  config: InlineConfig,
  runtime: WeappViteRuntime,
): InlineConfig {
  config.weappVite = createWeappViteHostMeta(runtime)
  return config
}

export function resolveWeappViteHostMeta(
  config: Pick<InlineConfig, 'weappVite'> | undefined,
): WeappViteHostMeta | undefined {
  const meta = config?.weappVite
  if (!meta || typeof meta !== 'object') {
    return undefined
  }
  if (meta.name !== WEAPP_VITE_HOST_NAME) {
    return undefined
  }
  if (meta.runtime !== 'miniprogram' && meta.runtime !== 'web') {
    return undefined
  }
  return meta
}

export function isWeappViteHost(config: Pick<InlineConfig, 'weappVite'> | undefined): boolean {
  return resolveWeappViteHostMeta(config) !== undefined
}

declare module 'vite' {
  interface UserConfig {
    weappVite?: WeappViteHostMeta
  }

  interface ResolvedConfig {
    weappVite?: WeappViteHostMeta
  }
}
