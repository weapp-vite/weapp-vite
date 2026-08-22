import type {
  I18nCatalog,
  I18nCompiledMessages,
  I18nCompileOptions,
  I18nLocaleFileInput,
  I18nMessages,
  I18nMessageToken,
} from './types'
import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'

const PLACEHOLDER_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function flattenLocaleMessages(
  input: unknown,
  filePath: string,
  visit: (key: string, value: string) => void,
  prefix = '',
) {
  if (!isPlainObject(input)) {
    throw new Error(`i18n 文件 \`${filePath}\` 顶层必须是对象。`)
  }
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim()
    if (!normalizedKey) {
      throw new Error(`i18n 文件 \`${filePath}\` 包含空 key。`)
    }
    const path = prefix ? `${prefix}.${normalizedKey}` : normalizedKey
    if (typeof value === 'string') {
      visit(path, value)
    }
    else if (isPlainObject(value)) {
      flattenLocaleMessages(value, filePath, visit, path)
    }
    else {
      throw new Error(`i18n 文件 \`${filePath}\` 的 \`${path}\` 必须是字符串或嵌套对象。`)
    }
  }
}

export function compileI18nMessage(message: string): I18nMessageToken[] {
  const tokens: I18nMessageToken[] = []
  let literal = ''
  const pushLiteral = () => {
    if (literal || tokens.length === 0) {
      tokens.push(literal)
      literal = ''
    }
  }

  for (let index = 0; index < message.length;) {
    if (message[index] !== '{') {
      literal += message[index]
      index++
      continue
    }
    let depth = 1
    let end = index + 1
    while (end < message.length && depth > 0) {
      if (message[end] === '{') {
        depth++
      }
      else if (message[end] === '}') {
        depth--
      }
      end++
    }
    if (depth > 0) {
      literal += message.slice(index)
      break
    }
    const source = message.slice(index, end)
    const key = source.slice(1, -1)
    if (PLACEHOLDER_PATH_RE.test(key)) {
      if (literal) {
        pushLiteral()
      }
      tokens.push({ key, source })
    }
    else {
      literal += source
    }
    index = end
  }
  if (literal || tokens.length === 0) {
    pushLiteral()
  }
  return tokens
}

export function compileI18nMessages(messages: I18nMessages): I18nCompiledMessages {
  const compiled: I18nCompiledMessages = Object.create(null)
  for (const [locale, localeMessages] of Object.entries(messages)) {
    const target = compiled[locale] ??= Object.create(null)
    flattenLocaleMessages(localeMessages, `${locale}.json`, (key, value) => {
      target[key] = compileI18nMessage(value)
    })
  }
  return compiled
}

export function compileI18nCatalog(
  files: I18nLocaleFileInput[],
  options: I18nCompileOptions,
): I18nCatalog {
  const defaultLocale = options.defaultLocale.trim()
  const fallbackLocale = options.fallbackLocale?.trim() || defaultLocale
  if (!defaultLocale) {
    throw new Error('i18n defaultLocale 不能为空。')
  }

  const messages: I18nCatalog['messages'] = Object.create(null)
  const sources = new Map<string, string>()
  for (const file of [...files].sort((left, right) => left.filePath.localeCompare(right.filePath))) {
    const localeMessages = messages[file.locale] ??= Object.create(null)
    flattenLocaleMessages(file.messages, file.filePath, (key, value) => {
      const sourceKey = `${file.locale}:${key}`
      const previous = sources.get(sourceKey)
      if (previous) {
        throw new Error(`i18n locale \`${file.locale}\` 的 key \`${key}\` 重复：\`${previous}\` 与 \`${file.filePath}\`。`)
      }
      sources.set(sourceKey, file.filePath)
      localeMessages[key] = compileI18nMessage(value)
    })
  }

  const locales = Object.keys(messages).sort()
  const sourceFiles = [...new Set(files.map(file => file.filePath))].sort()
  if (!locales.includes(defaultLocale)) {
    throw new Error(`i18n defaultLocale \`${defaultLocale}\` 没有对应的 locale 文件。已扫描：${sourceFiles.join(', ')}。`)
  }
  if (!locales.includes(fallbackLocale)) {
    throw new Error(`i18n fallbackLocale \`${fallbackLocale}\` 没有对应的 locale 文件。已扫描：${sourceFiles.join(', ')}。`)
  }

  return { defaultLocale, fallbackLocale, locales, messages }
}

export function generateI18nCatalogModuleSource(catalog: I18nCatalog) {
  return `module.exports = ${JSON.stringify(catalog)}\n`
}

export function generateI18nWxsSource(catalog: I18nCatalog) {
  return `var catalog = ${JSON.stringify(catalog)}
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
const i18n = createI18n(${JSON.stringify(catalog)})
export const ${WEAPP_I18N_RUNTIME_MARKER} = true
export { i18n }
export const global = i18n.global
export const behavior = i18n.behavior
export const page = i18n.page
`
}
