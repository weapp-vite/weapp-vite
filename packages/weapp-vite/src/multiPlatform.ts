import type { MpPlatform, MultiPlatformConfig, MultiPlatformProjectConfigs } from './types'
import path from 'pathe'
import { getSupportedMiniProgramPlatforms, resolveMiniPlatform } from './platform'

export const DEFAULT_MULTI_PLATFORM_PROJECT_CONFIG_ROOT = 'config'

export interface ResolvedMultiPlatformConfig {
  enabled: boolean
  projectConfigRoot: string
  targets: readonly MpPlatform[]
  projectConfigs?: MultiPlatformProjectConfigs
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

function isProjectConfigRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** 校验原生配置映射，避免拼错平台或把输出目录交给原生字段管理。 */
function resolveProjectConfigs(value: unknown): MultiPlatformProjectConfigs {
  if (!isProjectConfigRecord(value) || Object.keys(value).length === 0) {
    throw new TypeError('`weapp.multiPlatform.projectConfigs` 必须是非空的平台配置对象。')
  }

  for (const [platform, projectConfig] of Object.entries(value)) {
    if (resolveMiniPlatform(platform) !== platform) {
      throw new Error(`\`weapp.multiPlatform.projectConfigs\` 包含非标准平台键 "${platform}"，请使用 ${getSupportedMiniProgramPlatforms().join(', ')}。`)
    }
    if (!isProjectConfigRecord(projectConfig)) {
      throw new TypeError(`\`weapp.multiPlatform.projectConfigs.${platform}\` 必须是原生项目配置对象。`)
    }
    for (const key of ['miniprogramRoot', 'srcMiniprogramRoot', 'smartProgramRoot']) {
      if (key in projectConfig) {
        throw new Error(`\`weapp.multiPlatform.projectConfigs.${platform}.${key}\` 由构建器管理，请使用 build.outDir 设置代码输出目录。`)
      }
    }
    for (const key of ['appid', 'appId']) {
      if (projectConfig[key] !== undefined && typeof projectConfig[key] !== 'string') {
        throw new TypeError(`\`weapp.multiPlatform.projectConfigs.${platform}.${key}\` 必须是字符串。`)
      }
    }
  }

  return value
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
    const projectConfigs = record.projectConfigs === undefined
      ? undefined
      : resolveProjectConfigs(record.projectConfigs)
    if (projectConfigs && record.projectConfigRoot !== undefined) {
      throw new Error('`weapp.multiPlatform.projectConfigs` 与 `projectConfigRoot` 不能同时设置，请选择内联配置或原生 JSON 文件模式。')
    }
    if (projectConfigs && record.enabled === false) {
      throw new Error('`weapp.multiPlatform.projectConfigs` 不能与 `enabled: false` 同时设置。')
    }
    const targets = resolveMultiPlatformTargets(
      record.targets === undefined && projectConfigs ? Object.keys(projectConfigs) : record.targets,
    )
    return {
      enabled: record.enabled !== false,
      projectConfigRoot: normalizeMultiPlatformProjectConfigRoot(record.projectConfigRoot),
      targets,
      ...(projectConfigs ? { projectConfigs } : {}),
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
