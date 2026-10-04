import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGenerateBundleHook } from './emit'
import { createPlatformApiAccessCollector } from './platformApiRewrite'

vi.mock('./platformApiRewrite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./platformApiRewrite')>()
  return { ...actual, createPlatformApiAccessCollector: vi.fn(actual.createPlatformApiAccessCollector) }
})

describe('generate bundle platform analysis consumers', () => {
  beforeEach(() => {
    vi.mocked(createPlatformApiAccessCollector).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    { platform: 'weapp', replaceWx: false, plugin: false, hasConsumer: false },
    { platform: 'weapp', replaceWx: true, plugin: false, hasConsumer: true },
    { platform: 'alipay', replaceWx: false, plugin: false, hasConsumer: false },
    { platform: 'alipay', replaceWx: true, plugin: false, hasConsumer: true },
    { platform: 'weapp', replaceWx: true, plugin: true, hasConsumer: false },
  ])('collects only for a consumer: $platform, replaceWx=$replaceWx, plugin=$plugin', async ({ platform, replaceWx, plugin, hasConsumer }) => {
    const state = {
      ctx: {
        scanService: { subPackageMap: new Map() },
        configService: {
          isDev: false,
          platform,
          pluginOnly: plugin,
          packageJson: { dependencies: { 'tdesign-miniprogram': '^1.12.3' } },
          weappViteConfig: { injectWeapi: { enabled: true, replaceWx } },
        },
      },
      entriesMap: new Map(),
      pendingIndependentBuilds: [],
      hmrState: { didEmitAllEntries: false, hasBuiltOnce: false },
      hmrSharedChunksMode: 'auto',
      hmrSharedChunkImporters: new Map(),
    } as any
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const dep = require("tdesign-miniprogram/toast/index"); exports.value = wx.getStorageSync("key")',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await createGenerateBundleHook(state, plugin).call({}, {}, bundle)

    expect(createPlatformApiAccessCollector).toHaveBeenCalledTimes(hasConsumer ? 1 : 0)
    expect(bundle['common.js'].code).toContain(platform === 'alipay'
      ? '/node_modules/tdesign-miniprogram/toast/index'
      : './miniprogram_npm/tdesign-miniprogram/toast/index')
    expect(bundle['common.js'].code.includes('wx.getStorageSync')).toBe(!hasConsumer)
  })
})
