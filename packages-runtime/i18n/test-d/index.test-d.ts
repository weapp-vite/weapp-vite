import type { I18nBehavior, I18nCatalog, I18nInstance } from '@weapp-vite/i18n'
import type {
  CompileNativeI18nResult,
  I18nMessageToken,
} from '@weapp-vite/i18n/compiler'
import {
  createI18n,
  getFallbackLocale,
  getI18nInstance,
  getLocale,
  I18n,
  I18nPage,
  initI18n,
  onLocaleChange,
  setLocale,
  t,
} from '@weapp-vite/i18n'
import {
  compileI18nCatalog,
  compileI18nMessage,
  compileNativeI18n,
  generateI18nWxsSource,
} from '@weapp-vite/i18n/compiler'
import { expectType } from 'tsd'

declare const catalog: I18nCatalog

expectType<I18nInstance>(createI18n(catalog))
expectType<I18nInstance>(initI18n(catalog))
expectType<I18nInstance | undefined>(getI18nInstance())
expectType<I18nBehavior>(I18n)
expectType<typeof Page>(I18nPage)
expectType<string>(t('key', { value: 1 }))
expectType<string>(getLocale())
expectType<void>(setLocale('en-US'))
expectType<string>(getFallbackLocale())
expectType<{ off: () => void }>(onLocaleChange(() => {}))
expectType<I18nCatalog>(compileI18nCatalog([], { defaultLocale: 'en-US' }))
expectType<I18nMessageToken[]>(compileI18nMessage('Hello {name}'))
expectType<Promise<CompileNativeI18nResult>>(compileNativeI18n({
  defaultLocale: 'en-US',
  srcRoot: 'miniprogram',
}))
expectType<string>(generateI18nWxsSource(catalog))
