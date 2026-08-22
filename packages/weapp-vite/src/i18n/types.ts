export interface WeappI18nConfig {
  defaultLocale: string
  fallbackLocale?: string
  include?: string | string[]
  functionName?: string
  moduleName?: string
}

export interface ResolvedWeappI18nConfig {
  defaultLocale: string
  fallbackLocale: string
  include: string[]
  functionName: string
  moduleName: string
}

export interface I18nPlaceholderToken {
  key: string
  source: string
}

export type I18nMessageToken = string | I18nPlaceholderToken
export type I18nCompiledMessages = Record<string, Record<string, I18nMessageToken[]>>

export interface I18nCatalog {
  defaultLocale: string
  fallbackLocale: string
  locales: string[]
  messages: I18nCompiledMessages
}

export interface I18nLocaleFileInput {
  filePath: string
  locale: string
  messages: unknown
}

export interface I18nLocaleChangeSubscription {
  off: () => void
}

export interface I18nBehaviorMethods {
  t: (key: string, params?: Record<string, unknown>) => string
  getLocale: () => string
  setLocale: (locale: string) => void
  getFallbackLocale: () => string
  onLocaleChange: (handler: (locale: string) => void) => I18nLocaleChangeSubscription
}
