import process from 'node:process'

export type Locale = 'zh' | 'en'

let currentLocale: Locale = 'zh'

/**
 * @description 设置当前语言。
 */
export function setLocale(locale: string | undefined) {
  currentLocale = normalizeLocale(locale)
}

/**
 * @description 获取当前语言。
 */
export function getLocale(): Locale {
  return currentLocale
}

/**
 * @description 从 argv 和环境变量中解析语言并设置。
 */
export function configureLocaleFromArgv(argv: readonly string[], fallbackLocale?: Locale) {
  const localeFromArgv = readLangOption(argv)
  if (localeFromArgv) {
    setLocale(localeFromArgv)
    return currentLocale
  }

  if (fallbackLocale) {
    setLocale(fallbackLocale)
    return currentLocale
  }

  const localeFromEnv = process.env.WEAPP_IDE_CLI_LANG || process.env.LANG
  if (localeFromEnv) {
    setLocale(localeFromEnv)
    return currentLocale
  }

  setLocale('zh')
  return currentLocale
}

/**
 * @description 根据当前语言选择文案。
 */
export function i18nText(zh: string, en: string) {
  return currentLocale === 'en' ? en : zh
}

/**
 * @description 校验 --lang 参数是否合法。
 */
export function validateLocaleOption(argv: readonly string[]) {
  const localeFromArgv = readLangOption(argv)
  if (!localeFromArgv) {
    return
  }

  if (!isLocaleTokenSupported(localeFromArgv)) {
    throw new Error(`不支持的语言: ${localeFromArgv}，仅支持 zh 或 en`)
  }
}

function normalizeLocale(raw: string | undefined): Locale {
  if (!raw) {
    return 'zh'
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en_') || normalized.startsWith('en-')) {
    return 'en'
  }

  return 'zh'
}

function isLocaleTokenSupported(raw: string) {
  const normalized = raw.trim().toLowerCase()
  return normalized === 'zh'
    || normalized === 'en'
    || normalized.startsWith('zh_')
    || normalized.startsWith('zh-')
    || normalized.startsWith('en_')
    || normalized.startsWith('en-')
}

function readLangOption(argv: readonly string[]) {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === '--lang') {
      const value = argv[index + 1]
      return typeof value === 'string' ? value : undefined
    }

    if (token.startsWith('--lang=')) {
      return token.slice('--lang='.length)
    }
  }

  return undefined
}
