import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emitSharedVueEntryAssets } from './shared'

const emitPlatformTemplateAssetMock = vi.hoisted(() => vi.fn())
const emitClassStyleWxsAssetIfMissingMock = vi.hoisted(() => vi.fn())
const emitScopedSlotAssetsMock = vi.hoisted(() => vi.fn())
const resolveClassStyleWxsLocationForBaseMock = vi.hoisted(() => vi.fn(() => ({
  fileName: 'pages/index/__class_style.sjs',
})))
const getClassStyleWxsSourceMock = vi.hoisted(() => vi.fn(() => 'module.exports = {}'))

vi.mock('./platform', () => ({
  emitPlatformTemplateAsset: emitPlatformTemplateAssetMock,
}))

vi.mock('../emitAssets', () => ({
  emitClassStyleWxsAssetIfMissing: emitClassStyleWxsAssetIfMissingMock,
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
    emitScopedSlotAssetsMock.mockReset()
    resolveClassStyleWxsLocationForBaseMock.mockClear()
    getClassStyleWxsSourceMock.mockClear()
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
})
