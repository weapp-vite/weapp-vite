import { describe, expect, it } from 'vitest'
import { TDesignResolver, VantResolver, WeuiResolver } from './index'
import tdesignComponents from './json/tdesign.json'
import vantComponents from './json/vant.json'
import weuiComponents from './json/weui.json'

describe('TDesignResolver', () => {
  const resolver = TDesignResolver()

  it('maps known components with default prefix', () => {
    expect(resolver('t-button', 't-button')).toEqual({
      name: 't-button',
      from: 'tdesign-miniprogram/button/button',
    })
  })

  it('returns undefined for unknown components', () => {
    expect(resolver('t-unknown', 't-unknown')).toBeUndefined()
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(tdesignComponents.length)
    expect(resolver.components?.['t-avatar']).toBe('tdesign-miniprogram/avatar/avatar')
  })

  it('supports custom prefix', () => {
    const custom = TDesignResolver({ prefix: 'td-' })
    expect(custom('td-form', 'td-form')).toEqual({
      name: 'td-form',
      from: 'tdesign-miniprogram/form/form',
    })
    expect(custom('t-form', 't-form')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = TDesignResolver({
      resolve: ({ name }) => ({ key: `x-${name}`, value: `custom/${name}` }),
    })
    expect(custom('x-dialog', 'x-dialog')).toEqual({ name: 'x-dialog', from: 'custom/dialog' })
  })
})

describe('VantResolver', () => {
  const resolver = VantResolver()

  it('maps known components with default prefix', () => {
    expect(resolver('van-button', 'van-button')).toEqual({ name: 'van-button', from: '@vant/weapp/button' })
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(vantComponents.length)
    expect(resolver.components?.['van-cell']).toBe('@vant/weapp/cell')
  })

  it('supports custom prefix', () => {
    const custom = VantResolver({ prefix: 'v-' })
    expect(custom('v-popup', 'v-popup')).toEqual({ name: 'v-popup', from: '@vant/weapp/popup' })
    expect(custom('van-popup', 'van-popup')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = VantResolver({
      resolve: ({ name }) => ({ key: `van-${name}-alt`, value: `alt/${name}` }),
    })
    expect(custom('van-search-alt', 'van-search-alt')).toEqual({ name: 'van-search-alt', from: 'alt/search' })
  })
})

describe('WeuiResolver', () => {
  const resolver = WeuiResolver()

  it('maps known components with default prefix', () => {
    expect(resolver('mp-form', 'mp-form')).toEqual({ name: 'mp-form', from: 'weui-miniprogram/form/form' })
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(weuiComponents.length)
    expect(resolver.components?.['mp-badge']).toBe('weui-miniprogram/badge/badge')
  })

  it('supports custom prefix', () => {
    const custom = WeuiResolver({ prefix: 'wx-' })
    expect(custom('wx-tabbar', 'wx-tabbar')).toEqual({
      name: 'wx-tabbar',
      from: 'weui-miniprogram/tabbar/tabbar',
    })
    expect(custom('mp-tabbar', 'mp-tabbar')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = WeuiResolver({
      resolve: ({ name }) => ({ key: `weui-${name}`, value: `patched/${name}` }),
    })
    expect(custom('weui-dialog', 'weui-dialog')).toEqual({ name: 'weui-dialog', from: 'patched/dialog' })
  })
})
