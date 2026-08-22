export interface I18nPlaceholderToken {
  key: string
  source: string
}

export type I18nMessageToken = string | I18nPlaceholderToken
export type I18nCompiledMessages = Record<string, Record<string, I18nMessageToken[]>>

export type I18nMessageValue = string | { [key: string]: I18nMessageValue }
export type I18nLocaleMessages = Record<string, I18nMessageValue>
export type I18nMessages = Record<string, I18nLocaleMessages>

export interface I18nOptions {
  locale: string
  fallbackLocale?: string
  messages: I18nMessages
}

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

export interface I18nGlobal {
  t: (key: string, params?: Record<string, unknown>) => string
  locale: string
  readonly fallbackLocale: string
  readonly availableLocales: readonly string[]
  onLocaleChange: (handler: (locale: string) => void) => I18nLocaleChangeSubscription
}

export interface I18nHost {
  Behavior: typeof Behavior
  Page: typeof Page
}

export interface I18nInstance {
  global: I18nGlobal
  behavior: I18nBehavior
  page: typeof Page
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
