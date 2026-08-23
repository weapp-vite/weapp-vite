import type {
  I18nCatalog,
  I18nGlobal,
  I18nInstance,
  I18nMessageToken,
  I18nOptions,
} from '@weapp-vite/i18n'
import type { CompileNativeI18nResult } from '@weapp-vite/i18n/compiler'
import { createI18n } from '@weapp-vite/i18n'
import {
  compileI18nCatalog,
  compileI18nMessage,
  compileNativeI18n,
  generateI18nWxsSource,
} from '@weapp-vite/i18n/compiler'
import { expectAssignable, expectType } from 'tsd'

declare const catalog: I18nCatalog
declare const options: I18nOptions
declare const i18n: I18nInstance

expectAssignable<I18nOptions>({
  locale: 'zh-CN',
  messages: { 'zh-CN': { greeting: '你好' } },
})
expectType<I18nInstance>(createI18n(options))
expectType<I18nInstance>(createI18n(catalog))
expectType<I18nGlobal>(i18n.global)
expectType<string>(i18n.global.t('key', { value: 1 }))
expectType<string>(i18n.global.locale)
expectType<void>(i18n.global.onLocaleChange(() => {}).off())
expectType<typeof Page>(i18n.page)
expectType<WechatMiniprogram.Behavior.Identifier>(i18n.behavior)
expectType<I18nCatalog>(compileI18nCatalog([], { defaultLocale: 'en-US' }))
expectType<I18nMessageToken[]>(compileI18nMessage('Hello {name}'))
expectType<Promise<CompileNativeI18nResult>>(compileNativeI18n({
  defaultLocale: 'en-US',
  srcRoot: 'miniprogram',
}))
expectType<string>(generateI18nWxsSource(catalog))
