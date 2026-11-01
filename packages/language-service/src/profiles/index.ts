import type { LanguageOptions, LanguagePlatform } from '../types'
import type { LanguageProfile } from './types'
import picomatch from 'picomatch'
import { languageProfiles } from './data'

export const TEMPLATE_EXTENSIONS = [...new Set(languageProfiles.flatMap(profile => profile.templateExtensions))]
export const STYLE_EXTENSIONS = [...new Set(languageProfiles.flatMap(profile => profile.styleExtensions))]
export const SCRIPT_EXTENSIONS = [...new Set(languageProfiles.flatMap(profile => profile.scriptExtensions))]
export const FILTER_EXTENSIONS = ['.filter.js', '.filter.ts']

/** 同时识别原生脚本模块及需要先编译的 TypeScript/JavaScript 模块源码。 */
export function isScriptModuleFile(fileName: string): boolean {
  const normalized = fileName.toLowerCase().replace(/\.[jt]s$/, '')
  return FILTER_EXTENSIONS.some(extension => fileName.toLowerCase().endsWith(extension)) || SCRIPT_EXTENSIONS.some(extension => fileName.toLowerCase().endsWith(extension) || normalized.endsWith(extension))
}

export { languageProfiles } from './data'
export type { LanguageProfile, TemplateDirectives } from './types'

/** 获取语言方言，不把语言专用项目扩展为编译目标。 */
export function getLanguageProfile(platform: LanguagePlatform): LanguageProfile {
  const profile = languageProfiles.find(profile => profile.platform === platform)
  if (!profile) {
    throw new Error(`未登记的小程序语言平台：${platform}`)
  }
  return profile
}

/** 使用后匹配 glob、显式平台、唯一后缀和项目默认平台依次解析方言。 */
export function resolveLanguageProfile(fileName: string, options: LanguageOptions = {}): LanguageProfile | undefined {
  const normalized = fileName.replaceAll('\\', '/')
  let platform = options.platform
  for (const override of options.overrides ?? []) {
    if (picomatch(override.files, { dot: true })(normalized)) {
      platform = override.platform
    }
  }
  if (platform) {
    return getLanguageProfile(platform)
  }
  if (FILTER_EXTENSIONS.some(extension => normalized.toLowerCase().endsWith(extension))) {
    return getLanguageProfile('swan')
  }
  const matches = languageProfiles.filter(profile => [...profile.templateExtensions, ...profile.styleExtensions].some(extension => normalized.toLowerCase().endsWith(extension)))
  return matches.length === 1 ? matches[0] : options.defaultPlatform ? getLanguageProfile(options.defaultPlatform) : undefined
}

/** 所有原生样式扩展共用 CSS 语法；预处理器后缀不会被强制改为 CSS。 */
export function getNativeStyleExtensions(): string[] {
  return [...new Set(languageProfiles.flatMap(profile => profile.styleExtensions))]
}

/** 返回项目收集器和编辑器共同使用的模板后缀。 */
export function getTemplateExtensions(): string[] {
  return [...new Set(languageProfiles.flatMap(profile => profile.templateExtensions))]
}

/** 返回编辑器与脚手架共用的关联；提供全新对象，避免调用方互相修改。 */
export function getLanguageFileAssociations(): Record<string, string> {
  return Object.fromEntries([
    ...TEMPLATE_EXTENSIONS.map(extension => [`*${extension}`, extension === '.wxml' ? 'wxml' : 'miniprogram-template']),
    ...STYLE_EXTENSIONS.map(extension => [`*${extension}`, 'css']),
    ...SCRIPT_EXTENSIONS.flatMap(extension => ['', '.js', '.ts'].map(suffix => [`*${extension}${suffix}`, 'miniprogram-script'])),
    ...FILTER_EXTENSIONS.map(extension => [`*${extension}`, 'miniprogram-script']),
  ])
}

/** 返回循环属性名称，供提示、作用域分析及跳转共同使用。 */
export function getTemplateLoopAttributes(platform: LanguagePlatform = 'weapp') {
  const { for: forAttribute, forItem, forIndex, key } = getLanguageProfile(platform).directives
  return { for: forAttribute, forItem, forIndex, key }
}

/** 按当前平台识别事件属性，保留支付宝事件名的大小写约定。 */
export function isEventAttribute(name: string, profileOrPlatform: LanguageProfile | LanguagePlatform = 'weapp'): boolean {
  const profile = typeof profileOrPlatform === 'string' ? getLanguageProfile(profileOrPlatform) : profileOrPlatform
  return profile.events.style === 'alipay'
    ? /^(?:on|catch|capture|captureCatch)[A-Z]/.test(name)
    : /^(?:(?:capture-)?(?:bind|catch)|mut-bind)(?::[\w:-]+|[A-Za-z][\w:-]*)$/.test(name)
}
