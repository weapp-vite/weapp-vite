import type {
  I18nGlobal,
  I18nInstance,
} from '@weapp-vite/i18n'
import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'

function unavailable(): never {
  throw new Error('weapp-vite/i18n 只能在启用 weapp.i18n 的小程序构建中使用。')
}

export const behavior = {
  [WEAPP_I18N_RUNTIME_MARKER]: true,
} as unknown as I18nInstance['behavior']
export const i18n = {
  behavior,
  global: unavailable,
  page: unavailable,
} as unknown as I18nInstance
export const global = unavailable as unknown as I18nGlobal
export const page = unavailable as unknown as typeof Page

export type { WeappI18nConfig } from './i18n/types'
export type { I18nGlobal, I18nInstance, I18nLocaleChangeSubscription } from '@weapp-vite/i18n'
