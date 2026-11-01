import type { WechatBehaviorConstructor, WechatMiniprogram, WechatPageConstructor } from '@weapp-core/types/wechat-api'
import type { I18nGlobal } from './configTypes'

declare const _selectedBehavior: WechatBehaviorConstructor

export type I18nBehavior = ReturnType<typeof _selectedBehavior<
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  WechatMiniprogram.IAnyObject,
  []
>>

export interface I18nHost {
  Behavior: WechatBehaviorConstructor
  Page: WechatPageConstructor
}

export interface I18nInstance {
  global: I18nGlobal
  behavior: I18nBehavior
  page: WechatPageConstructor
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
