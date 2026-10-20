import type { I18nGlobal } from './configTypes'

export type I18nBehavior = WechatMiniprogram.Behavior.Identifier<
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  []
>

export interface I18nHost {
  Behavior: typeof Behavior
  Page: typeof Page
}

export interface I18nInstance {
  global: I18nGlobal
  behavior: I18nBehavior
  page: typeof Page
}

export type {
  CompileNativeI18nOptions,
  CompileNativeI18nResult,
  I18nCatalog,
  I18nCompiledMessages,
  I18nCompileOptions,
  I18nGlobal,
  I18nLocaleChangeSubscription,
  I18nLocaleFileInput,
  I18nLocaleMessages,
  I18nMessages,
  I18nMessageToken,
  I18nMessageValue,
  I18nOptions,
  I18nPlaceholderToken,
} from './configTypes'
