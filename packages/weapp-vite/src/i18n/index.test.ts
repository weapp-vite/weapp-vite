import { compileI18nCatalog } from '@weapp-vite/i18n/compiler'
import { describe, expect, it } from 'vitest'
import { resolveWeappI18nConfig } from './config'
import { transformI18nTemplate } from './template'

describe('weapp i18n', () => {
  it('resolves deterministic defaults', () => {
    expect(resolveWeappI18nConfig({ defaultLocale: 'zh-CN' })).toEqual({
      defaultLocale: 'zh-CN',
      fallbackLocale: 'zh-CN',
      functionName: 't',
      include: ['**/i18n/*.json'],
      moduleName: 'i18n',
    })
    expect(resolveWeappI18nConfig({
      defaultLocale: 'en-US',
      include: 'locales/*.json',
      functionName: 'translate',
      moduleName: 'translations',
    })).toEqual({
      defaultLocale: 'en-US',
      fallbackLocale: 'en-US',
      functionName: 'translate',
      include: ['locales/*.json'],
      moduleName: 'translations',
    })
    expect(() => resolveWeappI18nConfig({ defaultLocale: '' })).toThrow(/defaultLocale/)
    expect(() => resolveWeappI18nConfig({ defaultLocale: 'en-US', functionName: 'not-valid!' })).toThrow(/functionName/)
  })

  it('flattens locale messages and precompiles interpolation tokens', () => {
    const catalog = compileI18nCatalog([
      {
        filePath: '/project/src/i18n/en-US.json',
        locale: 'en-US',
        messages: {
          greeting: 'Hello {user.name}',
          nested: { title: 'Title' },
        },
      },
      {
        filePath: '/project/src/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: {
          greeting: '你好 {user.name}',
        },
      },
    ], resolveWeappI18nConfig({
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    }))

    expect(catalog.messages['en-US']['nested.title']).toEqual(['Title'])
    expect(catalog.messages['zh-CN'].greeting).toEqual([
      '你好 ',
      { key: 'user.name', source: '{user.name}' },
    ])
  })

  it('fails duplicate keys with both source files', () => {
    expect(() => compileI18nCatalog([
      {
        filePath: '/project/src/a/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: { title: 'A' },
      },
      {
        filePath: '/project/src/b/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: { title: 'B' },
      },
    ], resolveWeappI18nConfig({ defaultLocale: 'zh-CN' }))).toThrow(/a\/i18n\/zh-CN\.json[\s\S]*b\/i18n\/zh-CN\.json/)
  })

  it('reports invalid leaves and missing configured locales with sources', () => {
    const config = resolveWeappI18nConfig({
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    })
    expect(() => compileI18nCatalog([{
      filePath: '/project/src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: { count: 1 },
    }], config)).toThrow(/zh-CN\.json.*count.*字符串/)
    expect(() => compileI18nCatalog([{
      filePath: '/project/src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: { title: '标题' },
    }], config)).toThrow(/fallbackLocale.*en-US.*zh-CN\.json/)
  })

  it('keeps unsupported braces literal while compiling supported placeholders', () => {
    const catalog = compileI18nCatalog([{
      filePath: '/project/src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: {
        value: '{name} {user.name} {count, plural, one {item}} {not-valid}',
      },
    }], resolveWeappI18nConfig({ defaultLocale: 'zh-CN' }))

    expect(catalog.messages['zh-CN'].value).toEqual([
      { key: 'name', source: '{name}' },
      ' ',
      { key: 'user.name', source: '{user.name}' },
      ' {count, plural, one {item}} {not-valid}',
    ])
  })

  it('rewrites template calls and rejects module collisions', () => {
    expect(transformI18nTemplate(
      '<custom-card title="{{ t(\'greeting\', { user }) }}">{{ other() }}</custom-card>',
      {
        assetFileName: 'i18n/locales.wxs',
        fileName: 'pages/index/index.wxml',
        functionName: 't',
        localeDataKey: '__wv_i18n_locale',
        moduleName: 'i18n',
      },
    )).toBe('<wxs module="i18n" src="../../i18n/locales.wxs"/>\n<custom-card title="{{ i18n.t(__wv_i18n_locale, \'greeting\', { user }) }}">{{ other() }}</custom-card>')

    expect(() => transformI18nTemplate(
      '<wxs module="i18n" src="./existing.wxs"/><view>{{ t(\'key\') }}</view>',
      {
        assetFileName: 'i18n/locales.wxs',
        fileName: 'pages/index/index.wxml',
        functionName: 't',
        localeDataKey: '__wv_i18n_locale',
        moduleName: 'i18n',
      },
    )).toThrow(/module.*i18n/)
    expect(() => transformI18nTemplate(
      '<wxs src="./existing.wxs" module="i18n"/><view>{{ t(\'key\') }}</view>',
      {
        assetFileName: 'i18n/locales.wxs',
        fileName: 'pages/index/index.wxml',
        functionName: 't',
        localeDataKey: '__wv_i18n_locale',
        moduleName: 'i18n',
      },
    )).toThrow(/module.*i18n/)
    expect(() => transformI18nTemplate(
      '<wxs module="i18n">module.exports = {}</wxs><view>{{ t(\'key\') }}</view>',
      {
        assetFileName: 'i18n/locales.wxs',
        fileName: 'pages/index/index.wxml',
        functionName: 't',
        localeDataKey: '__wv_i18n_locale',
        moduleName: 'i18n',
      },
    )).toThrow(/module.*i18n/)

    expect(transformI18nTemplate(
      '<view>{{ translate(\'greeting\') }}</view>',
      {
        assetFileName: 'i18n/locales.wxs',
        fileName: 'pages/index/index.wxml',
        functionName: 'translate',
        localeDataKey: '__wv_i18n_locale',
        moduleName: 'messages',
      },
    )).toBe('<wxs module="messages" src="../../i18n/locales.wxs"/>\n<view>{{ messages.t(__wv_i18n_locale, \'greeting\') }}</view>')
  })

  it('does not rewrite calls in comments or inline WXS', () => {
    const source = '<!-- {{ t(\'comment\') }} --><wxs module="local" lang="js">var text = "{{ t(\'script\') }}"</wxs><view>{{ t(\'page.title\') }}</view>'
    const result = transformI18nTemplate(source, {
      assetFileName: 'i18n/locales.wxs',
      fileName: 'pages/index/index.wxml',
      functionName: 't',
      localeDataKey: '__wv_i18n_locale',
      moduleName: 'i18n',
    })

    expect(result).toContain('<!-- {{ t(\'comment\') }} -->')
    expect(result).toContain(`var text = "{{ t('script') }}"`)
    expect(result).toContain('{{ i18n.t(__wv_i18n_locale, \'page.title\') }}')
  })

  it('uses parser template ranges for nested object arguments', () => {
    const source = '<view data-title="{{ t(\'card.title\', { user: { profile } }) }}">{{ t(t(\'body.key\')) }}</view>'
    const result = transformI18nTemplate(source, {
      assetFileName: 'i18n/locales.wxs',
      fileName: 'pages/index/index.wxml',
      functionName: 't',
      localeDataKey: '__wv_i18n_locale',
      moduleName: 'i18n',
    })

    expect(result).toContain('i18n.t(__wv_i18n_locale, \'card.title\', { user: { profile } })')
    expect(result).toContain('i18n.t(__wv_i18n_locale, i18n.t(__wv_i18n_locale, \'body.key\'))')
  })
})
