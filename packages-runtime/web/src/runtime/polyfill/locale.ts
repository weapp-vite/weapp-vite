function normalizeLocale(locale: string): string {
  const normalized = locale.trim().replace('_', '-').toLowerCase()
  if (normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-mo' || normalized.startsWith('zh-hant')) {
    return 'zh-Hant'
  }
  if (normalized.startsWith('zh')) {
    return 'zh-Hans'
  }
  return normalized.split('-')[0] || 'en'
}

export function getLocale(): string {
  const runtimeNavigator = typeof navigator === 'undefined' ? undefined : navigator
  return normalizeLocale(runtimeNavigator?.language ?? 'en')
}
