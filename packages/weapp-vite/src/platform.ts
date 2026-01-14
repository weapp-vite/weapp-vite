import type { MiniProgramPlatformAdapter } from './platforms/types'
import type { MpPlatform } from './types'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from './platforms/adapters'

export const DEFAULT_MP_PLATFORM: MpPlatform = 'weapp'

const PLATFORM_ADAPTER_BY_ID = new Map<MpPlatform, MiniProgramPlatformAdapter>()
const PLATFORM_ALIAS_TO_ID = new Map<string, MpPlatform>()

for (const adapter of MINI_PROGRAM_PLATFORM_ADAPTERS) {
  PLATFORM_ADAPTER_BY_ID.set(adapter.id, adapter)
  for (const alias of adapter.aliases) {
    const normalized = alias.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    PLATFORM_ALIAS_TO_ID.set(normalized, adapter.id)
  }
  if (!PLATFORM_ALIAS_TO_ID.has(adapter.id)) {
    PLATFORM_ALIAS_TO_ID.set(adapter.id, adapter.id)
  }
}

export const MINI_PLATFORM_ALIASES: Readonly<Record<string, MpPlatform>> = Object.freeze(
  Object.fromEntries(PLATFORM_ALIAS_TO_ID.entries()),
) as Readonly<Record<string, MpPlatform>>

export function normalizeMiniPlatform(input?: string | null): string | undefined {
  return input ? input.trim().toLowerCase() : undefined
}

export function resolveMiniPlatform(input?: string | null): MpPlatform | undefined {
  const normalized = normalizeMiniPlatform(input)
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIAS_TO_ID.get(normalized)
}

export function getMiniProgramPlatformAdapter(platform: MpPlatform): MiniProgramPlatformAdapter {
  const adapter = PLATFORM_ADAPTER_BY_ID.get(platform)
  if (!adapter) {
    throw new Error(`不支持的小程序平台 "${platform}"。`)
  }
  return adapter
}
