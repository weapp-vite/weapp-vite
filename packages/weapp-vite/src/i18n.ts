import type { I18nBehaviorMethods, I18nLocaleChangeSubscription } from './i18n/types'
import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'

function unavailable(): never {
  throw new Error('weapp-vite/i18n 只能在启用 weapp.i18n 的小程序构建中使用。')
}

export const I18n = {
  [WEAPP_I18N_RUNTIME_MARKER]: true,
} as unknown as WechatMiniprogram.Behavior.Identifier
export const I18nPage = unavailable as unknown as typeof Page
export const t = unavailable as unknown as I18nBehaviorMethods['t']
export const getLocale = unavailable as unknown as I18nBehaviorMethods['getLocale']
export const setLocale = unavailable as unknown as I18nBehaviorMethods['setLocale']
export const getFallbackLocale = unavailable as unknown as I18nBehaviorMethods['getFallbackLocale']
export const onLocaleChange = unavailable as unknown as ((handler: (locale: string) => void) => I18nLocaleChangeSubscription)

export type { I18nBehaviorMethods, I18nLocaleChangeSubscription, WeappI18nConfig } from './i18n/types'
