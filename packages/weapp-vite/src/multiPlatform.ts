import type { MpPlatform, MultiPlatformConfig } from './types'
import path from 'pathe'
import { getSupportedMiniProgramPlatforms, resolveMiniPlatform } from './platform'

export const DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT = 'config'

export interface ResolvedMultiPlatformConfig {
  enabled: boolean
  projectConfigRoot: string
  targets: readonly MpPlatform[]
}

function normalizeMultiPlatformProjectConfigRoot(input: unknown) {
  if (typeof input !== 'string') {
    return DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT
  }

  const normalized = input.trim()
  return normalized || DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT
}

export function resolveMultiPlatformTargets(value: unknown): readonly MpPlatform[] {
  const supportedPlatforms = getSupportedMiniProgramPlatforms()
  if (value == null || value === 'all') {
    return supportedPlatforms
  }

  if (!Array.isArray(value)) {
    throw new TypeError('`weapp.multiPlatform.targets` 必须是平台数组或 "all"。')
  }

  const resolvedTargets: MpPlatform[] = []
  const invalidTargets: string[] = []

  for (const rawTarget of value) {
    const resolvedTarget = typeof rawTarget === 'string' ? resolveMiniPlatform(rawTarget) : undefined
    if (!resolvedTarget) {
      invalidTargets.push(String(rawTarget))
      continue
    }
    if (!resolvedTargets.includes(resolvedTarget)) {
      resolvedTargets.push(resolvedTarget)
    }
  }

  if (invalidTargets.length > 0) {
    throw new Error(`\`weapp.multiPlatform.targets\` 包含不支持的平台：${invalidTargets.join(', ')}`)
  }

  if (resolvedTargets.length === 0) {
    throw new Error('`weapp.multiPlatform.targets` 至少需要包含一个目标平台。')
  }

  return resolvedTargets
}

export function resolveMultiPlatformConfig(value: unknown): ResolvedMultiPlatformConfig {
  if (!value) {
    return {
      enabled: false,
      projectConfigRoot: DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT,
      targets: getSupportedMiniProgramPlatforms(),
    }
  }

  if (value === true) {
    return {
      enabled: true,
      projectConfigRoot: DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT,
      targets: getSupportedMiniProgramPlatforms(),
    }
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as MultiPlatformConfig
    return {
      enabled: record.enabled !== false,
      projectConfigRoot: normalizeMultiPlatformProjectConfigRoot(record.projectConfigRoot),
      targets: resolveMultiPlatformTargets(record.targets),
    }
  }

  return {
    enabled: false,
    projectConfigRoot: DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT,
    targets: getSupportedMiniProgramPlatforms(),
  }
}

export function isMultiPlatformEnabled(value: Pick<ResolvedMultiPlatformConfig, 'enabled'> | boolean | undefined) {
  if (typeof value === 'boolean') {
    return value
  }

  return value?.enabled === true
}

export function supportsMultiPlatformTarget(
  multiPlatform: Pick<ResolvedMultiPlatformConfig, 'targets'>,
  platform: MpPlatform,
) {
  return multiPlatform.targets.includes(platform)
}

export function resolveMultiPlatformProjectConfigDir(
  multiPlatform: Pick<ResolvedMultiPlatformConfig, 'projectConfigRoot'>,
  platform: MpPlatform,
) {
  return path.join(
    multiPlatform.projectConfigRoot || DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT,
    platform,
  )
}
