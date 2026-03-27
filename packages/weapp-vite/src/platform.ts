import type { MiniProgramPlatformAdapter } from './platforms/types'
import type { MpPlatform } from './types'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from './platforms/adapters'

export const DEFAULT_MP_PLATFORM: MpPlatform = 'weapp'
const NPM_PROTOCOL_RE = /^npm:/
const EXPLICIT_NPM_DIR_RE = /^\/(?:miniprogram_npm|node_modules)\//
const LEADING_SLASH_RE = /^\/+/

export interface WxmlPlatformTransformOptions {
  eventBindingStyle: 'default' | 'alipay'
  directivePrefix: string
  normalizeComponentTagName: boolean
  normalizeVueTemplate: boolean
  emitGenericPlaceholder: boolean
}

export interface ScriptModulePlatformOptions {
  tagByExtension: Readonly<Partial<Record<string, string>>>
}

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

export function shouldNormalizeUsingComponents(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformAdapter(platform).json?.normalizeUsingComponents === true
}

export function shouldFillComponentGenericsDefault(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformAdapter(platform).json?.fillComponentGenericsDefault === true
}

export function shouldRewriteBundleNpmImports(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformAdapter(platform).json?.rewriteBundleNpmImports === true
}

export function getPlatformNpmDistDirName(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): string {
  return getMiniProgramPlatformAdapter(platform).npm?.distDirName?.(options) ?? 'miniprogram_npm'
}

export function shouldNormalizePlatformNpmImportPath(platform?: MpPlatform): boolean {
  if (!platform) {
    return false
  }
  return getMiniProgramPlatformAdapter(platform).npm?.normalizeImportPath === true
}

export function getPlatformNpmImportPrefix(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): string {
  return `/${getPlatformNpmDistDirName(platform, options)}/`
}

export function normalizePlatformNpmImportPath(
  platform: MpPlatform,
  importee: string,
  options?: {
    alipayNpmMode?: string
  },
): string {
  if (!shouldNormalizePlatformNpmImportPath(platform)) {
    return importee
  }

  const normalized = importee.replace(NPM_PROTOCOL_RE, '').replace(EXPLICIT_NPM_DIR_RE, '')
  return `${getPlatformNpmImportPrefix(platform, options)}${normalized.replace(LEADING_SLASH_RE, '')}`
}

export function shouldRebuildCachedMiniprogramPackage(platform: MpPlatform): boolean {
  return getMiniProgramPlatformAdapter(platform).npm?.shouldRebuildCachedPackage === true
}

export function shouldNormalizeMiniprogramPackage(platform: MpPlatform): boolean {
  return getMiniProgramPlatformAdapter(platform).npm?.normalizeMiniprogramPackage === true
}

export function shouldCopyEsModuleDirectory(platform: MpPlatform): boolean {
  return getMiniProgramPlatformAdapter(platform).npm?.copyEsModuleDirectory === true
}

export function shouldHoistNestedMiniprogramDependencies(platform: MpPlatform): boolean {
  return getMiniProgramPlatformAdapter(platform).npm?.hoistNestedDependencies === true
}

export function getScriptModulePlatformOptions(platform?: MpPlatform): ScriptModulePlatformOptions {
  return {
    tagByExtension: platform ? (getMiniProgramPlatformAdapter(platform).scriptModuleTagByExtension ?? {}) : {},
  }
}

export function getWxmlPlatformTransformOptions(platform?: MpPlatform): WxmlPlatformTransformOptions {
  const wxml = platform ? getMiniProgramPlatformAdapter(platform).wxml : undefined

  return {
    eventBindingStyle: wxml?.eventBindingStyle ?? 'default',
    directivePrefix: wxml?.directivePrefix ?? 'wx',
    normalizeComponentTagName: wxml?.normalizeComponentTagName === true,
    normalizeVueTemplate: wxml?.normalizeVueTemplate === true,
    emitGenericPlaceholder: wxml?.emitGenericPlaceholder === true,
  }
}

export function getWxmlEventBindingStyle(platform?: MpPlatform): 'default' | 'alipay' {
  return getWxmlPlatformTransformOptions(platform).eventBindingStyle
}

export function getWxmlDirectivePrefix(platform?: MpPlatform): string {
  return getWxmlPlatformTransformOptions(platform).directivePrefix
}

export function shouldNormalizeWxmlComponentTagName(platform?: MpPlatform): boolean {
  return getWxmlPlatformTransformOptions(platform).normalizeComponentTagName
}

export function shouldNormalizeVueTemplateForPlatform(platform?: MpPlatform): boolean {
  return getWxmlPlatformTransformOptions(platform).normalizeVueTemplate
}

export function shouldEmitGenericPlaceholderAsset(platform?: MpPlatform): boolean {
  return getWxmlPlatformTransformOptions(platform).emitGenericPlaceholder
}

export function getPlatformScriptModuleTag(platform: MpPlatform | undefined, scriptModuleExtension: string | undefined) {
  if (!scriptModuleExtension) {
    return undefined
  }
  return getScriptModulePlatformOptions(platform).tagByExtension[scriptModuleExtension]
}

export function getPlatformAppTypesPackage(platform?: MpPlatform): string {
  if (!platform) {
    return 'miniprogram-api-typings'
  }
  return getMiniProgramPlatformAdapter(platform).typescript?.appTypesPackage ?? 'miniprogram-api-typings'
}
