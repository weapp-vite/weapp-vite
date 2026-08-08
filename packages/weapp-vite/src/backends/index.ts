import type { PlatformBackendCapability, ResolvedBackendExecution } from './types'
import { DEFAULT_MP_PLATFORM } from '../platform'
import { miniprogramBackend } from './miniprogram'
import { PlatformBackendRegistry } from './registry'
import { webBackend } from './web'

export const platformBackendRegistry = new PlatformBackendRegistry()
platformBackendRegistry.register(miniprogramBackend)
platformBackendRegistry.register(webBackend)

export function resolveBackendExecution(
  input?: string | null,
  options: {
    fallbackMiniPlatform?: string
    warn?: (message: string) => void
  } = {},
): ResolvedBackendExecution {
  return platformBackendRegistry.resolve(input, {
    fallbackBackendId: 'miniprogram',
    fallbackPlatform: options.fallbackMiniPlatform ?? DEFAULT_MP_PLATFORM,
    warn: options.warn,
  })
}

export function getBackendForCapability(
  execution: ResolvedBackendExecution,
  backendId: string,
  capability: PlatformBackendCapability,
) {
  const backend = execution.get(backendId)
  return backend?.descriptor.capabilities[capability] ? backend : undefined
}

export type {
  PlatformBackend,
  PlatformBackendCapabilities,
  PlatformBackendCapability,
  PlatformBackendDescriptor,
  PlatformBackendDriver,
  PlatformBackendInlineConfigOptions,
  PlatformBackendMergeContext,
  ResolvedBackendExecution,
  ResolvedPlatformBackend,
} from './types'
