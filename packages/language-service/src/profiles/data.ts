import type { LanguagePlatform } from '../types'
import type { LanguageProfile } from './types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared/platforms'
import { getTemplatePreset } from '@weapp-vite/wxml/presets'

const documentation: Record<LanguagePlatform, string> = {
  weapp: 'https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/',
  alipay: 'https://opendocs.alipay.com/mini/framework/axml',
  tt: 'https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/framework/view/ttml',
  swan: 'https://smartprogram.baidu.com/docs/develop/framework/dev/',
  jd: 'https://mp-docs.jd.com/',
  xhs: 'https://miniapp.xiaohongshu.com/doc/DC508264',
  qq: 'https://q.qq.com/wiki/develop/miniprogram/component/',
  ks: 'https://mp.kuaishou.com/docs/develop/frame/page/dev_ksml.html',
  ty: 'https://developer.tuya.com/cn/miniapp/develop/miniapp/framework/tyml',
}

function sources(platform: LanguagePlatform): LanguageProfile['documentation'] {
  return [{ url: documentation[platform], version: 'unversioned', retrievedAt: '2026-10-30' }]
}

const corePlatforms = new Set<string>(MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.id))
const platforms: LanguagePlatform[] = [...MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.id), 'qq', 'ks', 'ty']

/** 语言能力登记不扩展构建平台；模板语言事实统一来自纯数据预设。 */
export const languageProfiles: readonly LanguageProfile[] = platforms.map<LanguageProfile>((platform) => {
  const preset = getTemplatePreset(platform)
  return {
    platform,
    support: corePlatforms.has(platform) ? 'core' : 'language-only',
    templateExtensions: [preset.templateExtension],
    styleExtensions: [preset.styleExtension],
    scriptExtensions: [`.${preset.portableScriptModule.extension}`, ...preset.nativeScriptModules.map(module => `.${module.extension}`)],
    scriptModule: { tag: preset.portableScriptModule.tag, sourceAttribute: preset.portableScriptModule.sourceAttribute, moduleAttribute: preset.portableScriptModule.moduleAttribute },
    directives: { ...preset.directives },
    events: { style: preset.eventStyle === 'alipay' ? 'alipay' : 'bind' },
    rawTags: preset.compatibilityDialect.rawTags,
    documentation: sources(platform),
  }
})
