import type { LanguagePlatform } from '../types'
import type { LanguageProfile, TemplateDirectives } from './types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared/platforms'

function directives(prefix: string, separator = ':'): TemplateDirectives {
  const attribute = (name: string) => `${prefix}${separator}${name}`
  return {
    if: attribute('if'),
    elif: attribute('elif'),
    else: attribute('else'),
    for: attribute('for'),
    forItem: attribute('for-item'),
    forIndex: attribute('for-index'),
    key: attribute('key'),
  }
}

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

const core: LanguageProfile[] = MINI_PROGRAM_PLATFORM_DESCRIPTORS.map(descriptor => ({
  platform: descriptor.id,
  support: 'core',
  templateExtensions: [`.${descriptor.outputExtensions.wxml}`],
  styleExtensions: [`.${descriptor.outputExtensions.wxss}`],
  scriptExtensions: descriptor.outputExtensions.wxs ? [`.${descriptor.outputExtensions.wxs}`] : ['.sjs'],
  scriptModule: descriptor.id === 'alipay' ? { tag: 'import-sjs', sourceAttribute: 'from', moduleAttribute: 'name' } : { tag: descriptor.id === 'swan' ? 'import-sjs' : descriptor.id === 'tt' ? 'sjs' : 'wxs', sourceAttribute: 'src', moduleAttribute: 'module' },
  directives: directives(descriptor.wxml?.directivePrefix ?? 'wx', descriptor.id === 'swan' ? '-' : ':'),
  events: { style: descriptor.wxml?.eventBindingStyle === 'alipay' ? 'alipay' : 'bind' },
  rawTags: ['wxs', 'sjs', 'filter', 'script', 'import-sjs'],
  documentation: sources(descriptor.id),
}))

const additional: LanguageProfile[] = [
  { platform: 'qq', extension: '.qml', style: '.qss', prefix: 'qq', script: '.wxs' },
  { platform: 'ks', extension: '.ksml', style: '.css', prefix: 'ks', script: '.ks' },
  { platform: 'ty', extension: '.tyml', style: '.tyss', prefix: 'ty', script: '.sjs' },
].map(({ platform, extension, style, prefix, script }) => ({
  platform: platform as LanguagePlatform,
  support: 'language-only',
  templateExtensions: [extension],
  styleExtensions: [style],
  scriptExtensions: [script],
  scriptModule: { tag: platform === 'ks' ? 'ks' : platform === 'ty' ? 'sjs' : 'wxs', sourceAttribute: 'src', moduleAttribute: 'module' },
  directives: directives(prefix),
  events: { style: 'bind' },
  rawTags: ['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'],
  documentation: sources(platform as LanguagePlatform),
}))

/** 语言能力登记不扩展构建平台；官方文档无统一版本号时明确标记未版本化。 */
export const languageProfiles: readonly LanguageProfile[] = [...core, ...additional]
