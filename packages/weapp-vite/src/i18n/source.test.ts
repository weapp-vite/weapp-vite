import type { I18nCatalog } from './types'
import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderContext } from '../../../../packages-runtime/web/src/runtime/renderContext'
import { generateI18nRuntimeSource, generateI18nWxsSource } from './source'

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

async function loadRuntime() {
  let behaviorOptions: any
  let pageOptions: any
  vi.stubGlobal('Behavior', vi.fn((options: any) => {
    behaviorOptions = options
    return options
  }))
  vi.stubGlobal('Page', vi.fn((options: any) => {
    pageOptions = options
    return options
  }))
  const source = generateI18nRuntimeSource(catalog)
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}-${Math.random()}`
  const runtime = await import(dataUrl)
  return {
    behaviorOptions,
    getPageOptions: () => pageOptions,
    runtime,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('i18n generated runtime', () => {
  it('resolves current, fallback and missing messages', async () => {
    const { runtime } = await loadRuntime()

    expect(runtime.t('greeting', { user: { name: '小程序' } })).toBe('你好 小程序')
    expect(runtime.t('greeting')).toBe('你好 {user.name}')
    expect(runtime.t('fallback')).toBe('Fallback')
    expect(runtime.t('missing')).toBe('missing')
    expect(runtime.t('constructor')).toBe('constructor')
    expect(runtime.t('toString')).toBe('toString')
    expect(runtime.t('value', { value: 0 })).toBe('Value: 0')
  })

  it('broadcasts valid locale changes and rejects unknown locales', async () => {
    const { behaviorOptions, runtime } = await loadRuntime()
    const setData = vi.fn()
    const instance = { setData }
    const listener = vi.fn()
    const subscription = runtime.onLocaleChange(listener)

    behaviorOptions.lifetimes.attached.call(instance)
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'zh-CN' })

    runtime.setLocale('en-US')
    expect(runtime.getLocale()).toBe('en-US')
    expect(runtime.getFallbackLocale()).toBe('en-US')
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    expect(listener).toHaveBeenCalledOnce()

    runtime.setLocale('en-US')
    expect(listener).toHaveBeenCalledOnce()
    expect(() => runtime.setLocale('ja-JP')).toThrow(RangeError)

    subscription.off()
    subscription.off()
    behaviorOptions.lifetimes.detached.call(instance)
    runtime.setLocale('zh-CN')
    expect(listener).toHaveBeenCalledOnce()
    expect(setData).toHaveBeenCalledTimes(2)
  })

  it('wraps page lifecycle without dropping user hooks', async () => {
    const { getPageOptions, runtime } = await loadRuntime()
    const onLoad = vi.fn(() => 'loaded')
    const onUnload = vi.fn(() => 'unloaded')

    runtime.I18nPage({ data: { ready: true }, onLoad, onUnload })
    const options = getPageOptions()
    const setData = vi.fn()
    const instance = { setData }

    expect(options.data).toEqual({ ready: true, __wv_i18n_locale: 'zh-CN' })
    expect(options.onLoad.call(instance, { source: 'test' })).toBe('loaded')
    expect(onLoad).toHaveBeenCalledWith({ source: 'test' })
    runtime.setLocale('en-US')
    expect(setData).toHaveBeenLastCalledWith({ __wv_i18n_locale: 'en-US' })
    expect(options.onUnload.call(instance)).toBe('unloaded')
    runtime.setLocale('zh-CN')
    expect(setData).toHaveBeenCalledTimes(2)
  })

  it('executes generated WXS through the Web runtime', () => {
    const wxs = createRenderContext({} as any, {}).createWxsModule(
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
