import type { WeapiAdapter } from './types'
import { getMiniProgramRuntimeGlobalKeys } from './platformRegistry'
import { resolveRuntimeGlobalValue, resolveRuntimeRoot } from './runtimeGlobal'

export interface DetectAdapterResult {
  adapter?: WeapiAdapter
  platform?: string
}

const GLOBAL_ADAPTER_KEYS: Array<{ platform: string, key: string }> = [
  ...getMiniProgramRuntimeGlobalKeys().map(key => ({
    platform: key,
    key,
  })),
]

function isAdapterCandidate(value: unknown): value is WeapiAdapter {
  return typeof value === 'object' || typeof value === 'function'
}

/**
 * @description 侦测当前运行环境的全局 API 对象
 */
export function detectGlobalAdapter(): DetectAdapterResult {
  const root = resolveRuntimeRoot()
  for (const item of GLOBAL_ADAPTER_KEYS) {
    const candidate = resolveRuntimeGlobalValue(item.key, root)
    if (isAdapterCandidate(candidate)) {
      return {
        adapter: candidate as WeapiAdapter,
        platform: item.platform,
      }
    }
  }
  return {}
}
