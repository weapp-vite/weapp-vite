import type { I18nCatalog } from './types'
import { WEAPP_I18N_LOCALE_DATA_KEY, WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'

function serializeCatalog(catalog: I18nCatalog) {
  return JSON.stringify(catalog)
}

export function generateI18nWxsSource(catalog: I18nCatalog) {
  return `var catalog = ${serializeCatalog(catalog)}
function resolveParam(params, key) {
  var current = params
  var parts = key.split('.')
  for (var i = 0; i < parts.length; i++) {
    if (current == null || current[parts[i]] === undefined) return undefined
    current = current[parts[i]]
  }
  return current
}
function render(tokens, params) {
  var result = ''
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
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
  return `const catalog = ${serializeCatalog(catalog)}
export const ${WEAPP_I18N_RUNTIME_MARKER} = true
let currentLocale = catalog.defaultLocale
const instances = new Set()
const listeners = new Set()
function hasOwn(object, key) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key)
}
function resolveParam(params, key) {
  let current = params
  for (const part of key.split('.')) {
    if (!hasOwn(current, part)) return undefined
    current = current[part]
  }
  return current
}
function render(tokens, params) {
  let result = ''
  for (const token of tokens) {
    if (typeof token === 'string') result += token
    else {
      const value = resolveParam(params, token.key)
      result += value === undefined ? token.source : String(value)
    }
  }
  return result
}
function getMessage(messages, key) {
  return hasOwn(messages, key) ? messages[key] : undefined
}
export function t(key, params = {}) {
  const current = catalog.messages[currentLocale] || {}
  const fallback = catalog.messages[catalog.fallbackLocale] || {}
  const tokens = getMessage(current, key) || getMessage(fallback, key)
  return tokens ? render(tokens, params) : key
}
export function getLocale() { return currentLocale }
export function getFallbackLocale() { return catalog.fallbackLocale }
export function setLocale(locale) {
  if (!catalog.locales.includes(locale)) throw new RangeError('Unknown i18n locale: ' + locale)
  if (locale === currentLocale) return
  currentLocale = locale
  for (const instance of instances) {
    if (instance && typeof instance.setData === 'function') instance.setData({ ${WEAPP_I18N_LOCALE_DATA_KEY}: locale })
  }
  for (const listener of listeners) listener(locale)
}
export function onLocaleChange(handler) {
  listeners.add(handler)
  let active = true
  return { off() { if (active) { active = false; listeners.delete(handler) } } }
}
function attach(instance) {
  instances.add(instance)
  if (instance && typeof instance.setData === 'function') instance.setData({ ${WEAPP_I18N_LOCALE_DATA_KEY}: currentLocale })
}
function detach(instance) { instances.delete(instance) }
const methods = { t, getLocale, setLocale, getFallbackLocale, onLocaleChange }
export const I18n = Behavior({
  data: { ${WEAPP_I18N_LOCALE_DATA_KEY}: currentLocale },
  lifetimes: {
    attached() { attach(this) },
    detached() { detach(this) },
  },
  methods,
})
export function I18nPage(options) {
  const originalLoad = options.onLoad
  const originalUnload = options.onUnload
  const next = Object.assign({}, options, methods, {
    data: Object.assign({}, options.data, { ${WEAPP_I18N_LOCALE_DATA_KEY}: currentLocale }),
    onLoad(...args) { attach(this); return originalLoad && originalLoad.apply(this, args) },
    onUnload(...args) { detach(this); return originalUnload && originalUnload.apply(this, args) },
  })
  return Page(next)
}
`
}
