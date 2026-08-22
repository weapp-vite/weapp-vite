import { describe, expect, it } from 'vitest'
import { compileI18nCatalog, compileI18nMessage } from './catalog'

describe('i18n catalog compiler', () => {
  it('flattens messages and compiles supported placeholders', () => {
    const catalog = compileI18nCatalog([
      {
        filePath: 'src/i18n/en-US.json',
        locale: 'en-US',
        messages: {
          greeting: 'Hello {user.name}',
          nested: { title: 'Title' },
        },
      },
      {
        filePath: 'src/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: { greeting: '你好 {user.name}' },
      },
    ], {
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    })

    expect(catalog.messages['en-US']['nested.title']).toEqual(['Title'])
    expect(catalog.messages['zh-CN'].greeting).toEqual([
      '你好 ',
      { key: 'user.name', source: '{user.name}' },
    ])
  })

  it('keeps unsupported braces literal', () => {
    expect(compileI18nMessage(
      '{name} {user.name} {count, select, one {item}} {not-valid}',
    )).toEqual([
      { key: 'name', source: '{name}' },
      ' ',
      { key: 'user.name', source: '{user.name}' },
      ' {count, select, one {item}} {not-valid}',
    ])
  })

  it('preserves object-prototype-shaped message keys', () => {
    const catalog = compileI18nCatalog([{
      filePath: 'src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: JSON.parse('{"__proto__":"literal","constructor":"ctor"}'),
    }], { defaultLocale: 'zh-CN' })

    expect(Object.getOwnPropertyDescriptor(catalog.messages['zh-CN'], '__proto__')?.value).toEqual(['literal'])
    expect(catalog.messages['zh-CN'].constructor).toEqual(['ctor'])
  })

  it('reports duplicate and invalid leaves with their sources', () => {
    expect(() => compileI18nCatalog([
      {
        filePath: 'src/a/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: { title: 'A' },
      },
      {
        filePath: 'src/b/i18n/zh-CN.json',
        locale: 'zh-CN',
        messages: { title: 'B' },
      },
    ], { defaultLocale: 'zh-CN' })).toThrow(/a\/i18n\/zh-CN\.json[\s\S]*b\/i18n\/zh-CN\.json/)

    expect(() => compileI18nCatalog([{
      filePath: 'src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: { count: 1 },
    }], { defaultLocale: 'zh-CN' })).toThrow(/zh-CN\.json.*count.*字符串/)
  })

  it('requires the default and fallback locales to exist', () => {
    expect(() => compileI18nCatalog([{
      filePath: 'src/i18n/zh-CN.json',
      locale: 'zh-CN',
      messages: { title: '标题' },
    }], {
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    })).toThrow(/fallbackLocale.*en-US.*zh-CN\.json/)
  })
})
