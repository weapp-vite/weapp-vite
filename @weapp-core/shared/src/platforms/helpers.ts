import type {
  MiniProgramPageIdentityRule,
  MiniProgramPlatformDescriptor,
  MiniProgramRuntimeCapabilities,
  MiniProgramRuntimeCapabilityName,
  MiniProgramTemplatePreset,
  MpPlatform,
} from './types'
import { DEFAULT_RUNTIME_CAPABILITIES, MINI_PROGRAM_PLATFORM_DESCRIPTORS } from './descriptors'

const LEADING_SLASH_RE = /^\/+/

function createMiniProgramPlatformRegistry(descriptors: readonly MiniProgramPlatformDescriptor[]) {
  const descriptorById = new Map<MpPlatform, MiniProgramPlatformDescriptor>()
  const aliasToId = new Map<string, MpPlatform>()
  const runtimeGlobalKeyToId = new Map<string, MpPlatform>()

  for (const descriptor of descriptors) {
    descriptorById.set(descriptor.id, descriptor)
    runtimeGlobalKeyToId.set(descriptor.runtime.globalObjectKey, descriptor.id)
    aliasToId.set(descriptor.id, descriptor.id)
    for (const alias of descriptor.aliases) {
      const normalized = alias.trim().toLowerCase()
      if (!normalized) {
        continue
      }
      aliasToId.set(normalized, descriptor.id)
    }
  }

  return {
    aliasToId,
    descriptorById,
    runtimeGlobalKeyToId,
  }
}

const {
  aliasToId: MINI_PROGRAM_PLATFORM_ALIAS_TO_ID,
  descriptorById: MINI_PROGRAM_PLATFORM_DESCRIPTOR_BY_ID,
  runtimeGlobalKeyToId: MINI_PROGRAM_RUNTIME_GLOBAL_KEY_TO_ID,
} = createMiniProgramPlatformRegistry(MINI_PROGRAM_PLATFORM_DESCRIPTORS)

const SUPPORTED_MINI_PROGRAM_PLATFORMS = Object.freeze(
  MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.id),
) as readonly MpPlatform[]

const ORDERED_RUNTIME_GLOBAL_KEYS = Object.freeze(
  Array.from(new Set(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.runtime.globalObjectKey))),
) as readonly string[]
const MAX_RUNTIME_RESOLVE_PRIORITY = Number.MAX_SAFE_INTEGER

function getOrderedRuntimeGlobalKeysByPriority(
  priorityKey: 'globalResolvePriority' | 'routeGlobalResolvePriority',
) {
  const ordered = [...MINI_PROGRAM_PLATFORM_DESCRIPTORS].sort((left, right) => {
    const leftPriority = left.runtime[priorityKey] ?? MAX_RUNTIME_RESOLVE_PRIORITY
    const rightPriority = right.runtime[priorityKey] ?? MAX_RUNTIME_RESOLVE_PRIORITY
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }
    return MINI_PROGRAM_PLATFORM_DESCRIPTORS.indexOf(left) - MINI_PROGRAM_PLATFORM_DESCRIPTORS.indexOf(right)
  })
  return Object.freeze(
    Array.from(new Set(ordered.map(descriptor => descriptor.runtime.globalObjectKey))),
  ) as readonly string[]
}
const ORDERED_RUNTIME_GLOBAL_KEYS_BY_RESOLVE_PRIORITY = getOrderedRuntimeGlobalKeysByPriority('globalResolvePriority')
const ORDERED_RUNTIME_GLOBAL_KEYS_BY_ROUTE_PRIORITY = getOrderedRuntimeGlobalKeysByPriority('routeGlobalResolvePriority')

/**
 * @description 小程序平台别名映射表。
 */
export const MINI_PROGRAM_PLATFORM_ALIASES: Readonly<Record<string, MpPlatform>> = Object.freeze(
  Object.fromEntries(MINI_PROGRAM_PLATFORM_ALIAS_TO_ID.entries()),
) as Readonly<Record<string, MpPlatform>>

/**
 * @description 标准化平台输入。
 */
export function normalizeMiniProgramPlatform(input?: string | null): string | undefined {
  const normalized = input?.trim().toLowerCase()
  return normalized || undefined
}

/**
 * @description 解析平台输入到标准平台标识。
 */
export function resolveMiniProgramPlatform(input?: string | null): MpPlatform | undefined {
  const normalized = normalizeMiniProgramPlatform(input)
  if (!normalized) {
    return undefined
  }
  return MINI_PROGRAM_PLATFORM_ALIAS_TO_ID.get(normalized)
}

/**
 * @description 返回所有受支持的小程序平台。
 */
export function getSupportedMiniProgramPlatforms(): readonly MpPlatform[] {
  return SUPPORTED_MINI_PROGRAM_PLATFORMS
}

/**
 * @description 返回默认小程序平台。
 */
export function getDefaultMiniProgramPlatform(): MpPlatform {
  return SUPPORTED_MINI_PROGRAM_PLATFORMS[0] ?? 'weapp'
}

/**
 * @description 获取平台描述。
 */
export function getMiniProgramPlatformDescriptor(platform: MpPlatform): MiniProgramPlatformDescriptor {
  const descriptor = MINI_PROGRAM_PLATFORM_DESCRIPTOR_BY_ID.get(platform)
  if (!descriptor) {
    throw new Error(`不支持的小程序平台 "${platform}"。`)
  }
  return descriptor
}

/**
 * @description 获取模板编译预设。
 */
export function getMiniProgramTemplatePreset(platform?: MpPlatform): MiniProgramTemplatePreset {
  if (!platform) {
    return 'wechat'
  }
  return getMiniProgramPlatformDescriptor(platform).compiler?.templatePreset ?? 'wechat'
}

/**
 * @description 判断平台是否允许自动补齐 app 样式入口。
 */
export function supportsMiniProgramAutoTouchAppStyle(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformDescriptor(platform).build?.autoTouchAppStyle === true
}

/**
 * @description 获取平台默认构建目标。
 */
export function getMiniProgramDefaultBuildTarget(platform?: MpPlatform): string | undefined {
  if (!platform) {
    return undefined
  }
  return getMiniProgramPlatformDescriptor(platform).build?.defaultBuildTarget
}

/**
 * @description 获取平台默认使用的类型包。
 */
export function getMiniProgramAppTypesPackage(platform?: MpPlatform): string {
  return getMiniProgramPlatformDescriptor(platform ?? getDefaultMiniProgramPlatform()).typescript?.appTypesPackage ?? 'miniprogram-api-typings'
}

/**
 * @description 获取平台模板指令前缀。
 */
export function getMiniProgramDirectivePrefix(platform?: MpPlatform): string {
  if (!platform) {
    return 'wx'
  }
  return getMiniProgramPlatformDescriptor(platform).wxml?.directivePrefix ?? 'wx'
}

/**
 * @description 获取宿主全局对象 key。
 */
export function getMiniProgramRuntimeGlobalKey(platform: MpPlatform): string {
  return getMiniProgramPlatformDescriptor(platform).runtime.globalObjectKey
}

/**
 * @description 获取默认宿主全局对象 key。
 */
export function getDefaultMiniProgramRuntimeGlobalKey(): string {
  return ORDERED_RUNTIME_GLOBAL_KEYS[0] ?? 'wx'
}

/**
 * @description 解析宿主全局对象 key 对应的平台。
 */
export function getMiniProgramPlatformByRuntimeGlobalKey(globalObjectKey?: string | null): MpPlatform | undefined {
  const normalized = globalObjectKey?.trim()
  if (!normalized) {
    return undefined
  }
  return MINI_PROGRAM_RUNTIME_GLOBAL_KEY_TO_ID.get(normalized)
}

/**
 * @description 返回 runtime 全局对象 key 的扫描优先级。
 */
export function getMiniProgramRuntimeGlobalKeys(platform?: MpPlatform): readonly string[] {
  if (platform) {
    return [getMiniProgramRuntimeGlobalKey(platform)]
  }
  return ORDERED_RUNTIME_GLOBAL_KEYS
}

/**
 * @description 返回按通用解析优先级排序的 runtime 全局对象 key。
 */
export function getMiniProgramRuntimeGlobalKeysByResolvePriority(platform?: MpPlatform): readonly string[] {
  if (platform) {
    return [getMiniProgramRuntimeGlobalKey(platform)]
  }
  return ORDERED_RUNTIME_GLOBAL_KEYS_BY_RESOLVE_PRIORITY
}

/**
 * @description 返回按路由解析优先级排序的 runtime 全局对象 key。
 */
export function getMiniProgramRouteRuntimeGlobalKeys(platform?: MpPlatform): readonly string[] {
  if (platform) {
    return [getMiniProgramRuntimeGlobalKey(platform)]
  }
  return ORDERED_RUNTIME_GLOBAL_KEYS_BY_ROUTE_PRIORITY
}

/**
 * @description 获取平台 runtime 宿主配置 key。
 */
export function getMiniProgramRuntimeHostConfigKey(platform?: MpPlatform): string {
  if (!platform) {
    return '__wxConfig'
  }
  return getMiniProgramPlatformDescriptor(platform).runtime.hostConfigKey
}

/**
 * @description 获取平台 runtime 能力描述。
 */
export function getMiniProgramRuntimeCapabilities(platform?: MpPlatform): MiniProgramRuntimeCapabilities {
  if (!platform) {
    return DEFAULT_RUNTIME_CAPABILITIES
  }
  return getMiniProgramPlatformDescriptor(platform).runtime.capabilities
}

/**
 * @description 判断平台是否支持指定 runtime 能力。
 */
export function supportsMiniProgramRuntimeCapability(
  platform: MpPlatform | undefined,
  capabilityName: MiniProgramRuntimeCapabilityName,
): boolean {
  return getMiniProgramRuntimeCapabilities(platform)[capabilityName] === true
}

function serializeMiniProgramPageIdentityRule(rule: MiniProgramPageIdentityRule) {
  return rule.source === 'field'
    ? `${rule.prefix}:${rule.field ?? ''}`
    : `${rule.prefix}:route`
}

function getMiniProgramPageIdentityRules(platform?: MpPlatform) {
  if (platform) {
    return getMiniProgramPlatformDescriptor(platform).runtime.pageIdentityRules
  }
  const merged = new Map<string, MiniProgramPageIdentityRule>()
  for (const descriptor of MINI_PROGRAM_PLATFORM_DESCRIPTORS) {
    for (const rule of descriptor.runtime.pageIdentityRules) {
      merged.set(serializeMiniProgramPageIdentityRule(rule), rule)
    }
  }
  return [...merged.values()]
}

/**
 * @description 根据平台描述解析页面身份 key。
 */
export function resolveMiniProgramPageKeys(page?: Record<string, any>, platform?: MpPlatform): string[] {
  if (!page || typeof page !== 'object') {
    return []
  }

  const keys: string[] = []
  for (const rule of getMiniProgramPageIdentityRules(platform)) {
    if (rule.source === 'route') {
      const route = typeof page.route === 'string' ? page.route.replace(LEADING_SLASH_RE, '') : ''
      if (route) {
        keys.push(`${rule.prefix}:${route}`)
      }
      continue
    }

    const field = rule.field
    if (!field) {
      continue
    }
    const value = page[field]
    if (typeof value === 'number' || typeof value === 'string') {
      keys.push(`${rule.prefix}:${String(value)}`)
    }
  }

  return Array.from(new Set(keys))
}
