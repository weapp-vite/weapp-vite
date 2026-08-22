import type {
  I18nCatalog,
  I18nCompileOptions,
  I18nLocaleFileInput,
  I18nMessageToken,
} from './types'

const PLACEHOLDER_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

  return {
    defaultLocale,
    fallbackLocale,
    locales,
    messages,
  }
}
