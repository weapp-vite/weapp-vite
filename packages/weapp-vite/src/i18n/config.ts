import type { ResolvedWeappI18nConfig, WeappI18nConfig } from './types'

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

function normalizeName(value: string | undefined, fallback: string, field: string) {
  const resolved = value?.trim() || fallback
  if (!IDENTIFIER_RE.test(resolved)) {
    throw new Error(`weapp.i18n.${field} 必须是合法标识符，当前值为 \`${resolved}\`。`)
  }
  return resolved
}

export function resolveWeappI18nConfig(config: WeappI18nConfig): ResolvedWeappI18nConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('weapp.i18n 必须是配置对象。')
  }
  const defaultLocale = config.defaultLocale?.trim()
  if (!defaultLocale) {
    throw new Error('weapp.i18n.defaultLocale 为必填项。')
  }
  const include = (Array.isArray(config.include) ? config.include : [config.include ?? '**/i18n/*.json'])
    .map(item => item.trim())
    .filter(Boolean)
  if (!include.length) {
    throw new Error('weapp.i18n.include 至少需要一个有效 glob。')
  }
  return {
    defaultLocale,
    fallbackLocale: config.fallbackLocale?.trim() || defaultLocale,
    include,
    functionName: normalizeName(config.functionName, 't', 'functionName'),
    moduleName: normalizeName(config.moduleName, 'i18n', 'moduleName'),
  }
}
