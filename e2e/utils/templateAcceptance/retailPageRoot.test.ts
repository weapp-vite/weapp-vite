import { describe, expect, it, vi } from 'vitest'
import { queryRetailPageRoot } from './retailPageRoot'

describe('retail complete document roots', () => {
  it('captures every original root and their joined bytes in one protocol read per root', async () => {
    const fragments = ['<view id="header">header</view>', '<view id="body">body</view>', '<custom-tab-bar>cart</custom-tab-bar>']
    const roots = fragments.map(wxml => ({ wxml: vi.fn(async () => wxml) }))
    const root = await queryRetailPageRoot({ getElementsByXpath: async () => roots })

    expect(await root!.capture()).toEqual({ roots: fragments, rawWxml: fragments.join('') })
    for (const item of roots) {
      expect(item.wxml).toHaveBeenCalledTimes(1)
    }
  })

  it('preserves all sibling page views and the independent tabbar in document order', async () => {
    const home = '<view class="home-page-header">header</view><view class="home-page-container"><goods-card>goods</goods-card></view>'
    const tabbar = '<custom-tab-bar><button>cart</button></custom-tab-bar>'
    const roots = [home, tabbar].map(wxml => ({
      tagName: '#shadow-root',
      wxml: vi.fn(async () => wxml),
      outerWxml: vi.fn(async () => `<#shadow-root>${wxml}</#shadow-root>`),
    }))
    const page = { getElementsByXpath: vi.fn(async () => roots) }

    const root = await queryRetailPageRoot(page)

    expect(page.getElementsByXpath).toHaveBeenCalledExactlyOnceWith('/*', { fallback: false, timeout: 2500 })
    expect(await root?.wxml()).toBe(home + tabbar)
    for (const item of roots) {
      expect(item.wxml).toHaveBeenCalledTimes(1)
      expect(item.outerWxml).not.toHaveBeenCalled()
    }
  })

  it('keeps the outer tags of every ordinary native root instead of selecting the longest view', async () => {
    const fragments = ['<view id="header">header</view>', '<view id="goods">goods</view>', '<text id="footer">footer</text>']
    const roots = fragments.map(wxml => ({
      tagName: 'view',
      wxml: vi.fn(async () => 'partial inner content'),
      outerWxml: vi.fn(async () => wxml),
    }))

    const root = await queryRetailPageRoot({ getElementsByXpath: async () => roots })

    expect(await root?.wxml()).toBe(fragments.join(''))
    expect(roots.every(item => item.wxml.mock.calls.length === 0)).toBe(true)
  })

  it('uses the complete outer WXML returned by headless root handles', async () => {
    const fragments = ['<page><view>header</view><view>goods</view></page>', '<custom-tab-bar>cart</custom-tab-bar>']
    const root = await queryRetailPageRoot({
      getElementsByXpath: async () => fragments.map(wxml => ({ wxml: async () => wxml })),
    })

    expect(await root?.wxml()).toBe(fragments.join(''))
  })

  it('returns null only when the native document query has no roots', async () => {
    expect(await queryRetailPageRoot({ getElementsByXpath: async () => [] })).toBeNull()
  })

  it('preserves a native query failure instead of treating it as an empty page', async () => {
    const error = new Error('native root query failed')
    await expect(queryRetailPageRoot({
      getElementsByXpath: async () => {
        throw error
      },
    })).rejects.toBe(error)
  })

  it('fails the entire document read when an independent root cannot be read', async () => {
    const error = new Error('independent tabbar root read failed')
    const root = await queryRetailPageRoot({
      getElementsByXpath: async () => [
        { tagName: '#shadow-root', wxml: async () => '<view>complete page</view>' },
        { tagName: '#shadow-root', wxml: async () => { throw error } },
      ],
    })

    await expect(root!.wxml()).rejects.toBe(error)
  })

  it('rejects incomplete protocol values instead of silently dropping a root', async () => {
    const root = await queryRetailPageRoot({
      getElementsByXpath: async () => [{ wxml: async () => undefined as unknown as string }],
    })

    await expect(root!.wxml()).rejects.toThrow('did not return complete WXML')
  })
})
