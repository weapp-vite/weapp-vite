import type { I18nCatalog, I18nInstance } from './types'
import { createI18n, createUninitializedI18n } from './runtime'

const singleton = createUninitializedI18n()

function requireInstance() {
  const instance = singleton.get()
  if (!instance) {
    throw new Error('i18n 尚未初始化，请先调用 initI18n()。')
  }
  return instance
}

export function initI18n(catalog: I18nCatalog) {
  return singleton.init(catalog)
}

export function getI18nInstance(): I18nInstance | undefined {
  return singleton.get()
}

export const I18n = singleton.instance.I18n
export const I18nPage = singleton.instance.I18nPage

export function t(key: string, params?: Record<string, unknown>) {
  return requireInstance().t(key, params)
}

export function getLocale() {
  return requireInstance().getLocale()
}

export function setLocale(locale: string) {
  return requireInstance().setLocale(locale)
}

export function getFallbackLocale() {
  return requireInstance().getFallbackLocale()
}

export function onLocaleChange(handler: (locale: string) => void) {
  return requireInstance().onLocaleChange(handler)
}

export { createI18n }
export type {
  I18nBehavior,
  I18nBehaviorMethods,
  I18nCatalog,
  I18nCompiledMessages,
  I18nHost,
  I18nInstance,
  I18nLocaleChangeSubscription,
  I18nMessageToken,
  I18nPlaceholderToken,
} from './types'
