import type { CompilerContext } from '../../../context'
import fs from 'fs-extra'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scanWxml } from '../../../wxml'
import { emitVueBundleAssets } from './bundle'

const collectFallbackPageEntryIdsMock = vi.hoisted(() => vi.fn(async () => new Set<string>()))
const injectWevuPageFeaturesInJsWithViteResolverMock = vi.hoisted(() => vi.fn(async (_ctx: any, code: string) => ({
  transformed: false,
  code,
})))
const compileJsxFileMock = vi.hoisted(() => vi.fn(async () => ({
  template: '<view/>',
  config: '{}',
  script: 'Page({})',
})))
const pathExistsCachedMock = vi.hoisted(() => vi.fn(async () => false))

vi.mock('./fallbackEntries', () => ({
  collectFallbackPageEntryIds: collectFallbackPageEntryIdsMock,
}))

vi.mock('./injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
}))

vi.mock('../../utils/cache', () => ({
  pathExists: pathExistsCachedMock,
}))

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    ...actual,
    compileJsxFile: compileJsxFileMock,
  }
})

describe('emitVueBundleAssets platform output', () => {
  beforeEach(() => {
    collectFallbackPageEntryIdsMock.mockResolvedValue(new Set<string>())
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: false,
      code: 'Page({})',
    })
    compileJsxFileMock.mockResolvedValue({
      template: '<view/>',
      config: '{}',
      script: 'Page({})',
    })
    pathExistsCachedMock.mockResolvedValue(false)
  })

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

  it('registers vue template tokens for wxs deps in self-closing and non-self-closing forms', async () => {
    const configService = {
      isDev: false,
      platform: 'weapp',
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        wxs: 'wxs',
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

    const tokenMap = new Map()
    const analyze = vi.fn((template: string) => {
      return scanWxml(template, { platform: 'weapp' })
    })

    const ctx = {
      configService,
      scanService,
      wxmlService: {
        analyze,
        tokenMap,
        setWxmlComponentsMap: vi.fn(),
      },
    } as unknown as CompilerContext

    const filePath = '/project/src/components/coupon-card/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view><wxs src="./self.wxs" module="self" /><wxs src="./normal.wxs" module="normal"></wxs></view>',
            config: '{}',
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

    expect(analyze).toHaveBeenCalledTimes(1)
    const token = tokenMap.get(filePath)
    const depValues = token?.deps?.map((dep: { value: string }) => dep.value) ?? []
    expect(depValues).toEqual(['./self.wxs', './normal.wxs'])
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

    expect(jsonAsset?.source).toContain('"t-button": "/node_modules/tdesign-miniprogram/button/button"')
    expect(jsonAsset?.source).toContain('\"kpi-board\": \"/components/KpiBoard/index\"')

    const scopedSlotJsonAsset = emitFile.mock.calls
      .map(call => call[0])
      .find(asset => asset?.fileName === 'pages/index/index.__scoped-slot-items-0.json')

    expect(scopedSlotJsonAsset?.source).not.toContain('\"t-button\": \"/node_modules/tdesign-miniprogram/button/button\"')
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

  it('recompiles cached jsx entries in dev mode and updates transformed page script', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('new jsx source' as never)
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValueOnce({
      transformed: true,
      code: '/* injected page */',
    })

    const configService = {
      isDev: true,
      platform: 'weapp',
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        wxs: 'wxs',
        json: 'json',
        js: 'js',
      },
      weappViteConfig: {
        json: {},
      },
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const filePath = '/project/src/pages/dev/index.jsx'
    const cached = {
      source: 'old jsx source',
      result: {
        template: '<view/>',
        config: '{}',
        script: 'Page({ old: true })',
      },
      isPage: true,
    }
    const compilationCache = new Map([[filePath, cached]])
    const emitFile = vi.fn()
    const addWatchFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    expect(addWatchFile).toHaveBeenCalled()
    expect(compileJsxFileMock).toHaveBeenCalledTimes(1)
    expect(cached.source).toBe('new jsx source')
    expect(cached.result.script).toBe('/* injected page */')
    readFileSpy.mockRestore()
  })

  it('handles invalid alipay config/template inputs without crashing', async () => {
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
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const filePath = '/project/src/pages/bad/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view',
            config: '{ broken json }',
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
      .find(asset => asset?.fileName === 'pages/bad/index.axml')
    expect(templateAsset?.source).toBe('<view')
  })

  it('skips generic placeholder emission for unsupported componentGenerics values', async () => {
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
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const filePath = '/project/src/components/NoGeneric/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view/>',
            config: JSON.stringify({
              component: true,
              componentGenerics: {
                slotA: 'unsupported',
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
    expect(emittedFiles.some((name: string) => name?.includes('__weapp_vite_generic_component'))).toBe(false)
  })

  it('updates existing alipay placeholder script asset when source differs', async () => {
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
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const filePath = '/project/src/components/Updater/index.vue'
    const compilationCache = new Map([
      [
        filePath,
        {
          result: {
            template: '<view/>',
            config: JSON.stringify({
              component: true,
              componentGenerics: {
                slotA: true,
              },
            }),
          },
          isPage: false,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {
      'components/Updater/__weapp_vite_generic_component.js': {
        type: 'asset',
        source: 'old source',
      },
    }

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    expect(bundle['components/Updater/__weapp_vite_generic_component.js'].source).toBe('Component({})')
  })

  it('emits class-style wxs in fallback page compilation flow', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('export default () => <view />' as never)
    collectFallbackPageEntryIdsMock.mockResolvedValueOnce(new Set(['pages/fallback/index']))
    pathExistsCachedMock.mockImplementation(async (candidate: string) => candidate.endsWith('.jsx'))
    compileJsxFileMock.mockResolvedValueOnce({
      template: '<view/>',
      config: '{}',
      classStyleWxs: true,
      style: '.page{}',
    } as any)

    const configService = {
      isDev: false,
      platform: 'weapp',
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        wxs: 'wxs',
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
      relativeOutputPath: (p: string) => p.replace('/project/src/', ''),
      absoluteSrcRoot: '/project/src',
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}
    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache: new Map(),
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const emittedFiles = emitFile.mock.calls.map(call => call[0]?.fileName)
    expect(emittedFiles).toContain('__weapp_vite_class_style.wxs')
    readFileSpy.mockRestore()
  })
})
