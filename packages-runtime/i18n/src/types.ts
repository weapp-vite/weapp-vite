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

export interface I18nCompileOptions {
  defaultLocale: string
  fallbackLocale?: string
}

export interface I18nLocaleChangeSubscription {
  off: () => void
}

export type I18nBehavior = WechatMiniprogram.Behavior.Identifier<
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  []
>

export interface I18nBehaviorMethods {
  t: (key: string, params?: Record<string, unknown>) => string
  getLocale: () => string
  setLocale: (locale: string) => void
  getFallbackLocale: () => string
  onLocaleChange: (handler: (locale: string) => void) => I18nLocaleChangeSubscription
}

export interface I18nHost {
  Behavior: typeof Behavior
  Page: typeof Page
}

export interface I18nInstance extends I18nBehaviorMethods {
  I18n: I18nBehavior
  I18nPage: typeof Page
  behavior: I18nBehavior
  definePage: typeof Page
}

export interface CompileNativeI18nOptions extends I18nCompileOptions {
  outDir?: string
  srcRoot: string
}

export interface CompileNativeI18nResult {
  catalog: I18nCatalog
  files: string[]
  jsFile: string
  wxsFile: string
}
