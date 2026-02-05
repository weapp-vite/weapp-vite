import type { WeapiAdapter } from './types'

export interface DetectAdapterResult {
  adapter?: WeapiAdapter
  platform?: string
}

const GLOBAL_ADAPTER_KEYS: Array<{ platform: string, key: string }> = [
  { platform: 'wx', key: 'wx' },
  { platform: 'my', key: 'my' },
  { platform: 'tt', key: 'tt' },
  { platform: 'qq', key: 'qq' },
  { platform: 'swan', key: 'swan' },
  { platform: 'ks', key: 'ks' },
  { platform: 'jd', key: 'jd' },
  { platform: 'xhs', key: 'xhs' },
  { platform: 'dd', key: 'dd' },
  { platform: 'qa', key: 'qa' },
  { platform: 'qapp', key: 'qapp' },
  { platform: 'uni', key: 'uni' },
]

function resolveGlobalThis(): Record<string, any> | undefined {
  if (typeof globalThis !== 'undefined') {
    return globalThis as Record<string, any>
  }
  if (typeof window !== 'undefined') {
    return window as Record<string, any>
  }
  return undefined
}

function isAdapterCandidate(value: unknown): value is WeapiAdapter {
  return typeof value === 'object' || typeof value === 'function'
}

/**
 * @description 侦测当前运行环境的全局 API 对象
 */
export function detectGlobalAdapter(): DetectAdapterResult {
  const root = resolveGlobalThis()
  if (!root) {
    return {}
  }
  for (const item of GLOBAL_ADAPTER_KEYS) {
    const candidate = root[item.key]
    if (isAdapterCandidate(candidate)) {
      return {
        adapter: candidate as WeapiAdapter,
        platform: item.platform,
      }
    }
  }
  return {}
}
