import type { Resolver } from './types'
import { describe, expect, it } from 'vitest'
import { TDesignResolver, UviewPlusResolver, VantResolver, WeuiResolver, WotUiResolver } from './index'
import tdesignComponents from './json/tdesign.json'
import uviewPlusComponents from './json/uviewPlus.json'
import vantComponents from './json/vant.json'
import weuiComponents from './json/weui.json'
import wotUiComponents from './json/wotUi.json'

function resolveWithResolver(resolver: Resolver, componentName: string, baseName = componentName) {
  if (typeof resolver.resolve === 'function') {
    return resolver.resolve(componentName, baseName)
  }
  const from = resolver.components?.[componentName]
  if (from) {
    return { name: componentName, from }
  }
  if (typeof resolver === 'function') {
    return resolver(componentName, baseName)
  }
  return undefined
}

describe('TDesignResolver', () => {
  const resolver = TDesignResolver()

  it('maps known components with default prefix', () => {
    expect(resolveWithResolver(resolver, 't-button')).toEqual({
      name: 't-button',
      from: 'tdesign-miniprogram/button/button',
    })
  })

  it('returns undefined for unknown components', () => {
    expect(resolveWithResolver(resolver, 't-unknown')).toBeUndefined()
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(tdesignComponents.length)
    expect(resolver.components?.['t-avatar']).toBe('tdesign-miniprogram/avatar/avatar')
  })

  it('supports custom prefix', () => {
    const custom = TDesignResolver({ prefix: 'td-' })
    expect(resolveWithResolver(custom, 'td-form')).toEqual({
      name: 'td-form',
      from: 'tdesign-miniprogram/form/form',
    })
    expect(resolveWithResolver(custom, 't-form')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = TDesignResolver({
      resolve: ({ name }) => ({ key: `x-${name}`, value: `custom/${name}` }),
    })
    expect(resolveWithResolver(custom, 'x-dialog')).toEqual({ name: 'x-dialog', from: 'custom/dialog' })
  })

  it('exposes external metadata candidates for known imports', () => {
    expect(resolver.resolveExternalMetadataCandidates?.('tdesign-miniprogram/button/button')).toEqual({
      packageName: 'tdesign-miniprogram',
      dts: [
        'miniprogram_dist/button/type.d.ts',
        'miniprogram_dist/button/props.d.ts',
        'miniprogram_dist/button/button.d.ts',
        'miniprogram_dist/button/index.d.ts',
      ],
      js: [
        'miniprogram_dist/button/type.js',
        'miniprogram_dist/button/props.js',
        'miniprogram_dist/button/button.js',
        'miniprogram_dist/button/index.js',
      ],
    })
    expect(resolver.resolveExternalMetadataCandidates?.('some-lib/button')).toBeUndefined()
  })
})

describe('VantResolver', () => {
  const resolver = VantResolver()

  it('maps known components with default prefix', () => {
    expect(resolveWithResolver(resolver, 'van-button')).toEqual({ name: 'van-button', from: '@vant/weapp/button' })
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(vantComponents.length)
    expect(resolver.components?.['van-cell']).toBe('@vant/weapp/cell')
  })

  it('supports custom prefix', () => {
    const custom = VantResolver({ prefix: 'v-' })
    expect(resolveWithResolver(custom, 'v-popup')).toEqual({ name: 'v-popup', from: '@vant/weapp/popup' })
    expect(resolveWithResolver(custom, 'van-popup')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = VantResolver({
      resolve: ({ name }) => ({ key: `van-${name}-alt`, value: `alt/${name}` }),
    })
    expect(resolveWithResolver(custom, 'van-search-alt')).toEqual({ name: 'van-search-alt', from: 'alt/search' })
  })

  it('exposes external metadata candidates for known imports', () => {
    expect(resolver.resolveExternalMetadataCandidates?.('@vant/weapp/button')).toEqual({
      packageName: '@vant/weapp',
      dts: ['lib/button/index.d.ts', 'dist/button/index.d.ts'],
      js: ['lib/button/index.js', 'dist/button/index.js'],
    })
    expect(resolver.resolveExternalMetadataCandidates?.('some-lib/button')).toBeUndefined()
  })
})

describe('WeuiResolver', () => {
  const resolver = WeuiResolver()

  it('maps known components with default prefix', () => {
    expect(resolveWithResolver(resolver, 'mp-form')).toEqual({ name: 'mp-form', from: 'weui-miniprogram/form/form' })
  })

  it('exposes static component map matching source json', () => {
    expect(Object.keys(resolver.components ?? {}).length).toBe(weuiComponents.length)
    expect(resolver.components?.['mp-badge']).toBe('weui-miniprogram/badge/badge')
  })

  it('supports custom prefix', () => {
    const custom = WeuiResolver({ prefix: 'wx-' })
    expect(resolveWithResolver(custom, 'wx-tabbar')).toEqual({
      name: 'wx-tabbar',
      from: 'weui-miniprogram/tabbar/tabbar',
    })
    expect(resolveWithResolver(custom, 'mp-tabbar')).toBeUndefined()
  })

  it('accepts custom resolve logic', () => {
    const custom = WeuiResolver({
      resolve: ({ name }) => ({ key: `weui-${name}`, value: `patched/${name}` }),
    })
    expect(resolveWithResolver(custom, 'weui-dialog')).toEqual({ name: 'weui-dialog', from: 'patched/dialog' })
  })
})

describe('WotUiResolver', () => {
  const resolver = WotUiResolver()

  it('maps all public Wot UI Vue SFC components', () => {
    expect(Object.keys(resolver.components ?? {})).toHaveLength(99)
    expect(Object.keys(resolver.components ?? {}).sort()).toEqual([...wotUiComponents].sort())
    expect(resolveWithResolver(resolver, 'wd-button')).toEqual({
      name: 'wd-button',
      from: '@wot-ui/ui/components/wd-button/wd-button.vue',
      resolvedId: '@wot-ui/ui/components/wd-button/wd-button.vue',
      sourceType: 'wevu-sfc',
      typeImport: false,
    })
    expect(resolveWithResolver(resolver, 'wd-swiper-nav')).toEqual({
      name: 'wd-swiper-nav',
      from: '@wot-ui/ui/components/wd-swiper-nav/wd-swiper-nav.vue',
      resolvedId: '@wot-ui/ui/components/wd-swiper-nav/wd-swiper-nav.vue',
      sourceType: 'wevu-sfc',
      typeImport: false,
    })
  })

  it('supports a custom prefix and used-only support files', () => {
    const custom = WotUiResolver({ prefix: 'wot-' })
    expect(resolveWithResolver(custom, 'wot-button')?.from).toBe('@wot-ui/ui/components/wd-button/wd-button.vue')
    expect(resolveWithResolver(custom, 'wd-button')).toBeUndefined()
    expect(custom.supportFilesStrategy).toBe('used')
  })

  it('exposes package metadata candidates', () => {
    expect(resolver.resolveExternalMetadataCandidates?.('@wot-ui/ui/components/wd-button/wd-button.vue')).toEqual({
      packageName: '@wot-ui/ui',
      dts: [
        'components/wd-button/wd-button.d.ts',
        'components/wd-button/types.d.ts',
        'components/wd-button/type.d.ts',
        'global.d.ts',
      ],
      js: [],
    })
  })
})

describe('UviewPlusResolver', () => {
  const resolver = UviewPlusResolver()

  it('maps all published Vue SFC entries under both supported prefixes', () => {
    expect(Object.keys(resolver.components ?? {})).toHaveLength(274)
    expect(uviewPlusComponents).toHaveLength(137)
    expect(resolveWithResolver(resolver, 'u-button')).toEqual({
      name: 'u-button',
      from: 'uview-plus/components/u-button/u-button.vue',
      resolvedId: expect.stringMatching(/uview-plus[\\/]components[\\/]u-button[\\/]u-button\.vue$/),
      sourceType: 'wevu-sfc',
      typeImport: false,
    })
    expect(resolveWithResolver(resolver, 'up-button')).toEqual({
      name: 'up-button',
      from: 'uview-plus/components/u-button/u-button.vue',
      resolvedId: expect.stringMatching(/uview-plus[\\/]components[\\/]u-button[\\/]u-button\.vue$/),
      sourceType: 'wevu-sfc',
      typeImport: false,
    })
    expect(resolveWithResolver(resolver, 'up-action-sheet-data')?.from)
      .toBe('uview-plus/components/u-action-sheet-data/u-action-sheet-data.vue')
    expect(resolveWithResolver(resolver, 'up-unknown')).toBeUndefined()
  })

  it('supports full support-file generation', () => {
    expect(resolver.supportFilesStrategy).toBe('used')
    expect(UviewPlusResolver({ supportFilesStrategy: 'full' }).supportFilesStrategy).toBe('full')
  })

  it('exposes component source and package type metadata candidates', () => {
    expect(resolver.resolveExternalMetadataCandidates?.('uview-plus/components/u-button/u-button.vue')).toEqual({
      packageName: 'uview-plus',
      dts: [
        'types/comps/button.d.ts',
        'types/comps.d.ts',
        'types/index.d.ts',
      ],
      js: [
        'components/u-button/props.js',
        'components/u-button/button.js',
      ],
    })
    expect(resolver.resolveExternalMetadataCandidates?.('uview-plus/components/u-loading-icon/u-loading-icon.vue')).toEqual({
      packageName: 'uview-plus',
      dts: [
        'types/comps/loadingIcon.d.ts',
        'types/comps.d.ts',
        'types/index.d.ts',
      ],
      js: [
        'components/u-loading-icon/props.js',
        'components/u-loading-icon/loadingIcon.js',
        'components/u-loading-icon/loadingicon.js',
      ],
    })
    expect(resolver.resolveExternalMetadataCandidates?.('uview-plus/components/u-missing/u-missing.vue')).toBeUndefined()
    expect(resolver.resolveExternalMetadataCandidates?.('some-lib/u-button.vue')).toBeUndefined()
  })
})
