import type { I18nBehavior, I18nCatalog, I18nGlobal, I18nHost, I18nInstance, I18nOptions } from '@weapp-vite/i18n'
import type { I18nBehavior as RuntimeBehavior, I18nHost as RuntimeHost, I18nInstance as RuntimeInstance } from '@weapp-vite/i18n/runtime'
import type { I18nCatalog as PureCatalog, I18nGlobal as PureGlobal, I18nOptions as PureOptions } from '@weapp-vite/i18n/types'
import { expectType } from 'tsd'

expectType<I18nCatalog>({} as PureCatalog)
expectType<I18nGlobal>({} as PureGlobal)
expectType<I18nOptions>({} as PureOptions)
expectType<I18nBehavior>({} as RuntimeBehavior)
expectType<I18nHost>({} as RuntimeHost)
expectType<I18nInstance>({} as RuntimeInstance)

declare const host: I18nHost
declare const instance: I18nInstance
expectType<typeof Behavior>(host.Behavior)
expectType<typeof Page>(host.Page)
expectType<typeof Page>(instance.page)
expectType<WechatMiniprogram.Behavior.Identifier<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject, []>>(instance.behavior)
