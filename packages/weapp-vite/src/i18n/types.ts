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
  I18nCatalog,
  I18nCompiledMessages,
  I18nGlobal,
  I18nLocaleMessages,
  I18nMessages,
  I18nMessageToken,
  I18nMessageValue,
  I18nOptions,
  I18nPlaceholderToken,
} from '@weapp-vite/i18n'
export type { I18nLocaleFileInput } from '@weapp-vite/i18n/compiler'
