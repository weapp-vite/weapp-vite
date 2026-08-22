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

export type {
  I18nBehaviorMethods,
  I18nCatalog,
  I18nCompiledMessages,
  I18nLocaleChangeSubscription,
  I18nMessageToken,
  I18nPlaceholderToken,
} from '@weapp-vite/i18n'
export type { I18nLocaleFileInput } from '@weapp-vite/i18n/compiler'
