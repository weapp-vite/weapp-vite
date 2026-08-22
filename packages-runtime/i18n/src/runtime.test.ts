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
  vi.resetModules()
})

describe('i18n runtime', () => {
  it('resolves current, fallback and missing messages', () => {
    const { host } = createHost()
    const i18n = createI18n(catalog, host)

    expect(i18n.t('greeting', { user: { name: '小程序' } })).toBe('你好 小程序')
    expect(i18n.t('greeting')).toBe('你好 {user.name}')
    expect(i18n.t('fallback')).toBe('Fallback')
    expect(i18n.t('missing')).toBe('missing')
    expect(i18n.t('constructor')).toBe('constructor')
    expect(i18n.t('toString')).toBe('toString')
    expect(i18n.t('value', { value: 0 })).toBe('Value: 0')
  })

  it('broadcasts locale changes inside one instance', () => {
    const { getBehaviorOptions, host } = createHost()
    const i18n = createI18n(catalog, host)
    const setData = vi.fn()
    const component = { setData }
    const listener = vi.fn()
    const subscription = i18n.onLocaleChange(listener)

    getBehaviorOptions().lifetimes.attached.call(component)
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'zh-CN' })

    i18n.setLocale('en-US')
    expect(i18n.getLocale()).toBe('en-US')
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    expect(listener).toHaveBeenCalledOnce()

    i18n.setLocale('en-US')
    expect(listener).toHaveBeenCalledOnce()
    expect(() => i18n.setLocale('ja-JP')).toThrow(RangeError)

    subscription.off()
    subscription.off()
    getBehaviorOptions().lifetimes.detached.call(component)
    i18n.setLocale('zh-CN')
    expect(setData).toHaveBeenCalledTimes(2)
  })

  it('adapts traditional Page lifecycle and rejects reserved fields', () => {
    const { getPageOptions, host } = createHost()
    const i18n = createI18n(catalog, host)
    const onLoad = vi.fn()
    const onUnload = vi.fn()

    i18n.definePage({ data: { ready: true }, onLoad, onUnload })
    const options = getPageOptions()
    const setData = vi.fn()
    const page = { setData }

    expect(options.data).toEqual({ ready: true, __wv_i18n_locale: 'zh-CN' })
    options.onLoad.call(page, { source: 'test' })
    expect(onLoad).toHaveBeenCalledWith({ source: 'test' })
    i18n.setLocale('en-US')
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    options.onUnload.call(page)
    expect(onUnload).toHaveBeenCalledOnce()
    i18n.setLocale('zh-CN')
    expect(setData).toHaveBeenCalledTimes(2)

    expect(() => i18n.definePage({
      data: { __wv_i18n_locale: 'custom' },
    })).toThrow(/保留字段/)
    expect(() => i18n.definePage({
      data: {},
      t() {},
    })).toThrow(/保留字段/)
  })

  it('provides a stable singleton compatibility behavior', async () => {
    const behavior = vi.fn(options => options)
    const page = vi.fn(options => options)
    vi.stubGlobal('Behavior', behavior)
    vi.stubGlobal('Page', page)
    const runtime = await import('./index')

    const stableBehavior = runtime.I18n
    expect(runtime.getI18nInstance()).toBeUndefined()
    runtime.initI18n(catalog)
    expect(runtime.I18n).toBe(stableBehavior)
    expect(runtime.t('fallback')).toBe('Fallback')
    expect(runtime.getI18nInstance()?.I18n).toBe(stableBehavior)
  })
})
