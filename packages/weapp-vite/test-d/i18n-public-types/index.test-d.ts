import type { I18nGlobal, I18nInstance, I18nLocaleChangeSubscription, WeappI18nConfig } from 'weapp-vite/i18n'
import { expectAssignable, expectError, expectType } from 'tsd'
import { behavior, global, i18n, page } from 'weapp-vite/i18n'

expectAssignable<WeappI18nConfig>({ defaultLocale: 'zh-CN' })
expectError<WeappI18nConfig>({})

expectType<I18nInstance>(i18n)
expectType<I18nGlobal>(global)
expectType<WechatMiniprogram.Behavior.Identifier>(behavior)
expectType<typeof Page>(page)
expectType<string>(global.t('common.greeting', { user: { name: 'weapp-vite' } }))
expectType<string>(global.locale)
expectType<string>(global.fallbackLocale)
expectType<readonly string[]>(global.availableLocales)
expectType<I18nLocaleChangeSubscription>(global.onLocaleChange(() => {}))
