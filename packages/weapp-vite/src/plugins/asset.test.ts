import type { Buffer } from 'node:buffer'
import type { OutputBundle } from 'rolldown'
import { describe, expect, it, vi } from 'vitest'
import { collectAssetModuleSourcePaths, collectBundledAssetSourcePaths, patchScopedSlotHostAssetsInBundle } from './asset'

describe('asset plugin bundled source collection', () => {
  it('collects normalized original asset source paths from emitted bundle assets', () => {
    const bundle: OutputBundle = {
      'goods-1-abc123.png': {
        type: 'asset',
        fileName: 'goods-1-abc123.png',
        names: ['goods-1.png'],
        needsCodeReference: false,
        originalFileNames: [
          '/project/src/assets/images/home/goods-1.png',
          'C:\\project\\src\\assets\\images\\home\\banner-1.jpg',
        ],
        source: new Uint8Array(),
      },
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: '',
        map: null,
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        moduleIds: [],
        exports: [],
        modules: {},
      },
    } as unknown as OutputBundle

    expect(collectBundledAssetSourcePaths(bundle)).toEqual(new Set([
      '/project/src/assets/images/home/goods-1.png',
      'C:/project/src/assets/images/home/banner-1.jpg',
    ]))
  })

  it('ignores bundle entries without original source file metadata', () => {
    const bundle: OutputBundle = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        names: ['app.wxss'],
        needsCodeReference: false,
        originalFileNames: [],
        source: '.root{}',
      },
    } as unknown as OutputBundle

    expect(collectBundledAssetSourcePaths(bundle)).toEqual(new Set())
  })

  it('normalizes module ids and strips resource query suffixes', () => {
    expect(collectAssetModuleSourcePaths([
      '/project/src/assets/images/home/goods-1.png?import',
      'C:\\project\\src\\assets\\images\\home\\banner-1.jpg#hash',
    ])).toEqual(new Set([
      '/project/src/assets/images/home/goods-1.png',
      'C:/project/src/assets/images/home/banner-1.jpg',
    ]))
  })

  it('patches native host assets used by scoped slot generics', () => {
    const emittedBuffer = new Map<string, Buffer>()
    const ctx = {
      configService: {
        outputExtensions: {
          wxml: 'wxml',
          json: 'json',
          js: 'js',
        },
        platform: 'weapp',
      },
      runtimeState: {
        asset: {
          emittedBuffer,
          scopedSlotGenerics: new Map([
            ['/components/native-tabbar/index', new Set(['scoped-slots-default'])],
          ]),
        },
      },
    } as any
    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/native-tabbar/index.json': {
        type: 'asset',
        source: '{ "component": true }',
      },
      'components/native-tabbar/index.wxml': {
        type: 'asset',
        source: '<view><slot /></view>',
      },
      'components/native-tabbar/index.js': {
        type: 'chunk',
        code: 'const runtime = require("../../../weapp-vendors/wevu-watch.js"); runtime.so({ options: { virtualHost: true } });',
      },
    }

    patchScopedSlotHostAssetsInBundle(ctx, { emitFile }, bundle)

    expect(JSON.parse(bundle['components/native-tabbar/index.json'].source).componentGenerics).toEqual({
      'scoped-slots-default': {
        default: './__weapp_vite_scoped_slot_generic_component',
      },
    })
    expect(bundle['components/native-tabbar/index.wxml'].source).toContain('<slot /><scoped-slots-default')
    expect(bundle['components/native-tabbar/index.wxml'].source).toContain('__wvSlotOwnerId="{{__wvSlotOwnerId}}"')
    expect(bundle['components/native-tabbar/index.js'].code).toContain('properties: {')
    expect(bundle['components/native-tabbar/index.js'].code).toContain('vueSlots')
    expect(bundle['components/native-tabbar/index.js'].code).toContain('__wvSlotOwnerId')
    expect(bundle['components/native-tabbar/index.js'].code).toContain('runtime.so({')
    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'components/native-tabbar/__weapp_vite_scoped_slot_generic_component.wxml',
      source: '<view wx:if="{{false}}" />',
    }))
    expect(emittedBuffer.has('components/native-tabbar/index.wxml')).toBe(true)
    expect(emittedBuffer.has('components/native-tabbar/index.js')).toBe(true)
  })
})
