import type { MpPlatform } from '../types'
import { MINI_PROGRAM_PLATFORM_ADAPTERS } from './adapters'

const PORTABLE_TEMPLATE_EXTENSIONS = ['wxml', 'html'] as const
const PORTABLE_STYLE_EXTENSIONS = ['wxss', 'css', 'scss', 'less', 'sass', 'styl'] as const

function uniqueExtensions(extensions: readonly (string | undefined)[]) {
  return Array.from(new Set(extensions.filter((extension): extension is string => Boolean(extension))))
}

export const ALL_NATIVE_TEMPLATE_EXTENSIONS = uniqueExtensions(
  MINI_PROGRAM_PLATFORM_ADAPTERS.map(adapter => adapter.outputExtensions.wxml),
)
export const ALL_NATIVE_STYLE_EXTENSIONS = uniqueExtensions(
  MINI_PROGRAM_PLATFORM_ADAPTERS.map(adapter => adapter.outputExtensions.wxss),
)
export const ALL_NATIVE_STYLE_RESOLVER_EXTENSIONS = ALL_NATIVE_STYLE_EXTENSIONS.filter(
  extension => extension !== 'css',
)
export const ALL_SOURCE_TEMPLATE_EXTENSIONS = uniqueExtensions([
  ...PORTABLE_TEMPLATE_EXTENSIONS,
  ...ALL_NATIVE_TEMPLATE_EXTENSIONS,
])
export const ALL_SOURCE_STYLE_EXTENSIONS = uniqueExtensions([
  ...PORTABLE_STYLE_EXTENSIONS,
  ...ALL_NATIVE_STYLE_EXTENSIONS,
])

function getAdapter(platform?: MpPlatform) {
  return platform
    ? MINI_PROGRAM_PLATFORM_ADAPTERS.find(adapter => adapter.id === platform)
    : undefined
}

/**
 * 返回当前平台的模板源码选择顺序。
 * 原生平台后缀优先，便携源码后缀作为兼容回退。
 */
export function getSourceTemplateExtensions(platform?: MpPlatform) {
  const nativeExtension = getAdapter(platform)?.outputExtensions.wxml
  return platform
    ? uniqueExtensions([nativeExtension, ...PORTABLE_TEMPLATE_EXTENSIONS])
    : ALL_SOURCE_TEMPLATE_EXTENSIONS
}

/**
 * 返回当前平台的样式源码选择顺序。
 * 原生平台后缀优先，预处理器和便携样式后缀继续可用。
 */
export function getSourceStyleExtensions(platform?: MpPlatform) {
  const nativeExtension = getAdapter(platform)?.outputExtensions.wxss
  return platform
    ? uniqueExtensions([nativeExtension, ...PORTABLE_STYLE_EXTENSIONS])
    : ALL_SOURCE_STYLE_EXTENSIONS
}

export function isSourceTemplateExtension(extension: string) {
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  return getSourceTemplateExtensions().includes(normalized)
}

export function isSourceStyleExtension(extension: string) {
  const normalized = extension.startsWith('.') ? extension.slice(1) : extension
  return getSourceStyleExtensions().includes(normalized)
}

export function isNativeTemplateSource(filePath: string, platform?: MpPlatform) {
  const nativeExtension = getAdapter(platform)?.outputExtensions.wxml
  return Boolean(nativeExtension && filePath.endsWith(`.${nativeExtension}`))
}
