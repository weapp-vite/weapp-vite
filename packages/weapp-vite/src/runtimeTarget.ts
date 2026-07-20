import type { MpPlatform } from './types'
import { DEFAULT_MP_PLATFORM, getSupportedMiniProgramPlatforms, normalizeMiniPlatform, resolveMiniPlatform } from './platform'

export type WebPlatform = 'web'
export type QuickAppPlatform = 'quickapp'
export type WeappViteRuntime = 'miniprogram' | 'web' | 'quickapp'
export type WeappVitePlatform = MpPlatform | WebPlatform | QuickAppPlatform
export type WeappViteTargetInput = WeappVitePlatform | 'h5' | 'all' | 'both' | (string & {})
export type WeappViteTargetKind = WeappViteRuntime | 'all'

export interface ResolvedWeappViteTarget {
  kind: WeappViteTargetKind
  runMini: boolean
  runQuickApp: boolean
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
export const QUICKAPP_PLATFORM_ALIASES = Object.freeze(['quickapp', 'hap'])

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
    {
      platform: 'quickapp',
      runtime: 'quickapp' as const,
      aliases: QUICKAPP_PLATFORM_ALIASES,
      label: 'quickapp',
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
      runQuickApp: false,
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
      runQuickApp: false,
      runWeb: true,
      label: 'weapp + web',
      raw,
    }
  }

  if (isWebPlatform(normalized ?? lowerRaw)) {
    return {
      kind: 'web',
      runMini: false,
      runQuickApp: false,
      runWeb: true,
      platform: 'web',
      label: 'web',
      raw,
    }
  }

  if (QUICKAPP_PLATFORM_ALIASES.includes(lowerRaw)) {
    return {
      kind: 'quickapp',
      runMini: false,
      runQuickApp: true,
      runWeb: false,
      platform: 'quickapp',
      label: 'quickapp',
      raw,
    }
  }

  const platform = resolveMiniPlatform(normalized ?? raw)
  if (platform) {
    return {
      kind: 'miniprogram',
      runMini: true,
      runQuickApp: false,
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
    runQuickApp: false,
    runWeb: false,
    platform: fallbackMiniPlatform,
    label: fallbackMiniPlatform,
    raw,
  }
}
