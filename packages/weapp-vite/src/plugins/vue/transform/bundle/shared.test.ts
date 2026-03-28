import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitSharedFallbackPageAssets, emitSharedVueEntryAssets, emitSharedVueEntryJsonAsset, resolveVueBundleAssetContext } from './shared'

const emitPlatformTemplateAssetMock = vi.hoisted(() => vi.fn())
const emitClassStyleWxsAssetIfMissingMock = vi.hoisted(() => vi.fn())
const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitSfcStyleIfMissingMock = vi.hoisted(() => vi.fn())
const emitScopedSlotAssetsMock = vi.hoisted(() => vi.fn())
const resolveClassStyleWxsLocationForBaseMock = vi.hoisted(() => vi.fn(() => ({
  fileName: 'pages/index/__class_style.sjs',
})))
const getClassStyleWxsSourceMock = vi.hoisted(() => vi.fn(() => 'module.exports = {}'))
const preparePlatformConfigAssetMock = vi.hoisted(() => vi.fn(() => '{"component":true}'))

vi.mock('./platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./platform')>()
  return {
    ...actual,
    emitPlatformTemplateAsset: emitPlatformTemplateAssetMock,
    preparePlatformConfigAsset: preparePlatformConfigAssetMock,
  }
})

vi.mock('../emitAssets', () => ({
  emitClassStyleWxsAssetIfMissing: emitClassStyleWxsAssetIfMissingMock,
  emitSfcJsonAsset: emitSfcJsonAssetMock,
  emitSfcStyleIfMissing: emitSfcStyleIfMissingMock,
}))

vi.mock('../scopedSlot', () => ({
  emitScopedSlotAssets: emitScopedSlotAssetsMock,
}))

vi.mock('../classStyle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../classStyle')>()
  return {
    ...actual,
    resolveClassStyleWxsLocationForBase: resolveClassStyleWxsLocationForBaseMock,
  }
})

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    ...actual,
    getClassStyleWxsSource: getClassStyleWxsSourceMock,
  }
})

describe('emitSharedVueEntryAssets', () => {
  beforeEach(() => {
    emitPlatformTemplateAssetMock.mockReset()
    emitClassStyleWxsAssetIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitScopedSlotAssetsMock.mockReset()
    resolveClassStyleWxsLocationForBaseMock.mockClear()
    getClassStyleWxsSourceMock.mockClear()
    preparePlatformConfigAssetMock.mockReset()
    preparePlatformConfigAssetMock.mockReturnValue('{"component":true}')
  })

  it('emits template, class style wxs, and scoped slot assets through shared flow', () => {
    const result = emitSharedVueEntryAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      ctx: {} as any,
      filename: '/project/src/pages/index/index.vue',
      relativeBase: 'pages/index/index',
      result: {
        template: '<view />',
        classStyleWxs: true,
        scopedSlotComponents: [],
      } as any,
      configService: { platform: 'alipay' } as any,
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      scopedSlotDefaults: { component: true },
      scopedSlotMergeStrategy: 'override',
    })

    expect(emitPlatformTemplateAssetMock).toHaveBeenCalledTimes(1)
    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/__class_style.sjs',
      'module.exports = {}',
    )
    expect(emitScopedSlotAssetsMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      expect.objectContaining({ template: '<view />' }),
      expect.anything(),
      {
        fileName: 'pages/index/__class_style.sjs',
        source: 'module.exports = {}',
      },
      {},
      {
        defaults: { component: true },
        mergeStrategy: 'override',
      },
    )
    expect(result).toEqual({
      classStyleWxs: {
        fileName: 'pages/index/__class_style.sjs',
        source: 'module.exports = {}',
      },
    })
  })

  it('resolves shared bundle asset context from config service', () => {
    expect(resolveVueBundleAssetContext({
      platform: 'alipay',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'mjs',
        wxs: 'sjs',
      },
      packageJson: {
        dependencies: {
          dayjs: '^1.11.0',
        },
      },
      weappViteConfig: {
        npm: {
          alipayNpmMode: 'node_modules',
        },
      },
    } as any)).toEqual({
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        json: 'json',
        js: 'mjs',
        wxs: 'sjs',
      },
      templateExtension: 'axml',
      styleExtension: 'acss',
      jsonExtension: 'json',
      scriptExtension: 'mjs',
      scriptModuleExtension: 'sjs',
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
        dependencies: {
          dayjs: '^1.11.0',
        },
        alipayNpmMode: 'node_modules',
      },
    })
  })

  it('normalizes config before emitting shared json asset', () => {
    emitSharedVueEntryJsonAsset({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/index/index',
      config: '{"component":true}',
      outputExtensions: { wxml: 'axml' },
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      jsonOptions: {
        defaultConfig: { component: true },
        mergeExistingAsset: true,
        defaults: { styleIsolation: 'apply-shared' },
        mergeStrategy: 'override' as any,
        kind: 'page',
        extension: 'json',
      },
    })

    expect(preparePlatformConfigAssetMock).toHaveBeenCalledTimes(1)
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      { config: '{"component":true}' },
      {
        defaultConfig: { component: true },
        mergeExistingAsset: true,
        defaults: { styleIsolation: 'apply-shared' },
        mergeStrategy: 'override',
        kind: 'page',
        extension: 'json',
      },
    )
  })

  it('emits fallback page style and shared page json asset', () => {
    emitSharedFallbackPageAssets({
      bundle: {},
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/index/index',
      result: {
        style: '.page{}',
        config: '{"navigationBarTitleText":"首页"}',
      },
      outputExtensions: {},
      platformAssetOptions: {
        platform: 'alipay',
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
      },
      styleExtension: 'acss',
      jsonExtension: 'json',
      jsonDefaults: { navigationStyle: 'default' },
      jsonMergeStrategy: 'override' as any,
    })

    expect(emitSfcStyleIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      '.page{}',
      'acss',
    )
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/index/index',
      { config: '{"component":true}' },
      {
        mergeExistingAsset: true,
        mergeStrategy: 'override',
        defaults: { navigationStyle: 'default' },
        kind: 'page',
        extension: 'json',
      },
    )
  })
})
