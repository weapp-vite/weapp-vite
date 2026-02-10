import type { OutputBundle } from 'rollup'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { buildWeappVueStyleRequest, WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from '../../src/plugins/vue/transform/styleRequest'
import { normalizeWatchPath } from '../../src/utils/path'

const compileVueFileMock = vi.fn<
  (source: string, filename: string, options?: any) => Promise<any>
>()
const readAndParseSfcMock = vi.fn()
const injectPageFeaturesMock = vi.fn<
  (pluginCtx: any, code: string, filename: string, options: any) => Promise<{ transformed: boolean, code: string }>
>()
const createUsingComponentPathResolverMock = vi.fn(() => {
  return async (importSource: string) => importSource
})
const getSourceFromVirtualIdMock = vi.fn((id: string) => id)
const createPageEntryMatcherMock = vi.fn(() => {
  return {
    markDirty: vi.fn(),
    isPageFile: vi.fn(async () => false),
  }
})
const emitSfcTemplateIfMissingMock = vi.fn()
const emitSfcStyleIfMissingMock = vi.fn()
const emitSfcJsonAssetMock = vi.fn()
const emitClassStyleWxsAssetIfMissingMock = vi.fn()
const collectFallbackPageEntryIdsMock = vi.fn(async () => [] as string[])

vi.mock('wevu/compiler', async () => {
  const actual = await vi.importActual<typeof import('wevu/compiler')>('wevu/compiler')
  return { ...actual, compileVueFile: compileVueFileMock }
})
vi.mock('../../src/plugins/vue/transform/injectPageFeatures', () => {
  return { injectWevuPageFeaturesInJsWithViteResolver: injectPageFeaturesMock }
})
vi.mock('../../src/plugins/vue/transform/usingComponentResolver', () => {
  return { createUsingComponentPathResolver: createUsingComponentPathResolverMock }
})
vi.mock('../../src/plugins/utils/vueSfc', async () => {
  const actual = await vi.importActual<typeof import('../../src/plugins/utils/vueSfc')>('../../src/plugins/utils/vueSfc')
  return {
    ...actual,
    readAndParseSfc: vi.fn(async (filename: string, options: any) => {
      if (filename.includes('?')) {
        throw new Error(`query leaked into fs path: ${filename}`)
      }
      readAndParseSfcMock(filename)
      return actual.readAndParseSfc(filename, options)
    }),
  }
})
vi.mock('../../src/plugins/vue/resolver', () => {
  return { getSourceFromVirtualId: getSourceFromVirtualIdMock }
})
vi.mock('../../src/plugins/wevu', () => {
  return { createPageEntryMatcher: createPageEntryMatcherMock }
})
vi.mock('../../src/plugins/vue/transform/emitAssets', () => {
  return {
    emitClassStyleWxsAssetIfMissing: emitClassStyleWxsAssetIfMissingMock,
    emitSfcJsonAsset: emitSfcJsonAssetMock,
    emitSfcStyleIfMissing: emitSfcStyleIfMissingMock,
    emitSfcTemplateIfMissing: emitSfcTemplateIfMissingMock,
  }
})
vi.mock('../../src/plugins/vue/transform/fallbackEntries', () => {
  return { collectFallbackPageEntryIds: collectFallbackPageEntryIdsMock }
})

describe('vue transform plugin', () => {
  let tmpDir: string | undefined
  let vuePath: string | undefined
  let warnSpy: any
  let errorSpy: any

  beforeEach(async () => {
    warnSpy = vi.spyOn(logger as any, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(logger as any, 'error').mockImplementation(() => {})

    const root = path.resolve(os.tmpdir(), 'weapp-vite-vitest')
    await fs.ensureDir(root)

    tmpDir = await fs.mkdtemp(path.join(root, 'vue-plugin-'))
    vuePath = path.join(tmpDir, 'page.vue')
    await fs.writeFile(
      vuePath,
      `
<template><view /></template>
<script setup lang="ts">
</script>
<style>.a{color:red}</style>
<style scoped module>.b{color:blue}</style>
`,
      'utf8',
    )

    compileVueFileMock.mockReset()
    injectPageFeaturesMock.mockReset()
    createUsingComponentPathResolverMock.mockClear()
    getSourceFromVirtualIdMock.mockClear()
    createPageEntryMatcherMock.mockReset()
    emitSfcTemplateIfMissingMock.mockReset()
    emitSfcStyleIfMissingMock.mockReset()
    emitSfcJsonAssetMock.mockReset()
    emitClassStyleWxsAssetIfMissingMock.mockReset()
    collectFallbackPageEntryIdsMock.mockReset()
    readAndParseSfcMock.mockClear()
  })

  afterEach(async () => {
    warnSpy?.mockRestore()
    errorSpy?.mockRestore()

    if (tmpDir) {
      await fs.remove(tmpDir)
    }
    tmpDir = undefined
    vuePath = undefined
  })

  function createCtx(overrides: any = {}) {
    const ctx = {
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.basename(abs),
        outputExtensions: {},
        weappViteConfig: {},
      },
      scanService: {},
      runtimeState: {
        scan: { isDirty: false },
      },
      autoImportService: {
        resolve: (tag: string) => ({ kind: 'resolver', value: { name: tag, from: `lib/${tag}` } }),
      },
      ...overrides,
    }
    return ctx
  }

  it('transform() resolves shared class style wxs path by default', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const nestedVue = path.join(tmpDir!, 'pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleWxsSrc).toBe('../../__weapp_vite_class_style.wxs')
  })

  it('transform() defaults classStyleRuntime to js even when wxs is available', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const nestedVue = path.join(tmpDir!, 'pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {},
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleRuntime).toBe('js')
  })

  it('transform() uses local class style wxs path when sharing is disabled', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const nestedVue = path.join(tmpDir!, 'pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
              classStyleWxsShared: false,
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleWxsSrc).toBe('./__weapp_vite_class_style.wxs')
  })

  it('transform() resolves shared class style wxs path for independent subpackages', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const nestedVue = path.join(tmpDir!, 'subpkg/pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
      scanService: {
        independentSubPackageMap: new Map([['subpkg', { subPackage: { root: 'subpkg' } }]]),
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleWxsSrc).toBe('../../__weapp_vite_class_style.wxs')
  })

  it('transform() omits class style wxs src when wxs extension is missing', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: {},
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleRuntime).toBe('js')
    expect(options.template.classStyleWxsSrc).toBeUndefined()
  })

  it('transform() skips class style wxs src when output path is unavailable', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: () => undefined,
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(options.template.classStyleWxsSrc).toBeUndefined()
  })

  it('generateBundle() emits shared class style wxs asset when enabled', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })
    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      classStyleWxs: true,
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: false, code: 'export default {}' })

    const nestedVue = path.join(tmpDir!, 'pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: false,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const bundle: OutputBundle = {}
    await plugin.generateBundle!.call({} as any, {}, bundle)

    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      bundle,
      '__weapp_vite_class_style.wxs',
      expect.any(String),
    )
  })

  it('generateBundle() emits shared class style wxs asset for independent subpackages', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })
    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      classStyleWxs: true,
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: false, code: 'export default {}' })

    const nestedVue = path.join(tmpDir!, 'subpkg/pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: false,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
      scanService: {
        independentSubPackageMap: new Map([['subpkg', { subPackage: { root: 'subpkg' } }]]),
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const bundle: OutputBundle = {}
    await plugin.generateBundle!.call({} as any, {}, bundle)

    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      bundle,
      'subpkg/__weapp_vite_class_style.wxs',
      expect.any(String),
    )
  })

  it('generateBundle() skips class style wxs emission when extension is empty', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })
    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      classStyleWxs: true,
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: false, code: 'export default {}' })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: false,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: '' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const bundle: OutputBundle = {}
    await plugin.generateBundle!.call({} as any, {}, bundle)

    expect(emitClassStyleWxsAssetIfMissingMock).not.toHaveBeenCalled()
  })

  it('generateBundle() emits local class style wxs asset when sharing is disabled', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })
    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      classStyleWxs: true,
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: false, code: 'export default {}' })

    const nestedVue = path.join(tmpDir!, 'pages/index/page.vue')
    await fs.ensureDir(path.dirname(nestedVue))
    await fs.writeFile(nestedVue, '<template><view/></template>', 'utf8')

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: false,
        relativeOutputPath: (abs: string) => path.relative(tmpDir!, abs),
        outputExtensions: { wxs: 'wxs' },
        weappViteConfig: {
          vue: {
            template: {
              classStyleRuntime: 'wxs',
              classStyleWxsShared: false,
            },
          },
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(nestedVue, 'utf8'), nestedVue)

    const bundle: OutputBundle = {}
    await plugin.generateBundle!.call({} as any, {}, bundle)

    expect(emitClassStyleWxsAssetIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      bundle,
      'pages/index/__weapp_vite_class_style.wxs',
      expect.any(String),
    )
  })

  it('load() returns null for non-style requests', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    await expect(plugin.load!.call({}, vuePath!)).resolves.toBeNull()
    await expect(plugin.load!.call({}, `${vuePath}?weapp-vite-vue&type=script&index=0`)).resolves.toBeNull()
    await expect(plugin.load!.call({}, `${vuePath}?type=style&index=0`)).resolves.toBeNull()
    await expect(plugin.load!.call({}, `${vuePath}?weapp-vite-vue&type=style&index=-1`)).resolves.toBeNull()
  })

  it('load() returns cached style block content', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    compileVueFileMock.mockResolvedValue({ script: '', meta: {} })

    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const res = await plugin.load!.call({}, buildWeappVueStyleRequest(vuePath!, { lang: 'css' } as any, 1))
    expect(res).toEqual({ code: '.b{color:blue}', map: null })
  })

  it('load() strips query before reading vue file', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    const res = await plugin.load!.call({}, buildWeappVueStyleRequest(vuePath!, { lang: 'css' } as any, 0))
    expect(res).toEqual({ code: '.a{color:red}', map: null })
    expect(readAndParseSfcMock).toHaveBeenCalled()
    expect(readAndParseSfcMock).toHaveBeenCalledWith(vuePath!)
  })

  it('load() returns null when file missing or style index out of range', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    await expect(
      plugin.load!.call({}, buildWeappVueStyleRequest(path.join(tmpDir!, 'missing.vue'), { lang: 'css' } as any, 0)),
    ).resolves.toBeNull()
    await expect(plugin.load!.call({}, buildWeappVueStyleRequest(vuePath!, { lang: 'css' } as any, 99))).resolves.toBeNull()
  })

  it('transform() returns null for non-vue or missing configService', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')

    const plugin = createVueTransformPlugin(createCtx({ configService: undefined }) as any)
    await expect(plugin.transform!.call({}, '', 'a.js')).resolves.toBeNull()
    await expect(plugin.transform!.call({}, '', 'a.vue')).resolves.toBeNull()
  })

  it('transform() compiles Vue, injects style imports, macro hash, and page features', async () => {
    const pageMatcher = {
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => true),
    }
    createPageEntryMatcherMock.mockReturnValue(pageMatcher)

    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: { jsonMacroHash: 'abc123' },
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: true, code: '/* injected */\nexport default {}' })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      runtimeState: { scan: { isDirty: true } },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    const addWatchFile = vi.fn()
    const res = await plugin.transform!.call(
      { addWatchFile } as any,
      await fs.readFile(vuePath!, 'utf8'),
      vuePath!,
    )

    expect(addWatchFile).toHaveBeenCalledWith(normalizeWatchPath(vuePath!))
    expect(pageMatcher.markDirty).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(injectPageFeaturesMock).toHaveBeenCalledTimes(1)

    const escapedPrefix = WEAPP_VUE_STYLE_VIRTUAL_PREFIX.replace(/\0/g, '\\u0000')
    expect(res?.code).toContain(escapedPrefix)
    expect(res?.code).toContain('?weapp-vite-vue&type=style&index=0')
    expect(res?.code).toContain('?weapp-vite-vue&type=style&index=1&scoped=true&module=true')
    expect(res?.code).toContain('__weappViteJsonMacroHash')

    const [, , options] = compileVueFileMock.mock.calls[0]!
    expect(await options.autoImportTags.resolveUsingComponent('t-cell-group', vuePath!)).toEqual({
      name: 't-cell-group',
      from: 'lib/t-cell-group',
    })
    options.autoImportTags.warn('noop')
    options.autoUsingComponents.warn('noop')
  })

  it('transform() resolver returns undefined when autoImportService is missing', async () => {
    compileVueFileMock.mockResolvedValue({ script: 'export default {}', meta: {} })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({ autoImportService: undefined })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const [, , options] = compileVueFileMock.mock.calls[0]!
    await expect(options.autoImportTags.resolveUsingComponent('t-cell-group', vuePath!)).resolves.toBeUndefined()
  })

  it('transform() emits scoped slot chunks and registers virtual modules', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })

    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      scopedSlotComponents: [
        {
          id: 'default-0',
          componentName: 'scoped-slot-test',
          slotKey: 'default',
          template: '<view />',
          classStyleBindings: [
            {
              name: '__wv_cls_0',
              type: 'class',
              exp: 'event.active ? \'on\' : \'off\'',
              forStack: [
                {
                  listExp: 'events',
                  item: 'event',
                  index: 'index',
                },
              ],
            },
          ],
        },
      ],
    })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)
    const emitFile = vi.fn()

    await plugin.buildStart?.call({})
    await plugin.transform!.call(
      { addWatchFile: vi.fn(), emitFile } as any,
      await fs.readFile(vuePath!, 'utf8'),
      vuePath!,
    )

    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      type: 'chunk',
      fileName: 'page.__scoped-slot-default-0.js',
    }))

    const virtualId = '\0weapp-vite:scoped-slot:page.__scoped-slot-default-0'
    const loaded = await plugin.load!.call({}, virtualId)
    expect(loaded).toEqual({
      code: expect.stringContaining('createWevuScopedSlotComponent'),
      map: null,
    })
    expect((loaded as any).code).toContain('from \'wevu\'')
    expect((loaded as any).code).toContain('unref as __wevuUnref')
    expect((loaded as any).code).toContain('__wevuUnref(')
  })

  it('transform() rethrows compilation errors', async () => {
    compileVueFileMock.mockRejectedValue(new Error('boom'))

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    await expect(plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)).rejects.toThrow('boom')
  })

  it('generateBundle() emits cached results and fallback results', async () => {
    const pageMatcher = {
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    }
    createPageEntryMatcherMock.mockReturnValue(pageMatcher)

    compileVueFileMock.mockImplementation(async (_source, filename) => {
      if (filename.endsWith('app.vue')) {
        return { script: 'export default {}', meta: {}, template: '<view />' }
      }
      return { script: 'export default {}', meta: {}, template: '<view />', style: '.x{}', config: '{"a":1}' }
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: false, code: 'export default {}' })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: false,
        relativeOutputPath: (abs: string) => {
          if (abs.includes('skip')) {
            return undefined
          }
          return path.basename(abs)
        },
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    const appVue = path.join(tmpDir!, 'app.vue')
    await fs.writeFile(appVue, '<template><view/></template>', 'utf8')
    await plugin.transform!.call({}, await fs.readFile(appVue, 'utf8'), appVue)
    await plugin.transform!.call({}, await fs.readFile(vuePath!, 'utf8'), vuePath!)

    const skipVue = path.join(tmpDir!, 'skip/page.vue')
    await fs.ensureDir(path.dirname(skipVue))
    await fs.writeFile(skipVue, '<template><view/></template>', 'utf8')
    await plugin.transform!.call({}, await fs.readFile(skipVue, 'utf8'), skipVue)

    const fallbackEntry = path.join(tmpDir!, 'fallback/page')
    const fallbackVue = `${fallbackEntry}.vue`
    await fs.ensureDir(path.dirname(fallbackVue))
    await fs.writeFile(fallbackVue, '<template><view/></template>', 'utf8')

    collectFallbackPageEntryIdsMock.mockResolvedValue([
      // should compile
      fallbackEntry,
      // should skip because relativeOutputPath returns undefined
      path.join(tmpDir, 'skip/page'),
      // should skip because compilation cache already has this vue
      vuePath!.slice(0, -4),
    ])

    const bundle: OutputBundle = {}
    const addWatchFile = vi.fn()
    await plugin.generateBundle!.call({ addWatchFile } as any, {}, bundle)

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalled()
    expect(emitSfcJsonAssetMock).toHaveBeenCalled()
    expect(emitSfcStyleIfMissingMock).toHaveBeenCalled()

    // app.vue should not emit default component json when config is missing
    const appJsonCalls = emitSfcJsonAssetMock.mock.calls.filter(call => call[2] === path.basename(appVue).slice(0, -4))
    expect(appJsonCalls.length).toBe(0)
  })

  it('generateBundle() defaults scoped slot styleIsolation to apply-shared', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })

    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      scopedSlotComponents: [
        {
          id: 'default-0',
          componentName: 'scoped-slot-test',
          slotKey: 'default',
          template: '<t-cell></t-cell>',
        },
      ],
    })

    const wxmlService = {
      analyze: vi.fn(() => ({
        components: {
          't-cell': [{ start: 0, end: 1 }],
        },
      })),
    }
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({ wxmlService })
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call(
      { addWatchFile: vi.fn(), emitFile: vi.fn() } as any,
      await fs.readFile(vuePath!, 'utf8'),
      vuePath!,
    )

    const emitted: Array<{ fileName: string, source: string }> = []
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      } as any,
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'page.__scoped-slot-default-0.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({
      component: true,
      styleIsolation: 'apply-shared',
      usingComponents: {
        't-cell': 'lib/t-cell',
      },
    })
  })

  it('generateBundle() auto injects usingComponents for scoped slot templates', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })

    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      meta: {},
      template: '<view />',
      scopedSlotComponents: [
        {
          id: 'default-0',
          componentName: 'scoped-slot-test',
          slotKey: 'default',
          template: '<t-cell></t-cell>',
        },
      ],
    })

    const wxmlService = {
      analyze: vi.fn(() => ({
        components: {
          't-cell': [{ start: 0, end: 1 }],
        },
      })),
    }
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({ wxmlService })
    ctx.configService.weappViteConfig = {
      json: {
        defaults: {
          component: {
            styleIsolation: 'apply-shared',
          },
        },
      },
    }
    const plugin = createVueTransformPlugin(ctx as any)

    await plugin.transform!.call(
      { addWatchFile: vi.fn(), emitFile: vi.fn() } as any,
      await fs.readFile(vuePath!, 'utf8'),
      vuePath!,
    )

    const emitted: Array<{ fileName: string, source: string }> = []
    await plugin.generateBundle!.call(
      {
        emitFile(payload: any) {
          emitted.push({ fileName: payload.fileName, source: String(payload.source) })
        },
      } as any,
      {},
      {},
    )

    const jsonAsset = emitted.find(item => item.fileName === 'page.__scoped-slot-default-0.json')
    expect(jsonAsset).toBeDefined()
    expect(JSON.parse(jsonAsset!.source)).toEqual({
      component: true,
      styleIsolation: 'apply-shared',
      usingComponents: {
        't-cell': 'lib/t-cell',
      },
    })
  })

  it('generateBundle() returns early when scanService is missing', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx({ scanService: undefined }) as any)
    await expect(plugin.generateBundle!.call({}, {}, {} as any)).resolves.toBeUndefined()
  })

  it('generateBundle() applies transformed fallback injection and swallows fallback compile errors', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => false),
    })

    compileVueFileMock.mockImplementation(async (_source, filename) => {
      if (filename.endsWith('bad.vue')) {
        throw new Error('bad')
      }
      return { script: 'export default {}', meta: {}, template: '<view />', style: '.x{}', config: '{"a":1}' }
    })
    injectPageFeaturesMock.mockResolvedValue({ transformed: true, code: '/* transformed */\nexport default {}' })

    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const ctx = createCtx({
      configService: {
        cwd: tmpDir!,
        isDev: true,
        relativeOutputPath: (abs: string) => path.basename(abs),
      },
    })
    const plugin = createVueTransformPlugin(ctx as any)

    const okEntry = path.join(tmpDir!, 'fallback-ok/page')
    const okVue = `${okEntry}.vue`
    await fs.ensureDir(path.dirname(okVue))
    await fs.writeFile(okVue, '<template><view/></template>', 'utf8')

    const badEntry = path.join(tmpDir!, 'bad')
    await fs.writeFile(`${badEntry}.vue`, '<template><view/></template>', 'utf8')

    const missingEntry = path.join(tmpDir!, 'missing')
    collectFallbackPageEntryIdsMock.mockResolvedValue([okEntry, missingEntry, badEntry])

    const bundle: OutputBundle = {}
    await expect(plugin.generateBundle!.call({ addWatchFile: vi.fn() } as any, {}, bundle)).resolves.toBeUndefined()

    // line coverage: injected.transformed branch should be taken for ok entry
    expect(injectPageFeaturesMock).toHaveBeenCalled()
  })

  it('handleHotUpdate() clears cache only for .vue files', async () => {
    const { createVueTransformPlugin } = await import('../../src/plugins/vue/transform/plugin')
    const plugin = createVueTransformPlugin(createCtx() as any)

    await expect(plugin.handleHotUpdate!.call({}, { file: 'a.txt' } as any)).resolves.toBeUndefined()
    await expect(plugin.handleHotUpdate!.call({}, { file: vuePath! } as any)).resolves.toEqual([])
  })
})
