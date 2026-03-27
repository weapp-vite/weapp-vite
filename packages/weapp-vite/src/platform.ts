import type { MiniProgramPlatformAdapter } from './platforms/types'
import type { MpPlatform } from './types'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from './platforms/adapters'

export const DEFAULT_MP_PLATFORM: MpPlatform = 'weapp'

export function createMiniProgramPlatformRegistry(adapters: readonly MiniProgramPlatformAdapter[]) {
  const adapterById = new Map<MpPlatform, MiniProgramPlatformAdapter>()
  const aliasToId = new Map<string, MpPlatform>()

  for (const adapter of adapters) {
    adapterById.set(adapter.id, adapter)
    aliasToId.set(adapter.id, adapter.id)
    for (const alias of adapter.aliases) {
      const normalized = alias.trim().toLowerCase()
      if (!normalized) {
        continue
      }
      aliasToId.set(normalized, adapter.id)
    }
  }

  return {
    adapterById,
    aliasToId,
  }
}

const { adapterById: PLATFORM_ADAPTER_BY_ID, aliasToId: PLATFORM_ALIAS_TO_ID } = createMiniProgramPlatformRegistry(
  MINI_PROGRAM_PLATFORM_ADAPTERS,
)

export const MINI_PLATFORM_ALIASES: Readonly<Record<string, MpPlatform>> = Object.freeze(
  Object.fromEntries(PLATFORM_ALIAS_TO_ID.entries()),
) as Readonly<Record<string, MpPlatform>>

export function normalizeMiniPlatform(input?: string | null): string | undefined {
  const normalized = input?.trim().toLowerCase()
  return normalized || undefined
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

export function shouldPassPlatformArgToIdeOpen(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformAdapter(platform).ide?.requiresOpenPlatformArg === true
}

export function getDefaultIdeProjectRoot(platform?: MpPlatform): string | undefined {
  if (!platform) {
    return undefined
  }
  return getMiniProgramPlatformAdapter(platform).ide?.defaultProjectRoot
}

export function getPreservedNpmDirNames(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): readonly string[] {
  return getMiniProgramPlatformAdapter(platform).resolvePreservedNpmDirNames(options)
}
