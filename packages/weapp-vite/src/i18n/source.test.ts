import type { I18nCatalog } from '@weapp-vite/i18n'
import { generateI18nWxsSource } from '@weapp-vite/i18n/compiler'
import { describe, expect, it } from 'vitest'
import { createRenderContext } from '../../../../packages-runtime/web/src/runtime/renderContext'

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

describe('i18n WXS integration', () => {
  it('executes the standalone compiler output through the Web WXS runtime', () => {
    const wxs = createRenderContext({} as never, {}).createWxsModule(
      generateI18nWxsSource(catalog),
      '/i18n/locales.wxs',
    )

    expect(wxs.t('zh-CN', 'greeting', { user: { name: 'WXS' } })).toBe('你好 WXS')
    expect(wxs.t('zh-CN', 'fallback')).toBe('Fallback')
    expect(wxs.t('zh-CN', 'greeting')).toBe('你好 {user.name}')
    expect(wxs.t('zh-CN', 'missing')).toBe('missing')
    expect(wxs.t('zh-CN', 'constructor')).toBe('constructor')
    expect(wxs.t('zh-CN', 'toString')).toBe('toString')
  })
})
