import type { TemplateScriptModule, TemplateScriptModuleRecipe } from '@weapp-vite/wxml/presets'
import type { MiniProgramNativeScriptModule, MiniProgramPlatformDescriptor, MiniProgramTemplatePreset, MiniProgramTemplateProjection, MpPlatform } from './types'
import { getTemplatePreset, legacyScriptModuleRecipes } from '@weapp-vite/wxml/presets'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from './descriptors'
import { getDefaultMiniProgramPlatform } from './runtime/helpers'
import { templateNativeScriptModules } from './template'

export * from './runtime/helpers'
export { getMiniProgramDirectivePrefix, getSupportedMiniProgramDirectivePrefixes } from './runtime/template'

const MINI_PROGRAM_PLATFORM_DESCRIPTOR_BY_ID = new Map(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => [descriptor.id, descriptor]))
const emptyNativeScriptModules: readonly MiniProgramNativeScriptModule[] = Object.freeze([])
const templateProjections = new Map<MpPlatform, MiniProgramTemplateProjection>()
/** 冻结 recipe 在初始化时建扩展名索引；可变 descriptor 仍在每次查询时读取。 */
function indexScriptModuleRecipe(recipe: TemplateScriptModuleRecipe) {
  const modules: Record<string, TemplateScriptModule | undefined> = Object.create(null)
  for (const module of recipe.scriptModules) {
    modules[module.extension] = module
  }
  return Object.freeze({ defaultScriptModule: recipe.defaultScriptModule, modules: Object.freeze(modules) })
}

const scriptModuleFallbacks = Object.freeze({
  unprofiled: indexScriptModuleRecipe(legacyScriptModuleRecipes.unprofiled),
  platform: indexScriptModuleRecipe(legacyScriptModuleRecipes.platform),
})

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
 * @description 获取原生模板脚本契约；未传平台时保留既有按扩展名选择的兼容行为。
 */
export function getMiniProgramScriptModuleOptions(platform?: MpPlatform, extension = legacyScriptModuleRecipes.unprofiled.defaultScriptModule.extension) {
  const normalized = extension.replace(/^\./, '')
  const descriptor = platform ? getMiniProgramPlatformDescriptor(platform) : undefined
  let native: MiniProgramNativeScriptModule | undefined
  if (descriptor?.nativeScriptModules) {
    for (const module of descriptor.nativeScriptModules) {
      if (module.extension === normalized) {
        native = module
        break
      }
    }
  }
  const recipe = scriptModuleFallbacks[platform ? 'platform' : 'unprofiled']
  const fallback = recipe.modules[normalized] ?? recipe.defaultScriptModule
  const tags = descriptor?.scriptModuleTagByExtension
  const mappedTag = tags && Object.prototype.hasOwnProperty.call(tags, normalized) ? tags[normalized] : undefined
  return {
    tag: native?.tag ?? mappedTag ?? fallback.tag,
    format: native?.format ?? descriptor?.scriptModule?.format ?? fallback.format,
    sourceAttribute: native?.sourceAttribute ?? descriptor?.scriptModule?.sourceAttribute ?? fallback.sourceAttribute,
    moduleAttribute: native?.moduleAttribute ?? descriptor?.scriptModule?.moduleAttribute ?? fallback.moduleAttribute,
  } as const
}

/** 获取额外原生脚本契约；无平台身份时不将同名组件推断为脚本。 */
export function getMiniProgramNativeScriptModules(platform?: MpPlatform): readonly MiniProgramNativeScriptModule[] {
  return platform ? getMiniProgramPlatformDescriptor(platform).nativeScriptModules ?? emptyNativeScriptModules : emptyNativeScriptModules
}

/**
 * @description 获取语言服务、构建扫描和 Web 输入共同使用的轻量模板投影。
 */
export function getMiniProgramTemplateProjection(platform: MpPlatform): MiniProgramTemplateProjection {
  getMiniProgramPlatformDescriptor(platform)
  const existing = templateProjections.get(platform)
  if (existing) {
    return existing
  }
  const preset = getTemplatePreset(platform)
  const projection: MiniProgramTemplateProjection = Object.freeze({
    platform,
    templateExtension: preset.templateExtension,
    styleExtension: preset.styleExtension,
    syntax: preset.dialect.syntax,
    compatibilityRawTags: preset.compatibilityDialect.rawTags,
    portableScriptModule: { ...preset.portableScriptModule },
    nativeScriptModules: templateNativeScriptModules(preset),
    directivePrefix: preset.directivePrefix,
    directiveSeparator: preset.directiveSeparator,
    eventStyle: preset.eventStyle,
  })
  templateProjections.set(platform, projection)
  return projection
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
