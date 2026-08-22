import type { I18nCatalog } from './types'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  generateI18nCatalogModuleSource,
  generateI18nRuntimeSource,
  generateI18nWxsSource,
} from './compiler'

const catalog: I18nCatalog = {
  defaultLocale: 'zh-CN',
  fallbackLocale: 'en-US',
  locales: ['en-US', 'zh-CN'],
  messages: {
    'en-US': { fallback: ['Fallback'] },
    'zh-CN': {
      greeting: ['你好 ', { key: 'user.name', source: '{user.name}' }],
    },
  },
}

describe('i18n generated sources', () => {
  it('executes generated WXS through the Web runtime', () => {
    const module = { exports: {} as { t: (locale: string, key: string, params?: Record<string, unknown>) => string } }
    vm.runInNewContext(generateI18nWxsSource(catalog), { module, Object, String })
    const wxs = module.exports

    expect(wxs.t('zh-CN', 'greeting', { user: { name: 'WXS' } })).toBe('你好 WXS')
    expect(wxs.t('zh-CN', 'fallback')).toBe('Fallback')
    expect(wxs.t('zh-CN', 'missing')).toBe('missing')
    expect(wxs.t('zh-CN', 'constructor')).toBe('constructor')
  })

  it('generates standalone CommonJS catalog and thin configured runtime', () => {
    expect(generateI18nCatalogModuleSource(catalog)).toContain('module.exports =')
    const runtime = generateI18nRuntimeSource(catalog)
    expect(runtime).toContain('from \'@weapp-vite/i18n/runtime\'')
    expect(runtime).toContain('const i18n = createI18n(')
    expect(runtime).not.toContain('function render(')
  })
})
