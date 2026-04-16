import type { MiniProgramPlatformAdapter, OutputExtensions } from './platforms/types'
import type { MpPlatform } from './types'
import {
  getSupportedMiniProgramPlatforms as getSharedSupportedMiniProgramPlatforms,
  normalizeMiniProgramPlatform,
  resolveMiniProgramPlatform,
  MINI_PROGRAM_PLATFORM_ALIASES as SHARED_MINI_PROGRAM_PLATFORM_ALIASES,
} from '@weapp-core/shared'
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

export interface ProjectPlatformOptions {
  projectConfigFileName: string
  projectConfigRootKeys: readonly string[]
  usesProjectRootNpmDir: boolean
}

export interface IdePlatformOptions {
  requiresOpenPlatformArg: boolean
  defaultProjectRoot?: string
}

export interface JsonPlatformOptions {
  normalizeUsingComponents: boolean
  fillComponentGenericsDefault: boolean
  rewriteBundleNpmImports: boolean
}

export interface NpmPlatformOptions {
  distDirName: string
  preservedDirNames: readonly string[]
  importPrefix: string
  normalizeImportPath: boolean
  normalizeMiniprogramPackage: boolean
  copyEsModuleDirectory: boolean
  hoistNestedDependencies: boolean
  shouldRebuildCachedPackage: boolean
}

export interface TypeScriptPlatformOptions {
  appTypesPackage: string
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
const SUPPORTED_MINI_PROGRAM_PLATFORMS = getSharedSupportedMiniProgramPlatforms()

export const MINI_PLATFORM_ALIASES: Readonly<Record<string, MpPlatform>> = Object.freeze(
  {
    ...SHARED_MINI_PROGRAM_PLATFORM_ALIASES,
    ...Object.fromEntries(PLATFORM_ALIAS_TO_ID.entries()),
  },
) as Readonly<Record<string, MpPlatform>>

export function getSupportedMiniProgramPlatforms(): readonly MpPlatform[] {
  return SUPPORTED_MINI_PROGRAM_PLATFORMS
}

export function normalizeMiniPlatform(input?: string | null): string | undefined {
  return normalizeMiniProgramPlatform(input)
}

export function resolveMiniPlatform(input?: string | null): MpPlatform | undefined {
  const resolved = resolveMiniProgramPlatform(input)
  if (resolved) {
    return resolved
  }
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

export function getIdePlatformOptions(platform?: MpPlatform): IdePlatformOptions {
  return {
    requiresOpenPlatformArg: platform
      ? getMiniProgramPlatformAdapter(platform).ide?.requiresOpenPlatformArg === true
      : false,
    defaultProjectRoot: platform ? getMiniProgramPlatformAdapter(platform).ide?.defaultProjectRoot : undefined,
  }
}

export function shouldPassPlatformArgToIdeOpen(platform?: MpPlatform): boolean {
  return getIdePlatformOptions(platform).requiresOpenPlatformArg
}

export function getDefaultIdeProjectRoot(platform?: MpPlatform): string | undefined {
  return getIdePlatformOptions(platform).defaultProjectRoot
}

export function getPlatformOutputExtensions(platform: MpPlatform): OutputExtensions {
  return {
    ...getMiniProgramPlatformAdapter(platform).outputExtensions,
  }
}

export function getJsonPlatformOptions(platform?: MpPlatform): JsonPlatformOptions {
  const json = platform ? getMiniProgramPlatformAdapter(platform).json : undefined
  return {
    normalizeUsingComponents: json?.normalizeUsingComponents === true,
    fillComponentGenericsDefault: json?.fillComponentGenericsDefault === true,
    rewriteBundleNpmImports: json?.rewriteBundleNpmImports === true,
  }
}

export function shouldNormalizeUsingComponents(platform?: MpPlatform): boolean {
  return getJsonPlatformOptions(platform).normalizeUsingComponents
}

export function shouldFillComponentGenericsDefault(platform?: MpPlatform): boolean {
  return getJsonPlatformOptions(platform).fillComponentGenericsDefault
}

export function shouldRewriteBundleNpmImports(platform?: MpPlatform): boolean {
  return getJsonPlatformOptions(platform).rewriteBundleNpmImports
}

export function getNpmPlatformOptions(
  platform?: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): NpmPlatformOptions {
  const npm = platform ? getMiniProgramPlatformAdapter(platform).npm : undefined
  const adapter = platform ? getMiniProgramPlatformAdapter(platform) : undefined
  const distDirName = npm?.distDirName?.(options) ?? 'miniprogram_npm'
  return {
    distDirName,
    preservedDirNames: adapter?.resolvePreservedNpmDirNames(options) ?? ['miniprogram_npm'],
    importPrefix: `/${distDirName}/`,
    normalizeImportPath: npm?.normalizeImportPath === true,
    normalizeMiniprogramPackage: npm?.normalizeMiniprogramPackage === true,
    copyEsModuleDirectory: npm?.copyEsModuleDirectory === true,
    hoistNestedDependencies: npm?.hoistNestedDependencies === true,
    shouldRebuildCachedPackage: npm?.shouldRebuildCachedPackage === true,
  }
}

export function getPreservedNpmDirNames(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): readonly string[] {
  return getNpmPlatformOptions(platform, options).preservedDirNames
}

export function getPlatformNpmDistDirName(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): string {
  return getNpmPlatformOptions(platform, options).distDirName
}

export function shouldNormalizePlatformNpmImportPath(platform?: MpPlatform): boolean {
  return getNpmPlatformOptions(platform).normalizeImportPath
}

export function getPlatformNpmImportPrefix(
  platform: MpPlatform,
  options?: {
    alipayNpmMode?: string
  },
): string {
  return getNpmPlatformOptions(platform, options).importPrefix
}

export function stripExplicitNpmImportPrefix(importee: string): string {
  return importee.replace(NPM_PROTOCOL_RE, '').replace(EXPLICIT_NPM_DIR_RE, '')
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

  const normalized = stripExplicitNpmImportPrefix(importee)
  return `${getPlatformNpmImportPrefix(platform, options)}${normalized.replace(LEADING_SLASH_RE, '')}`
}

export function shouldRebuildCachedMiniprogramPackage(platform: MpPlatform): boolean {
  return getNpmPlatformOptions(platform).shouldRebuildCachedPackage
}

export function shouldNormalizeMiniprogramPackage(platform: MpPlatform): boolean {
  return getNpmPlatformOptions(platform).normalizeMiniprogramPackage
}

export function shouldCopyEsModuleDirectory(platform: MpPlatform): boolean {
  return getNpmPlatformOptions(platform).copyEsModuleDirectory
}

export function shouldHoistNestedMiniprogramDependencies(platform: MpPlatform): boolean {
  return getNpmPlatformOptions(platform).hoistNestedDependencies
}

export function getProjectPlatformOptions(platform: MpPlatform): ProjectPlatformOptions {
  const adapter = getMiniProgramPlatformAdapter(platform)
  return {
    projectConfigFileName: adapter.projectConfigFileName,
    projectConfigRootKeys: adapter.projectConfigRootKeys,
    usesProjectRootNpmDir: adapter.usesProjectRootNpmDir === true,
  }
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

export function shouldUseProjectRootNpmDir(platform: MpPlatform): boolean {
  return getProjectPlatformOptions(platform).usesProjectRootNpmDir
}

export function getTypeScriptPlatformOptions(platform?: MpPlatform): TypeScriptPlatformOptions {
  return {
    appTypesPackage: platform
      ? (getMiniProgramPlatformAdapter(platform).typescript?.appTypesPackage ?? 'miniprogram-api-typings')
      : 'miniprogram-api-typings',
  }
}

export function getPlatformAppTypesPackage(platform?: MpPlatform): string {
  return getTypeScriptPlatformOptions(platform).appTypesPackage
}
