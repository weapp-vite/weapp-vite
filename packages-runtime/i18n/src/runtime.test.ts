import type { I18nCatalog, I18nHost } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from './runtime'

const catalog: I18nCatalog = {
  defaultLocale: 'zh-CN',
  fallbackLocale: 'en-US',
  locales: ['en-US', 'zh-CN'],
  messages: {
    'en-US': {
      fallback: ['Fallback'],
      greeting: ['Hello ', { key: 'user.name', source: '{user.name}' }],
    },
    'zh-CN': {
      greeting: ['你好 ', { key: 'user.name', source: '{user.name}' }],
      value: ['Value: ', { key: 'value', source: '{value}' }],
    },
  },
}

function createHost() {
  let behaviorOptions: Record<string, any> | undefined
  let pageOptions: Record<string, any> | undefined
  const host = {
    Behavior: vi.fn((options) => {
      behaviorOptions = options
      return options
    }),
    Page: vi.fn((options) => {
      pageOptions = options
      return options
    }),
  } as unknown as I18nHost
  return {
    getBehaviorOptions: () => behaviorOptions!,
    getPageOptions: () => pageOptions!,
    host,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('i18n runtime', () => {
  it('accepts vue-i18n shaped options and resolves messages', () => {
    const { host } = createHost()
    const i18n = createI18n({
      locale: 'zh-CN',
      fallbackLocale: 'en-US',
      messages: {
        'en-US': { fallback: 'Fallback', greeting: 'Hello {user.name}' },
        'zh-CN': { greeting: '你好 {user.name}', value: 'Value: {value}' },
      },
    }, host)

    expect(i18n.global.t('greeting', { user: { name: '小程序' } })).toBe('你好 小程序')
    expect(i18n.global.t('greeting')).toBe('你好 {user.name}')
    expect(i18n.global.t('fallback')).toBe('Fallback')
    expect(i18n.global.t('missing')).toBe('missing')
    expect(i18n.global.t('constructor')).toBe('constructor')
    expect(i18n.global.t('toString')).toBe('toString')
    expect(i18n.global.t('value', { value: 0 })).toBe('Value: 0')
    expect(i18n.global.availableLocales).toEqual(['en-US', 'zh-CN'])
    expect(i18n.global.fallbackLocale).toBe('en-US')
  })

  it('broadcasts locale changes inside one instance', () => {
    const { getBehaviorOptions, host } = createHost()
    const i18n = createI18n(catalog, host)
    const setData = vi.fn()
    const component = { setData }
    const listener = vi.fn()
    const subscription = i18n.global.onLocaleChange(listener)

    getBehaviorOptions().lifetimes.attached.call(component)
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'zh-CN' })

    i18n.global.locale = 'en-US'
    expect(i18n.global.locale).toBe('en-US')
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    expect(listener).toHaveBeenCalledOnce()

    i18n.global.locale = 'en-US'
    expect(listener).toHaveBeenCalledOnce()
    expect(() => {
      i18n.global.locale = 'ja-JP'
    }).toThrow(RangeError)

    subscription.off()
    subscription.off()
    getBehaviorOptions().lifetimes.detached.call(component)
    i18n.global.locale = 'zh-CN'
    expect(setData).toHaveBeenCalledTimes(2)
  })

  it('adapts traditional Page lifecycle without injecting methods', () => {
    const { getPageOptions, host } = createHost()
    const i18n = createI18n(catalog, host)
    const onLoad = vi.fn()
    const onUnload = vi.fn()

    i18n.page({ data: { ready: true }, onLoad, onUnload })
    const options = getPageOptions()
    const setData = vi.fn()
    const page = { setData }

    expect(options.data).toEqual({ ready: true, __wv_i18n_locale: 'zh-CN' })
    options.onLoad.call(page, { source: 'test' })
    expect(onLoad).toHaveBeenCalledWith({ source: 'test' })
    i18n.global.locale = 'en-US'
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    options.onUnload.call(page)
    expect(onUnload).toHaveBeenCalledOnce()
    i18n.global.locale = 'zh-CN'
    expect(setData).toHaveBeenCalledTimes(2)

    expect(() => i18n.page({
      data: { __wv_i18n_locale: 'custom' },
    })).toThrow(/保留字段/)
  })
})
