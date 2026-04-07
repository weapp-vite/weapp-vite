import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeWatchPath } from '../../../utils/path'
import { createGenerateBundleHook, createRenderStartHook } from './emit'

const applySharedChunkStrategyMock = vi.hoisted(() => vi.fn())
const applyRuntimeChunkLocalizationMock = vi.hoisted(() => vi.fn())
const emitWxmlAssetsWithCacheMock = vi.hoisted(() => vi.fn())
const emitJsonAssetsMock = vi.hoisted(() => vi.fn())
const filterPluginBundleOutputsMock = vi.hoisted(() => vi.fn())
const flushIndependentBuildsMock = vi.hoisted(() => vi.fn(async () => {}))
const formatBytesMock = vi.hoisted(() => vi.fn((value: number) => `${value}B`))
const refreshModuleGraphMock = vi.hoisted(() => vi.fn())
const refreshPartialSharedChunkImportersMock = vi.hoisted(() => vi.fn())
const refreshSharedChunkImportersMock = vi.hoisted(() => vi.fn())
const removeImplicitPagePreloadsMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('../../../runtime/chunkStrategy', () => ({
  DEFAULT_SHARED_CHUNK_STRATEGY: 'copy',
  applySharedChunkStrategy: applySharedChunkStrategyMock,
  applyRuntimeChunkLocalization: applyRuntimeChunkLocalizationMock,
}))

vi.mock('../../utils/wxmlEmit', () => ({
  emitWxmlAssetsWithCache: emitWxmlAssetsWithCacheMock,
}))

vi.mock('../helpers', () => ({
  emitJsonAssets: emitJsonAssetsMock,
  filterPluginBundleOutputs: filterPluginBundleOutputsMock,
  flushIndependentBuilds: flushIndependentBuildsMock,
  formatBytes: formatBytesMock,
  refreshModuleGraph: refreshModuleGraphMock,
  refreshPartialSharedChunkImporters: refreshPartialSharedChunkImportersMock,
  refreshSharedChunkImporters: refreshSharedChunkImportersMock,
  removeImplicitPagePreloads: removeImplicitPagePreloadsMock,
}))

vi.mock('../../../logger', () => ({
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
}))

function createState(overrides: Record<string, any> = {}) {
  const state = {
    ctx: {
      runtimeState: {
        wxml: {
          emittedCode: new Map(),
        },
      },
      scanService: {
        subPackageMap: new Map(),
      },
      configService: {
        isDev: false,
        platform: 'weapp',
        outDir: '/project/dist',
        absolutePluginOutputRoot: '/project/dist/plugin',
        absolutePluginRoot: '/project/plugin',
        packageJson: {
          dependencies: {},
        },
        weappViteConfig: {},
        relativeAbsoluteSrcRoot: (id: string) => id,
      },
    },
    subPackageMeta: {
      subPackage: {
        root: 'pkg',
      },
    },
    entriesMap: new Map(),
    pendingIndependentBuilds: [],
    moduleImporters: new Map(),
    entryModuleIds: new Set(),
    watchFilesSnapshot: [],
    hmrState: {
      didEmitAllEntries: false,
      hasBuiltOnce: false,
    },
    hmrSharedChunksMode: 'auto',
    hmrSharedChunkImporters: new Map(),
    jsonEmitFilesMap: new Map(),
  } as any

  return {
    ...state,
    ...overrides,
    ctx: {
      ...state.ctx,
      ...(overrides.ctx ?? {}),
      configService: {
        ...state.ctx.configService,
        ...(overrides.ctx?.configService ?? {}),
      },
      scanService: {
        ...state.ctx.scanService,
        ...(overrides.ctx?.scanService ?? {}),
      },
      runtimeState: {
        ...state.ctx.runtimeState,
        ...(overrides.ctx?.runtimeState ?? {}),
      },
    },
    hmrState: {
      ...state.hmrState,
      ...(overrides.hmrState ?? {}),
    },
  }
}

describe('core lifecycle emit hook extra branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flushIndependentBuildsMock.mockResolvedValue(undefined)
  })

  it('creates renderStart runtime and stores watch files snapshot', () => {
    emitWxmlAssetsWithCacheMock.mockImplementationOnce(({ runtime }) => {
      runtime.addWatchFile?.('foo\\\\bar//main.wxml')
      runtime.emitFile({ type: 'asset', fileName: 'a.wxml', source: '<view />' })
      return ['cached/watch/a.wxml']
    })

    const state = createState()
    const addWatchFile = vi.fn()
    const emitFile = vi.fn()
    const hook = createRenderStartHook(state)

    hook.call({
      addWatchFile,
      emitFile,
    })

    expect(emitJsonAssetsMock).toHaveBeenCalledTimes(1)
    expect(addWatchFile).toHaveBeenCalledWith(normalizeWatchPath('foo\\\\bar//main.wxml'))
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'a.wxml',
      source: '<view />',
    })
    expect(state.watchFilesSnapshot).toEqual(['cached/watch/a.wxml'])
  })

  it('returns early for plugin builds after filtering outputs', async () => {
    const state = createState()
    const hook = createGenerateBundleHook(state, true)
    const bundle = {
      'plugin/index.js': {
        type: 'chunk',
        fileName: 'plugin/index.js',
        code: 'module.exports = 1',
      },
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        code: 'module.exports = 2',
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(flushIndependentBuildsMock).toHaveBeenCalledTimes(1)
    expect(filterPluginBundleOutputsMock).toHaveBeenCalledWith(bundle, state.ctx.configService)
    expect(removeImplicitPagePreloadsMock).not.toHaveBeenCalled()
    expect(refreshModuleGraphMock).not.toHaveBeenCalled()
  })

  it('handles shared/runtime chunk diagnostics and watcher service watch files', async () => {
    applySharedChunkStrategyMock.mockImplementationOnce((_bundle, options) => {
      options.onDuplicate?.({
        sharedFileName: 'shared/common.js',
        retainedInMain: true,
        ignoredMainImporters: ['pages/index/index.js'],
        chunkBytes: 120,
        redundantBytes: 240,
        duplicates: [
          {
            fileName: 'pkg-a/pages/a.js',
            importers: ['pkg-a/pages/a.js'],
          },
          {
            fileName: 'pkg-b/pages/b.js',
            importers: ['pkg-b/pages/b.js', 'pkg-b/pages/c.js'],
          },
        ],
      })
      options.onFallback?.({
        reason: 'main-package',
        importers: ['pkg-a/pages/a.js', 'pages/index/index.js'],
        sharedFileName: 'missing.js',
        finalFileName: 'common.js',
      })
      options.onFallback?.({
        reason: 'main-only',
        importers: ['pages/index/index.js'],
        sharedFileName: 'missing.js',
        finalFileName: 'common.js',
      })
    })

    applyRuntimeChunkLocalizationMock.mockImplementationOnce((_bundle, options) => {
      options.onDuplicate?.({
        runtimeFileName: 'runtime.js',
        duplicates: [
          {
            fileName: 'pkg-b/pages/b.js',
            importers: ['pkg-b/pages/b.js'],
          },
        ],
      })
    })

    const watchFiles = vi.fn()
    const getWatchFiles = vi.fn(async () => ['watch/from/watcher.js'])
    const state = createState({
      subPackageMeta: null,
      watchFilesSnapshot: ['watch/from/snapshot.js'],
      hmrState: {
        didEmitAllEntries: true,
        hasBuiltOnce: true,
      },
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['pkg-a', {}],
            ['pkg-b', {}],
          ]),
        },
        watcherService: {
          getRollupWatcher: vi.fn(() => ({
            getWatchFiles,
          })),
        },
        configService: {
          isDev: true,
          weappViteConfig: {
            chunks: {
              sharedStrategy: 'copy',
              logOptimization: true,
              duplicateWarningBytes: 100,
            },
            debug: {
              watchFiles,
            },
          },
          relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/', ''),
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'const n = 1',
        imports: [],
        dynamicImports: [],
        modules: {
          '/project/node_modules/.pnpm/pkg@1.0.0/node_modules/pkg/a.js': {},
          '/project/src/shared/util.ts': {},
          '\0virtual:shared': {},
        },
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(refreshSharedChunkImportersMock).toHaveBeenCalledWith(bundle, state)
    expect(applySharedChunkStrategyMock).toHaveBeenCalledTimes(1)
    expect(applyRuntimeChunkLocalizationMock).toHaveBeenCalledTimes(1)
    expect(loggerInfoMock).toHaveBeenCalled()
    expect(loggerWarnMock).toHaveBeenCalled()
    expect(loggerWarnMock.mock.calls.some(args => String(args[0]).includes('超过阈值'))).toBe(true)
    expect(watchFiles).toHaveBeenCalledWith(['watch/from/watcher.js'], null)
    expect(state.hmrState.hasBuiltOnce).toBe(true)
    expect(state.watchFilesSnapshot).toEqual([])
    expect(removeImplicitPagePreloadsMock).toHaveBeenCalledTimes(1)
    expect(refreshModuleGraphMock).toHaveBeenCalledTimes(1)
  })

  it('uses partial shared chunk importer refresh during hmr incremental builds', async () => {
    const state = createState({
      subPackageMeta: null,
      hmrState: {
        didEmitAllEntries: false,
        hasBuiltOnce: true,
        lastEmittedEntryIds: new Set(['pages/home/index.ts']),
      },
      ctx: {
        configService: {
          isDev: true,
          weappViteConfig: {
            chunks: {
              logOptimization: false,
            },
          },
        },
      },
    })

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'module.exports = 1',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(refreshSharedChunkImportersMock).not.toHaveBeenCalled()
    expect(refreshPartialSharedChunkImportersMock).toHaveBeenCalledWith(
      bundle,
      state,
      state.hmrState.lastEmittedEntryIds,
    )
    expect(state.hmrState.hasBuiltOnce).toBe(true)
  })

  it('falls back to watch file snapshot when watcher is unavailable', async () => {
    const watchFiles = vi.fn()
    const state = createState({
      watchFilesSnapshot: ['watch/from/snapshot.js'],
      ctx: {
        watcherService: {
          getRollupWatcher: vi.fn(() => undefined),
        },
        configService: {
          weappViteConfig: {
            debug: {
              watchFiles,
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)

    await hook.call({}, {}, {} as any)

    expect(watchFiles).toHaveBeenCalledWith(['watch/from/snapshot.js'], state.subPackageMeta)
    expect(state.watchFilesSnapshot).toEqual([])
  })

  it('rewrites alipay npm imports with edge cases and keeps parse fallback stable', async () => {
    const state = createState({
      ctx: {
        configService: {
          platform: 'alipay',
          packageJson: {
            dependencies: {
              foo: '^1.0.0',
            },
          },
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: [
          'const a = require(`foo/bar`)',
          'const b = require("plugin://demo/plugin")',
          'const c = require(`foo/' + '${' + 'name}`)',
          'const d = require("other/bar")',
          'const e = require("npm:foo/utils")',
          'wx.showToast({ title: "ok" })',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
      'broken.js': {
        type: 'chunk',
        fileName: 'broken.js',
        code: 'const broken = wx.',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    const code = bundle['main.js'].code
    expect(code).toContain('/node_modules/foo/bar')
    expect(code).toContain('/node_modules/foo/utils')
    expect(code).toContain('plugin://demo/plugin')
    expect(code).toMatch(/foo\/\$\{name\}/)
    expect(code).toContain('other/bar')
    expect(code).toContain('__weappViteInjectedApi__')
    expect(code).not.toContain('wx.showToast')
    expect(bundle['broken.js'].code).toBe('const broken = wx.')
  })

  it('keeps bundle code unchanged when require calls are unsupported or scoped', async () => {
    const state = createState({
      ctx: {
        configService: {
          platform: 'alipay',
          packageJson: {
            dependencies: {
              foo: '^1.0.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const sourceCode = [
      'function scoped(require) { return require("foo/path") }',
      'require()',
      'require(null)',
      'require("other/path")',
    ].join(';')
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: sourceCode,
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toBe(sourceCode)
  })

  it('normalizes explicit /miniprogram_npm and /node_modules imports in alipay mode', async () => {
    const state = createState({
      ctx: {
        configService: {
          platform: 'alipay',
          packageJson: {
            dependencies: {
              foo: '^1.0.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: [
          'const a = require("/node_modules/foo/path")',
          'const b = require("/miniprogram_npm/foo/path")',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    const code = bundle['main.js'].code
    expect(code).toContain('/node_modules/foo/path')
    expect(code).not.toContain('/miniprogram_npm/foo/path')
  })

  it('skips subpackage root chunks and ignores invalid local npm rewrite targets', async () => {
    const state = createState({
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['packageA', {
              subPackage: {
                root: 'packageA',
                dependencies: ['dayjs', '@scope/pkg'],
              },
            }],
          ]),
        },
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'dayjs': '^1.11.13',
              '@scope/pkg': '^1.0.0',
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'packageA.js': {
        type: 'chunk',
        fileName: 'packageA',
        code: 'const rootLevel = require("dayjs")',
        imports: [],
        dynamicImports: [],
      },
      'packageA/pages/foo.js': {
        type: 'chunk',
        fileName: 'packageA/pages/foo.js',
        code: [
          'function scoped(require) { return require("dayjs") }',
          'const a = require("@scope/pkg")',
          'const b = require(null)',
          'const c = require("other-lib")',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
      'packageA/pages/foo.json': {
        type: 'asset',
        fileName: 'packageA/pages/foo.json',
        source: JSON.stringify({
          usingComponents: {
            scoped: '@scope/pkg',
            ignored: 1,
            other: 'other-lib',
          },
        }),
      },
      'packageA.json': {
        type: 'asset',
        fileName: 'packageA.json',
        source: JSON.stringify({
          usingComponents: {
            rootOnly: 'dayjs',
          },
        }),
      },
      'packageA/pages/invalid.json': {
        type: 'asset',
        fileName: 'packageA/pages/invalid.json',
        source: '{',
      },
      'packageA/pages/empty.json': {
        type: 'asset',
        fileName: 'packageA/pages/empty.json',
        source: '',
      },
      'packageA/pages/array.json': {
        type: 'asset',
        fileName: 'packageA/pages/array.json',
        source: JSON.stringify({
          usingComponents: ['dayjs'],
        }),
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['packageA.js'].code).toBe('const rootLevel = require("dayjs")')
    expect(bundle['packageA/pages/foo.js'].code).toContain('function scoped(require) {')
    expect(bundle['packageA/pages/foo.js'].code).toContain('../miniprogram_npm/@scope/pkg/index')
    expect(bundle['packageA/pages/foo.js'].code).toContain('require(null)')
    expect(bundle['packageA/pages/foo.js'].code).toContain('other-lib')
    expect(bundle['packageA/pages/foo.json'].source).toContain('"scoped": "../miniprogram_npm/@scope/pkg/index"')
    expect(bundle['packageA/pages/foo.json'].source).toContain('"ignored": 1')
    expect(bundle['packageA/pages/foo.json'].source).toContain('"other": "other-lib"')
    expect(bundle['packageA.json'].source).toContain('"rootOnly":"dayjs"')
    expect(bundle['packageA/pages/invalid.json'].source).toBe('{')
    expect(bundle['packageA/pages/empty.json'].source).toBe('')
    expect(bundle['packageA/pages/array.json'].source).toContain('"usingComponents":["dayjs"]')
  })

  it('keeps local npm chunk code unchanged for non-static or unmatched require forms', async () => {
    const state = createState({
      ctx: {
        configService: {
          platform: 'weapp',
          pluginOnly: true,
          packageJson: {
            dependencies: {
              dayjs: '^1.11.13',
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, true)
    const bundle = {
      'plain.js': {
        type: 'chunk',
        fileName: 'plain.js',
        code: 'const value = 1',
        imports: [],
        dynamicImports: [],
      },
      'weird.js': {
        type: 'chunk',
        fileName: 'weird.js',
        code: [
          'loader("dayjs")',
          'require()',
          'require(`dayjs/' + '${' + 'name}`)',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['plain.js'].code).toBe('const value = 1')
    expect(bundle['weird.js'].code).toBe('loader("dayjs");require();require(`dayjs/' + '${' + 'name}`)')
  })

  it('matches local npm dependencies by regex against normalized import path and skips chunks without static require', async () => {
    const state = createState({
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['packageA', {
              subPackage: {
                root: 'packageA',
                dependencies: [/^tdesign-miniprogram\/button\//],
              },
            }],
          ]),
        },
        configService: {
          platform: 'weapp',
          packageJson: {
            dependencies: {
              'tdesign-miniprogram': '^1.12.3',
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'packageA/pages/keep.js': {
        type: 'chunk',
        fileName: 'packageA/pages/keep.js',
        code: 'const value = 1',
        imports: [],
        dynamicImports: [],
      },
      'packageA/pages/foo.js': {
        type: 'chunk',
        fileName: 'packageA/pages/foo.js',
        code: 'const button = require("tdesign-miniprogram/button/index")',
        imports: [],
        dynamicImports: [],
      },
      'packageA/pages/foo.json': {
        type: 'asset',
        fileName: 'packageA/pages/foo.json',
        source: JSON.stringify({
          usingComponents: {
            't-button': 'tdesign-miniprogram/button/index',
          },
        }),
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['packageA/pages/keep.js'].code).toBe('const value = 1')
    expect(bundle['packageA/pages/foo.js'].code).toContain('../miniprogram_npm/tdesign-miniprogram/button/index')
    expect(bundle['packageA/pages/foo.json'].source).toContain('"t-button": "../miniprogram_npm/tdesign-miniprogram/button/index"')
  })

  it('handles non-logging shared chunk duplicates and empty watch files gracefully', async () => {
    applySharedChunkStrategyMock.mockImplementationOnce((_bundle, options) => {
      options.onDuplicate?.({
        sharedFileName: 'shared/common.js',
        retainedInMain: false,
        ignoredMainImporters: [],
        chunkBytes: 32,
        duplicates: [
          {
            fileName: 'pkg-a/pages/a.js',
            importers: ['pkg-a/pages/a.js'],
          },
        ],
        requiresRuntimeLocalization: true,
      })
    })

    applyRuntimeChunkLocalizationMock.mockImplementationOnce((_bundle, options) => {
      expect([...options.forceRoots]).toEqual(['pkg-a'])
      expect(options.onDuplicate).toBeUndefined()
    })

    const watchFiles = vi.fn()
    const state = createState({
      subPackageMeta: null,
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['pkg-a', {}],
          ]),
        },
        watcherService: {
          getRollupWatcher: vi.fn(() => ({
            getWatchFiles: vi.fn(async () => []),
          })),
        },
        configService: {
          isDev: false,
          weappViteConfig: {
            chunks: {
              logOptimization: false,
              duplicateWarningBytes: 1,
            },
            debug: {
              watchFiles,
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)

    await hook.call({}, {}, {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'module.exports = 1',
        imports: [],
        dynamicImports: [],
      },
    } as any)

    expect(loggerInfoMock).not.toHaveBeenCalled()
    expect(loggerWarnMock).not.toHaveBeenCalled()
    expect(watchFiles).not.toHaveBeenCalled()
    expect(state.watchFilesSnapshot).toEqual([])
  })

  it('ignores non-chunk outputs while rewriting alipay imports and platform api access', async () => {
    const state = createState({
      ctx: {
        configService: {
          platform: 'alipay',
          packageJson: {
            dependencies: {
              foo: '^1.0.0',
            },
          },
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    })

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'asset.txt': {
        type: 'asset',
        fileName: 'asset.txt',
        source: 'plain text asset',
      },
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: 'const n = require("foo/path");wx.showToast({ title: "ok" })',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['asset.txt'].source).toBe('plain text asset')
    expect(bundle['main.js'].code).toContain('/node_modules/foo/path')
    expect(bundle['main.js'].code).toContain('__weappViteInjectedApi__')
  })

  it('resolves fallback shared chunk label via scan or raw final file name', async () => {
    applySharedChunkStrategyMock.mockImplementationOnce((_bundle, options) => {
      options.onFallback?.({
        reason: 'main-package',
        importers: ['pkg-a/pages/index.js'],
        sharedFileName: 'shared/missing-a.js',
        finalFileName: 'pkg-a/ghost-common.js',
      })
      options.onFallback?.({
        reason: 'main-package',
        importers: ['pkg-a/pages/index.js'],
        sharedFileName: 'shared/missing-b.js',
        finalFileName: 'pkg-a/scanned-common.js',
      })
    })

    const state = createState({
      subPackageMeta: null,
      ctx: {
        scanService: {
          subPackageMap: new Map([
            ['pkg-a', {}],
          ]),
        },
        configService: {
          weappViteConfig: {
            chunks: {
              logOptimization: true,
            },
          },
          relativeAbsoluteSrcRoot: (id: string) => id,
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'entry.js': {
        type: 'chunk',
        fileName: 'entry.js',
        code: 'module.exports = 1',
        imports: [],
        dynamicImports: [],
        modules: {},
      },
      'virtual-key.js': {
        type: 'chunk',
        fileName: 'pkg-a/scanned-common.js',
        code: 'module.exports = 2',
        imports: [],
        dynamicImports: [],
        modules: {},
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(
      loggerInfoMock.mock.calls.some(args => String(args[0]).includes('pkg-a/ghost-common.js')),
    ).toBe(true)
    expect(
      loggerInfoMock.mock.calls.some(args => String(args[0]).includes('pkg-a/scanned-common.js')),
    ).toBe(true)
  })

  it('skips platform api injection when replaceWx is disabled', async () => {
    const state = createState({
      ctx: {
        configService: {
          weappViteConfig: {
            injectWeapi: {
              enabled: true,
              replaceWx: false,
            },
          },
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: 'wx.showToast({ title: "ok" })',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toContain('wx.showToast')
    expect(bundle['main.js'].code).not.toContain('__weappViteInjectedApi__')
  })

  it('appends request globals installation to bundled runtime chunks', async () => {
    const state = createState({
      subPackageMeta: null,
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
      ctx: {
        configService: {
          packageJson: {
            dependencies: {
              axios: '^1.8.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: [
          'function vn(e={}){const t=e.targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`];return t}',
          'Object.defineProperty(exports,`At`,{enumerable:!0,get:function(){return vn}})',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
      'pages/request-globals/fetch.js': {
        type: 'chunk',
        fileName: 'pages/request-globals/fetch.js',
        code: 'const e=require("../../common.js");Page({})',
        imports: ['common.js'],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['common.js'].code).toContain('__weappViteRequestGlobalsBundleInstalled__')
    expect(bundle['common.js'].code).toContain('const __weappViteRequestGlobalsActuals__ = globalThis.__weappViteRequestGlobalsActuals__ || (globalThis.__weappViteRequestGlobalsActuals__ = Object.create(null))')
    expect(bundle['common.js'].code).toContain('var XMLHttpRequest = __weappViteHasUsableRequestGlobalsConstructor__(__weappViteRequestGlobalsActuals__["XMLHttpRequest"],[])?__weappViteRequestGlobalsActuals__["XMLHttpRequest"]:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.XMLHttpRequest,[])?globalThis.XMLHttpRequest:__weappViteCreateLazyRequestGlobalsConstructor__("XMLHttpRequest")')
    expect(bundle['common.js'].code).toContain('var WebSocket = __weappViteHasUsableRequestGlobalsConstructor__(__weappViteRequestGlobalsActuals__["WebSocket"],["wss://request-globals.invalid"])?__weappViteRequestGlobalsActuals__["WebSocket"]:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.WebSocket,["wss://request-globals.invalid"])?globalThis.WebSocket:__weappViteCreateLazyRequestGlobalsConstructor__("WebSocket")')
    expect(bundle['common.js'].code).toContain('const __weappViteRequestGlobalsBundleHost__ = vn({ targets: ["fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"] }) || globalThis')
    expect(bundle['common.js'].code).toContain('URL = __weappViteRequestGlobalsBundleHost__.URL')
    expect(bundle['common.js'].code).toContain('WebSocket = __weappViteRequestGlobalsBundleHost__.WebSocket')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('__weappViteRequestGlobalsLocalBindings__')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('const __weappViteChunkRequestGlobalsModule__ = require("../../common.js")')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('const __weappViteChunkRequestGlobalsHost__ = __weappViteChunkRequestGlobalsModule__["At"]({ targets: ["fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"] }) || globalThis')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('var fetch = __weappViteChunkRequestGlobalsHost__.fetch')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('var URL = __weappViteChunkRequestGlobalsHost__.URL')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('var WebSocket = __weappViteChunkRequestGlobalsHost__.WebSocket')
  })

  it('still injects top-level local bindings when chunk already contains setup-scoped request globals host bindings', async () => {
    const state = createState({
      subPackageMeta: null,
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
      ctx: {
        configService: {
          packageJson: {
            dependencies: {
              axios: '^1.8.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'common.js': {
        type: 'chunk',
        fileName: 'common.js',
        code: 'Object.defineProperty(exports,`noop`,{enumerable:!0,get:function(){return function(){}}})',
        imports: [],
        dynamicImports: [],
      },
      'dist.js': {
        type: 'chunk',
        fileName: 'dist.js',
        code: [
          'function vn(e={}){const t=e.targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`];return t}',
          'Object.defineProperty(exports,`At`,{enumerable:!0,get:function(){return vn}})',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
      'pages/request-globals/fetch.js': {
        type: 'chunk',
        fileName: 'pages/request-globals/fetch.js',
        code: [
          'const e=require("../../common.js"),t=require("../../dist.js");',
          'Page({ setup(){',
          'const __weappViteRequestGlobalsHost__ = t["At"]({ targets: ["fetch"] }) || globalThis;',
          'var fetch = __weappViteRequestGlobalsHost__.fetch;',
          '} })',
        ].join(''),
        imports: ['common.js', 'dist.js'],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['pages/request-globals/fetch.js'].code).toContain('__weappViteRequestGlobalsLocalBindings__')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('const __weappViteChunkRequestGlobalsModule__ = require("../../dist.js")')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('const __weappViteChunkRequestGlobalsHost__ = __weappViteChunkRequestGlobalsModule__["At"]({ targets: ["fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"] }) || globalThis')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('const __weappViteRequestGlobalsHost__ = t["At"]({ targets: ["fetch"] }) || globalThis;')
    expect(bundle['pages/request-globals/fetch.js'].code).toContain('var fetch = __weappViteChunkRequestGlobalsHost__.fetch')
  })

  it('prepends installer require before earlier shared chunk requires in page chunks', async () => {
    const state = createState({
      subPackageMeta: null,
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
      ctx: {
        configService: {
          packageJson: {
            dependencies: {
              axios: '^1.8.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'dist.js': {
        type: 'chunk',
        fileName: 'dist.js',
        code: [
          'function vn(e={}){const t=e.targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`];return t}',
          'Object.defineProperty(exports,`At`,{enumerable:!0,get:function(){return vn}})',
        ].join(';'),
        imports: [],
        dynamicImports: [],
      },
      'pages/request-globals/fetch.js': {
        type: 'chunk',
        fileName: 'pages/request-globals/fetch.js',
        code: 'const e=require("../../common.js"),t=require("../../dist.js");Page({})',
        imports: ['common.js', 'dist.js'],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    const code = bundle['pages/request-globals/fetch.js'].code
    expect(code.indexOf('const __weappViteChunkRequestGlobalsModule__ = require("../../dist.js")')).toBeLessThan(code.indexOf('const e=require("../../common.js")'))
  })

  it('injects bundled runtime installation right after the first require when installer chunk has imports', async () => {
    const state = createState({
      subPackageMeta: null,
      entriesMap: new Map([
        ['pages/request-globals/fetch', { type: 'page', path: 'pages/request-globals/fetch' }],
      ]),
      ctx: {
        configService: {
          packageJson: {
            dependencies: {
              axios: '^1.8.0',
            },
          },
          weappViteConfig: {},
        },
      },
    })
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'dist.js': {
        type: 'chunk',
        fileName: 'dist.js',
        code: [
          'const e=require("./common.js");',
          'function vn(e={}){const t=e.targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`];return { URL: Date, fetch: Promise.resolve, Headers: Object, Request: Object, Response: Object, AbortController: Object, AbortSignal: Object, XMLHttpRequest: Object, WebSocket: Object, URLSearchParams: Object, Blob: Object, FormData: Object }}',
          'Object.defineProperty(exports,`At`,{enumerable:!0,get:function(){return vn}})',
        ].join(''),
        imports: ['common.js'],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    const code = bundle['dist.js'].code
    expect(code).toContain('__weappViteRequestGlobalsBundleInstalled__')
    expect(code).toContain('const e=require("./common.js");const __weappViteRequestGlobalsBundleHost__ = vn({ targets: ["fetch","Headers","Request","Response","AbortController","AbortSignal","XMLHttpRequest","WebSocket"] }) || globalThis')
    expect(code.indexOf('const __weappViteRequestGlobalsBundleHost__ = vn')).toBeLessThan(code.indexOf('Object.defineProperty(exports,`At`'))
  })
})
