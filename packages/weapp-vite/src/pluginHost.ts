import type { InlineConfig } from 'vite'
import type { WeappVitePlatform, WeappViteRuntime } from './runtimeTarget'

export const WEAPP_VITE_HOST_NAME = 'weapp-vite'
export type { WeappViteRuntime }

export interface WeappViteHostMeta {
  name: typeof WEAPP_VITE_HOST_NAME
  runtime: WeappViteRuntime
  platform?: WeappVitePlatform
}

export function createWeappViteHostMeta(
  runtime: WeappViteRuntime,
  platform?: WeappVitePlatform,
): WeappViteHostMeta {
  const meta: WeappViteHostMeta = {
    name: WEAPP_VITE_HOST_NAME,
    runtime,
  }
  if (platform) {
    meta.platform = platform
  }
  return meta
}

export function applyWeappViteHostMeta(
  config: InlineConfig,
  runtime: WeappViteRuntime,
  platform?: WeappVitePlatform,
): InlineConfig {
  config.weappVite = createWeappViteHostMeta(runtime, platform)
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
  if (meta.platform !== undefined && typeof meta.platform !== 'string') {
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
