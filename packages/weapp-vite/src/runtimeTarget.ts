import type { MpPlatform } from './types'
import { DEFAULT_MP_PLATFORM, getSupportedMiniProgramPlatforms, normalizeMiniPlatform, resolveMiniPlatform } from './platform'

export type WebPlatform = 'web'
export type WeappViteRuntime = 'miniprogram' | 'web'
export type WeappVitePlatform = MpPlatform | WebPlatform
export type WeappViteTargetInput = WeappVitePlatform | 'h5' | 'all' | 'both' | (string & {})
export type WeappViteTargetKind = WeappViteRuntime | 'all'

export interface ResolvedWeappViteTarget {
  kind: WeappViteTargetKind
  runMini: boolean
  runWeb: boolean
  platform?: WeappVitePlatform
  label: string
  raw?: string
}

export interface ResolveWeappViteTargetOptions {
  fallbackMiniPlatform?: MpPlatform
  warn?: (message: string) => void
}

export interface WeappViteTargetDescriptor {
  platform: WeappVitePlatform
  runtime: WeappViteRuntime
  aliases: readonly string[]
  label: string
}

export const WEB_PLATFORM_ALIASES = Object.freeze(['web', 'h5'])

export function isWebPlatform(input?: string | null): boolean {
  if (!input) {
    return false
  }
  return WEB_PLATFORM_ALIASES.includes(input.trim().toLowerCase())
}

export function getSupportedWeappViteTargetDescriptors(): readonly WeappViteTargetDescriptor[] {
  return [
    ...getSupportedMiniProgramPlatforms().map(platform => ({
      platform,
      runtime: 'miniprogram' as const,
      aliases: [platform],
      label: platform,
    })),
    {
      platform: 'web',
      runtime: 'web',
      aliases: WEB_PLATFORM_ALIASES,
      label: 'web',
    },
  ]
}

export function getSupportedWeappVitePlatforms(): readonly WeappVitePlatform[] {
  return getSupportedWeappViteTargetDescriptors().map(descriptor => descriptor.platform)
}

export function resolveWeappViteTarget(
  input?: WeappViteTargetInput | null,
  options: ResolveWeappViteTargetOptions = {},
): ResolvedWeappViteTarget {
  const raw = typeof input === 'string' ? input : undefined
  if (!raw) {
    return {
      kind: 'miniprogram',
      runMini: true,
      runWeb: false,
      label: 'config',
      raw,
    }
  }

  const normalized = normalizeMiniPlatform(raw)
  const lowerRaw = raw.trim().toLowerCase()
  if (lowerRaw === 'all' || lowerRaw === 'both') {
    return {
      kind: 'all',
      runMini: true,
      runWeb: true,
      label: 'weapp + web',
      raw,
    }
  }

  if (isWebPlatform(normalized ?? lowerRaw)) {
    return {
      kind: 'web',
      runMini: false,
      runWeb: true,
      platform: 'web',
      label: 'web',
      raw,
    }
  }

  const platform = resolveMiniPlatform(normalized ?? raw)
  if (platform) {
    return {
      kind: 'miniprogram',
      runMini: true,
      runWeb: false,
      platform,
      label: platform,
      raw,
    }
  }

  const fallbackMiniPlatform = options.fallbackMiniPlatform ?? DEFAULT_MP_PLATFORM
  options.warn?.(`未识别的平台 "${raw}"，已回退到 ${fallbackMiniPlatform}`)
  return {
    kind: 'miniprogram',
    runMini: true,
    runWeb: false,
    platform: fallbackMiniPlatform,
    label: fallbackMiniPlatform,
    raw,
  }
}
