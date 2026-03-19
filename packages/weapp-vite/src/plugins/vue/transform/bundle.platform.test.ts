import type { CompilerContext } from '../../../context'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const tempDirs: string[] = []

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

  afterEach(async () => {
    while (tempDirs.length) {
      const dir = tempDirs.pop()
      if (dir) {
        await fs.remove(dir)
      }
    }
  })

  async function createTempProject() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-layout-bundle-'))
    tempDirs.push(dir)
    return dir
  }

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
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(`
export default {
  setup() {
    return () => <view>new jsx source</view>
  },
}
` as never)
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
    expect(cached.source).toContain('new jsx source')
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

  it('wraps page templates for default and named vue layouts and respects layout false', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    await fs.ensureDir(path.join(srcRoot, 'layouts'))
    await fs.writeFile(path.join(srcRoot, 'layouts', 'default.vue'), '<template><slot /></template>', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'layouts', 'admin.vue'), '<template><slot /></template>', 'utf8')

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
      relativeOutputPath: (p: string) => path.relative(srcRoot, p),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const defaultPage = path.join(srcRoot, 'pages', 'layouts', 'default-demo', 'index.vue')
    const adminPage = path.join(srcRoot, 'pages', 'layouts', 'admin-demo', 'index.vue')
    const noLayoutPage = path.join(srcRoot, 'pages', 'layouts', 'no-layout-demo', 'index.vue')

    const compilationCache = new Map([
      [
        defaultPage,
        {
          source: '<template><view>default page</view></template>',
          result: {
            template: '<view>default page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'default' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
      [
        adminPage,
        {
          source: '<script setup>const layoutTitle = computed(() => \'Dashboard\'); definePageMeta({ layout: { name: \'admin\', props: { sidebar: true, title: layoutTitle.value } } })</script><template><view>admin page</view></template>',
          result: {
            template: '<view>admin page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'admin' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
      [
        noLayoutPage,
        {
          source: '<script setup>definePageMeta({ layout: false })</script><template><view>plain page</view></template>',
          result: {
            template: '<view>plain page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'plain' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    expect(assets.get('pages/layouts/default-demo/index.wxml')).toContain('<weapp-layout-default>')
    expect(assets.get('pages/layouts/admin-demo/index.wxml')).toContain('<weapp-layout-admin sidebar="{{true}}" title="{{__wv_layout_bind_title}}">')
    expect(assets.get('pages/layouts/no-layout-demo/index.wxml')).toBe('<view>plain page</view>')

    expect(JSON.parse(assets.get('pages/layouts/default-demo/index.json')!)).toEqual({
      navigationBarTitleText: 'default',
      usingComponents: {
        'weapp-layout-default': '/layouts/default',
      },
    })
    expect(JSON.parse(assets.get('pages/layouts/admin-demo/index.json')!)).toEqual({
      navigationBarTitleText: 'admin',
      usingComponents: {
        'weapp-layout-admin': '/layouts/admin',
      },
    })
    expect(JSON.parse(assets.get('pages/layouts/no-layout-demo/index.json')!)).toEqual({
      navigationBarTitleText: 'plain',
    })
  })

  it('emits a js stub for scriptless vue layouts required by page wrappers', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    await fs.ensureDir(path.join(srcRoot, 'layouts'))
    await fs.writeFile(path.join(srcRoot, 'layouts', 'default.vue'), '<template><slot /></template>', 'utf8')

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
      relativeOutputPath: (p: string) => path.relative(srcRoot, p).replace(/\\/g, '/'),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const scanService = {
      independentSubPackageMap: new Map(),
    } as unknown as CompilerContext['scanService']

    const ctx = {
      configService,
      scanService,
    } as CompilerContext

    const layoutFile = path.join(srcRoot, 'layouts', 'default.vue')
    const compilationCache = new Map([
      [
        layoutFile,
        {
          source: '<template><slot /></template>',
          result: {
            template: '<view><slot /></view>',
            config: JSON.stringify({ component: true }),
          },
          isPage: false,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    expect(assets.get('layouts/default.wxml')).toBe('<view><slot /></view>')
    expect(JSON.parse(assets.get('layouts/default.json')!)).toEqual({
      component: true,
    })
    expect(assets.get('layouts/default.js')).toBe('Component({})')
  })

  it('applies layout defaults from weapp.routeRules when page meta is absent', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    await fs.ensureDir(path.join(srcRoot, 'layouts'))
    await fs.writeFile(path.join(srcRoot, 'layouts', 'dashboard.vue'), '<template><slot /></template>', 'utf8')

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
        routeRules: {
          '/dashboard': {
            appLayout: {
              name: 'dashboard',
              props: {
                title: 'Rule Layout',
              },
            },
          },
        },
      },
      relativeOutputPath: (p: string) => path.relative(srcRoot, p),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const routeRulePage = path.join(srcRoot, 'pages', 'dashboard', 'index.vue')
    const compilationCache = new Map([
      [
        routeRulePage,
        {
          source: '<template><view>rule page</view></template>',
          result: {
            template: '<view>rule page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'route-rule' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    expect(assets.get('pages/dashboard/index.wxml')).toContain('<weapp-layout-dashboard title="Rule Layout">')
    expect(JSON.parse(assets.get('pages/dashboard/index.json')!)).toEqual({
      navigationBarTitleText: 'route-rule',
      usingComponents: {
        'weapp-layout-dashboard': '/layouts/dashboard',
      },
    })
  })

  it('prefers specific routeRules over wildcard routeRules in bundle emission', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    await fs.ensureDir(path.join(srcRoot, 'layouts'))
    await fs.writeFile(path.join(srcRoot, 'layouts', 'dashboard.vue'), '<template><slot /></template>', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'layouts', 'admin.vue'), '<template><slot /></template>', 'utf8')

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
        routeRules: {
          '/dashboard/**': { appLayout: 'dashboard' },
          '/dashboard/settings': { appLayout: 'admin' },
        },
      },
      relativeOutputPath: (p: string) => path.relative(srcRoot, p),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const settingsPage = path.join(srcRoot, 'pages', 'dashboard', 'settings', 'index.vue')
    const compilationCache = new Map([
      [
        settingsPage,
        {
          source: '<template><view>settings page</view></template>',
          result: {
            template: '<view>settings page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'settings' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    expect(assets.get('pages/dashboard/settings/index.wxml')).toContain('<weapp-layout-admin>')
    expect(JSON.parse(assets.get('pages/dashboard/settings/index.json')!)).toEqual({
      navigationBarTitleText: 'settings',
      usingComponents: {
        'weapp-layout-admin': '/layouts/admin',
      },
    })
  })

  it('emits dynamic layout branches for pages using setPageLayout', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    await fs.ensureDir(path.join(srcRoot, 'layouts'))
    await fs.writeFile(path.join(srcRoot, 'layouts', 'admin.vue'), '<template><slot /></template>', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'layouts', 'dashboard.vue'), '<template><slot /></template>', 'utf8')

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
      relativeOutputPath: (p: string) => path.relative(srcRoot, p),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const dynamicPage = path.join(srcRoot, 'pages', 'dynamic-layout', 'index.vue')
    const compilationCache = new Map([
      [
        dynamicPage,
        {
          source: '<script setup>import { setPageLayout } from \'wevu\'; setPageLayout(\'dashboard\', { title: dynamicTitle.value, sidebar: true })</script><template><view>dynamic page</view></template>',
          result: {
            template: '<view>dynamic page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'dynamic' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    const template = assets.get('pages/dynamic-layout/index.wxml')!
    expect(template).toContain(`wx:if="{{__wv_page_layout_name === 'admin'}}"`)
    expect(template).toContain(`wx:elif="{{__wv_page_layout_name === 'dashboard'}}"`)
    expect(template).toContain('<weapp-layout-dashboard title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}" sidebar="{{(__wv_page_layout_props&&__wv_page_layout_props.sidebar)}}">')
    expect(template).toContain(`title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}"`)
    expect(template).toContain(`sidebar="{{(__wv_page_layout_props&&__wv_page_layout_props.sidebar)}}"`)
    expect(JSON.parse(assets.get('pages/dynamic-layout/index.json')!)).toEqual({
      navigationBarTitleText: 'dynamic',
      usingComponents: {
        'weapp-layout-admin': '/layouts/admin',
        'weapp-layout-dashboard': '/layouts/dashboard',
      },
    })
  })

  it('emits native layout assets when a page selects a native layout', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    const nativeLayoutBase = path.join(srcRoot, 'layouts', 'native-shell', 'index')

    await fs.ensureDir(path.dirname(nativeLayoutBase))
    await fs.writeFile(`${nativeLayoutBase}.json`, JSON.stringify({ component: true }, null, 2), 'utf8')
    await fs.writeFile(`${nativeLayoutBase}.wxml`, '<view class="shell"><slot /></view>', 'utf8')
    await fs.writeFile(`${nativeLayoutBase}.wxss`, '.shell { color: #1677ff; }', 'utf8')
    await fs.writeFile(`${nativeLayoutBase}.js`, 'Component({})', 'utf8')

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
      relativeOutputPath: (p: string) => path.relative(srcRoot, p),
      absoluteSrcRoot: srcRoot,
    } as unknown as CompilerContext['configService']

    const ctx = {
      configService,
      scanService: {
        independentSubPackageMap: new Map(),
      },
    } as CompilerContext

    const nativePage = path.join(srcRoot, 'pages', 'layouts', 'native-demo', 'index.vue')
    const compilationCache = new Map([
      [
        nativePage,
        {
          source: '<script setup>const layoutTitle = computed(() => \'Native Dashboard\'); definePageMeta({ layout: { name: \'native-shell\', props: { sidebar: true, title: layoutTitle.value } } })</script><template><view>native page</view></template>',
          result: {
            template: '<view>native page</view>',
            config: JSON.stringify({ navigationBarTitleText: 'native' }),
            script: 'export default {}',
          },
          isPage: true,
        },
      ],
    ])

    const emitFile = vi.fn()
    const bundle: Record<string, any> = {}

    await emitVueBundleAssets(bundle, {
      ctx,
      pluginCtx: { emitFile, addWatchFile: vi.fn() },
      compilationCache,
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    })

    const assets = new Map<string, string>()
    for (const call of emitFile.mock.calls) {
      const asset = call[0]
      assets.set(asset.fileName, String(asset.source))
    }

    expect(assets.get('pages/layouts/native-demo/index.wxml')).toContain('<weapp-layout-native-shell sidebar="{{true}}" title="{{__wv_layout_bind_title}}">')
    expect(JSON.parse(assets.get('pages/layouts/native-demo/index.json')!)).toEqual({
      navigationBarTitleText: 'native',
      usingComponents: {
        'weapp-layout-native-shell': '/layouts/native-shell/index',
      },
    })
    expect(JSON.parse(assets.get('layouts/native-shell/index.json')!)).toEqual({
      component: true,
    })
    expect(assets.get('layouts/native-shell/index.wxml')).toContain('<slot />')
    expect(assets.get('layouts/native-shell/index.wxss')).toContain('.shell')
    expect(assets.get('layouts/native-shell/index.js')).toContain('Component({})')
  })
})
