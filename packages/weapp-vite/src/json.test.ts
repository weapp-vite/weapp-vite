import { describe, expect, it } from 'vitest'
import {
  defineAppJson,
  defineComponentJson,
  definePageJson,
  defineSitemapJson,
  defineThemeJson,
} from './json'

describe('json helpers', () => {
  it('returns plain json objects as-is', () => {
    const app = { pages: ['pages/index/index'] }
    const page = { navigationBarTitleText: '首页' }
    const component = { styleIsolation: 'apply-shared' }
    const sitemap = { rules: [] as any[] }
    const theme = { backgroundTextStyle: 'dark' }

    expect(defineAppJson(app)).toBe(app)
    expect(definePageJson(page)).toBe(page)
    expect(defineComponentJson(component)).toBe(component)
    expect(defineSitemapJson(sitemap)).toBe(sitemap)
    expect(defineThemeJson(theme)).toBe(theme)
  })

  it('returns function config as-is', () => {
    const fn = () => ({ pages: ['pages/index/index'] })
    expect(defineAppJson(fn)).toBe(fn)
    expect(definePageJson(fn)).toBe(fn)
    expect(defineComponentJson(fn)).toBe(fn)
    expect(defineSitemapJson(fn)).toBe(fn)
    expect(defineThemeJson(fn)).toBe(fn)
  })
})
