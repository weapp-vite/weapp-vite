import type { CompileNativeI18nOptions, CompileNativeI18nResult, I18nCatalog, I18nGlobal, I18nLocaleFileInput, I18nMessages, I18nOptions } from '@weapp-vite/i18n/types'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

const messages: I18nMessages = { 'zh-CN': { welcome: '欢迎 {name}', page: { title: '首页' } } }
expectAssignable<I18nOptions>({ locale: 'zh-CN', fallbackLocale: 'en', messages })
expectAssignable<I18nCatalog>({
  defaultLocale: 'zh-CN',
  fallbackLocale: 'en',
  locales: ['zh-CN', 'en'],
  messages: { 'zh-CN': { welcome: ['欢迎 ', { key: 'name', source: '{name}' }] } },
})
expectAssignable<I18nLocaleFileInput>({ filePath: 'i18n/zh-CN.json', locale: 'zh-CN', messages })
expectAssignable<CompileNativeI18nOptions>({ srcRoot: 'src', outDir: 'dist', defaultLocale: 'zh-CN' })
expectNotAssignable<I18nOptions>({ locale: 'zh-CN', messages: { 'zh-CN': { title: 1 } } })
expectNotAssignable<I18nCatalog>({ defaultLocale: 'zh-CN', fallbackLocale: 'en', locales: [], messages: { en: { title: [{ key: 'name' }] } } })

declare const global: I18nGlobal
declare const result: CompileNativeI18nResult
expectType<string>(global.t('welcome', { name: '小明' }))
expectType<void>(global.onLocaleChange(() => {}).off())
expectType<readonly string[]>(global.availableLocales)
expectType<I18nCatalog>(result.catalog)
expectType<string[]>(result.files)
// @ts-expect-error 纯类型入口不得引入微信宿主全局声明。
void wx
// @ts-expect-error 纯类型入口不得引入 DOM 全局声明。
void document
