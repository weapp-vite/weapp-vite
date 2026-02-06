import type { CompilerContext } from '../../../context'
import { describe, expect, it, vi } from 'vitest'
import { emitVueBundleAssets } from './bundle'

vi.mock('./fallbackEntries', () => ({
  collectFallbackPageEntryIds: vi.fn(async () => new Set()),
}))

describe('emitVueBundleAssets platform output', () => {
  it('uses platform output extensions for template, json, and wxs assets', async () => {
    const configService = {
      isDev: false,
      platform: 'alipay',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        wxs: 'sjs',
        json: 'json',
        js: 'js',
      },
      weappViteConfig: {
        json: {},
        vue: {
          template: {
            classStyleWxsShared: true,
          },
        },
      },
      relativeOutputPath: (p: string) => {
        return p.replace('/project/src/', '')
      },
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const scanService = {
      independentSubPackageMap: new Map(),
    } as unknown as CompilerContext['scanService']

    const ctx = {
      configService,
      scanService,
    } as CompilerContext

    const filePath = '/project/src/pages/index/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view/>',
            config: '{}',
            classStyleWxs: true,
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const emittedFiles = emitFile.mock.calls.map(call => call[0]?.fileName)
    expect(emittedFiles).toContain('pages/index/index.axml')
    expect(emittedFiles).toContain('pages/index/index.json')
    expect(emittedFiles).toContain('__weapp_vite_class_style.sjs')
  })

  it('normalizes pascal-case template tags for alipay output', async () => {
    const configService = {
      isDev: false,
      platform: 'alipay',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        wxs: 'sjs',
        json: 'json',
        js: 'js',
      },
      weappViteConfig: {
        json: {},
      },
      relativeOutputPath: (p: string) => {
        return p.replace('/project/src/', '')
      },
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const scanService = {
      independentSubPackageMap: new Map(),
    } as unknown as CompilerContext['scanService']

    const ctx = {
      configService,
      scanService,
    } as CompilerContext

    const filePath = '/project/src/pages/ability/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view><SectionTitle title="系统信息" /></view>',
            config: '{}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const templateAsset = emitFile.mock.calls
      .map(call => call[0])
      .find(asset => asset?.fileName === 'pages/ability/index.axml')

    expect(templateAsset?.source).toContain('<section-title title="系统信息" />')
    expect(templateAsset?.source).not.toContain('<SectionTitle')
  })

  it('normalizes vue json usingComponents paths for alipay output', async () => {
    const configService = {
      isDev: false,
      platform: 'alipay',
      packageJson: {
        dependencies: {
          'tdesign-miniprogram': '^1.12.3',
        },
      },
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        wxs: 'sjs',
        json: 'json',
        js: 'js',
      },
      weappViteConfig: {
        json: {},
      },
      relativeOutputPath: (p: string) => {
        return p.replace('/project/src/', '')
      },
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const scanService = {
      independentSubPackageMap: new Map(),
    } as unknown as CompilerContext['scanService']

    const ctx = {
      configService,
      scanService,
      wxmlService: {
        analyze: () => ({ components: {} }),
      },
      autoImportService: {
        resolve: () => undefined,
      },
    } as CompilerContext

    const filePath = '/project/src/pages/index/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view/>',
            config: JSON.stringify({
              usingComponents: {
                't-button': 'tdesign-miniprogram/button/button',
                'KpiBoard': '/components/KpiBoard/index',
              },
            }),
            scopedSlotComponents: [
              {
                id: 'items-0',
                componentName: 'ScopedSlotDemo',
                template: '<view/>',
              },
            ],
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const jsonAsset = emitFile.mock.calls
      .map(call => call[0])
      .find(asset => asset?.fileName === 'pages/index/index.json')

    expect(jsonAsset?.source).toContain('"t-button": "/miniprogram_npm/tdesign-miniprogram/button/button"')
    expect(jsonAsset?.source).toContain('\"kpi-board\": \"/components/KpiBoard/index\"')

    const scopedSlotJsonAsset = emitFile.mock.calls
      .map(call => call[0])
      .find(asset => asset?.fileName === 'pages/index/index.__scoped-slot-items-0.json')

    expect(scopedSlotJsonAsset?.source).not.toContain('\"t-button\": \"/miniprogram_npm/tdesign-miniprogram/button/button\"')
  })

  it('emits alipay generic placeholder component when componentGenerics exists', async () => {
    const configService = {
      isDev: false,
      platform: 'alipay',
      outputExtensions: {
        wxml: 'axml',
        wxss: 'acss',
        wxs: 'sjs',
        json: 'json',
        js: 'js',
      },
      weappViteConfig: {
        json: {},
      },
      relativeOutputPath: (p: string) => {
        return p.replace('/project/src/', '')
      },
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const scanService = {
      independentSubPackageMap: new Map(),
    } as unknown as CompilerContext['scanService']

    const ctx = {
      configService,
      scanService,
    } as CompilerContext

    const filePath = '/project/src/components/KpiBoard/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view/>',
            config: JSON.stringify({
              component: true,
              componentGenerics: {
                'scoped-slots-items': true,
              },
            }),
          },
          isPage: false,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const emittedFiles = emitFile.mock.calls.map(call => call[0]?.fileName)
    expect(emittedFiles).toContain('components/KpiBoard/__weapp_vite_generic_component.axml')
    expect(emittedFiles).toContain('components/KpiBoard/__weapp_vite_generic_component.json')
    expect(emittedFiles).toContain('components/KpiBoard/__weapp_vite_generic_component.js')

    const jsonAsset = emitFile.mock.calls
      .map(call => call[0])
      .find(asset => asset?.fileName === 'components/KpiBoard/index.json')

    expect(jsonAsset?.source).toContain('"default": "./__weapp_vite_generic_component"')
  })
})
