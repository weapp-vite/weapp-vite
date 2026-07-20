import type { MpPlatform } from './types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared'
import { platformBackendRegistry, resolveBackendExecution } from './backends'
import { DEFAULT_MP_PLATFORM } from './platform'

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
  return resolveBackendExecution(input).kind === 'web'
}

export function getSupportedWeappViteTargetDescriptors(): readonly WeappViteTargetDescriptor[] {
  const supportedBackends = platformBackendRegistry.getExecutionOrder()
  const miniprogramBackend = supportedBackends.find(backend => backend.descriptor.runtime === 'miniprogram')
  const webBackend = supportedBackends.find(backend => backend.descriptor.runtime === 'web')
  return [
    ...MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => ({
      platform: descriptor.id,
      runtime: 'miniprogram' as const,
      aliases: miniprogramBackend?.descriptor.aliases.includes(descriptor.id)
        ? [descriptor.id]
        : [],
      label: descriptor.id,
    })),
    ...webBackend
      ? [{
          platform: 'web' as const,
          runtime: 'web' as const,
          aliases: webBackend.descriptor.aliases,
          label: 'web',
        }]
      : [],
  ]
}

export function getSupportedWeappVitePlatforms(): readonly WeappVitePlatform[] {
  return getSupportedWeappViteTargetDescriptors().map(descriptor => descriptor.platform)
}

export function resolveWeappViteTarget(
  input?: WeappViteTargetInput | null,
  options: ResolveWeappViteTargetOptions = {},
): ResolvedWeappViteTarget {
  const fallbackMiniPlatform = options.fallbackMiniPlatform ?? DEFAULT_MP_PLATFORM
  const execution = resolveBackendExecution(input, {
    fallbackMiniPlatform,
    warn: options.warn,
  })
  const mini = execution.get('miniprogram')
  const web = execution.get('web')
  return {
    kind: execution.kind,
    runMini: Boolean(mini),
    runWeb: Boolean(web),
    platform: (mini?.platform ?? web?.platform) as WeappVitePlatform | undefined,
    label: execution.label,
    raw: execution.raw,
  }
}
