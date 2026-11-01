import type { MiniProgramPlatformDescriptor, MiniProgramTemplatePreset, MpPlatform } from './types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from './descriptors'
import { getDefaultMiniProgramPlatform } from './runtime/helpers'

export * from './runtime/helpers'
export { getMiniProgramDirectivePrefix, getSupportedMiniProgramDirectivePrefixes } from './runtime/template'

const MINI_PROGRAM_PLATFORM_DESCRIPTOR_BY_ID = new Map(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => [descriptor.id, descriptor]))

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
export function getMiniProgramScriptModuleOptions(platform?: MpPlatform, extension = 'wxs') {
  const normalized = extension.replace(/^\./, '')
  const descriptor = platform ? getMiniProgramPlatformDescriptor(platform) : undefined
  return {
    tag: descriptor?.scriptModuleTagByExtension?.[normalized] ?? (normalized === 'sjs' ? 'sjs' : 'wxs'),
    format: descriptor?.scriptModule?.format ?? (!platform && normalized === 'sjs' ? 'esm' : 'commonjs'),
    sourceAttribute: descriptor?.scriptModule?.sourceAttribute ?? 'src',
    moduleAttribute: descriptor?.scriptModule?.moduleAttribute ?? 'module',
  } as const
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
