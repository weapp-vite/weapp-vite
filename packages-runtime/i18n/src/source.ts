import type { I18nCatalog } from './types'
import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'

function serializeCatalog(catalog: I18nCatalog) {
  return JSON.stringify(catalog)
}

export function generateI18nCatalogModuleSource(catalog: I18nCatalog) {
  return `module.exports = ${serializeCatalog(catalog)}\n`
}

export function generateI18nWxsSource(catalog: I18nCatalog) {
  return `var catalog = ${serializeCatalog(catalog)}
function resolveParam(params, key) {
  var current = params
  var parts = key.split('.')
  for (var index = 0; index < parts.length; index++) {
    if (current == null || current[parts[index]] === undefined) return undefined
    current = current[parts[index]]
  }
  return current
}
function render(tokens, params) {
  var result = ''
  for (var index = 0; index < tokens.length; index++) {
    var token = tokens[index]
    if (typeof token === 'string') result += token
    else {
      var value = resolveParam(params, token.key)
      result += value === undefined ? token.source : value + ''
    }
  }
  return result
}
function getMessage(messages, key) {
  var tokens = messages[key]
  return tokens && typeof tokens === 'object' && typeof tokens.length === 'number' ? tokens : undefined
}
function t(locale, key, params) {
  var current = catalog.messages[locale] || {}
  var fallback = catalog.messages[catalog.fallbackLocale] || {}
  var tokens = getMessage(current, key) || getMessage(fallback, key)
  return tokens ? render(tokens, params || {}) : key
}
module.exports = { t: t }
`
}

export function generateI18nRuntimeSource(catalog: I18nCatalog) {
  return `import { createI18n } from '@weapp-vite/i18n/runtime'
const i18n = createI18n(${serializeCatalog(catalog)})
export const ${WEAPP_I18N_RUNTIME_MARKER} = true
export const I18n = i18n.I18n
export const I18nPage = i18n.I18nPage
export const t = i18n.t
export const getLocale = i18n.getLocale
export const setLocale = i18n.setLocale
export const getFallbackLocale = i18n.getFallbackLocale
export const onLocaleChange = i18n.onLocaleChange
`
}
