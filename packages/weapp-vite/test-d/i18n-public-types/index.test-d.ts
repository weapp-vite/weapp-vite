import type { I18nBehaviorMethods, I18nLocaleChangeSubscription, WeappI18nConfig } from 'weapp-vite/i18n'
import { expectAssignable, expectError, expectType } from 'tsd'
import {
  getFallbackLocale,
  getLocale,
  I18n,
  I18nPage,
  onLocaleChange,
  setLocale,
  t,
} from 'weapp-vite/i18n'

expectAssignable<WeappI18nConfig>({ defaultLocale: 'zh-CN' })
expectError<WeappI18nConfig>({})

expectType<WechatMiniprogram.Behavior.Identifier>(I18n)
expectType<typeof Page>(I18nPage)
expectType<string>(t('common.greeting', { user: { name: 'weapp-vite' } }))
expectType<string>(getLocale())
expectType<void>(setLocale('en-US'))
expectType<string>(getFallbackLocale())
expectType<I18nLocaleChangeSubscription>(onLocaleChange(() => {}))

const methods: I18nBehaviorMethods = {
  getFallbackLocale,
  getLocale,
  onLocaleChange,
  setLocale,
  t,
}
expectType<I18nBehaviorMethods>(methods)
