import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import { fileURLToPath } from 'node:url'
import { dirname, relative, resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeWatchPath } from '../utils/path'

const readFileMock = vi.fn(async () => '.sidecar{color:red}')
const processCssWithCache = vi.fn(async (code: string) => code)
const preprocessCSSMock = vi.fn(async (code: string) => ({
  code,
  deps: [],
}))
const renderSharedStyleEntry = vi.fn(async () => ({
  css: '/* shared */',
  dependencies: [],
}))
const pathExistsMock = vi.fn(async () => true)

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      readFile: readFileMock,
    },
  }
})

vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    preprocessCSS: preprocessCSSMock,
  }
})

vi.mock('./css/shared/preprocessor', () => ({
  cssCodeCache: { get: () => undefined, set: () => undefined },
  processCssWithCache,
  renderSharedStyleEntry,
}))

vi.mock('./utils/cache', () => ({
  pathExists: pathExistsMock,
}))

const { css } = await import('./css')
const { emitStyleSidecarAsset } = await import('./css')

function invokeHook<T extends (...args: any[]) => any>(
  hook: undefined | null | T | { handler?: T },
  context: unknown,
  ...args: Parameters<T>
) {
  if (!hook) {
    return undefined
  }

  if (typeof hook === 'function') {
    return hook.apply(context, args)
  }

  if (typeof hook.handler === 'function') {
    return hook.handler.apply(context, args)
  }

  return undefined
}

describe('css plugin shared style injection', () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const absoluteSrcRoot = resolve(__dirname, '__fixtures__')
  const cwd = resolve(absoluteSrcRoot, '..')
  const styleAbsolutePath = resolve(absoluteSrcRoot, 'subpackages/foo/styles/index.wxss')

  const relativeAbsoluteSrcRoot = (value: string) => {
    const rel = relative(absoluteSrcRoot, value)
    if (rel.startsWith('..')) {
      return undefined
    }
    return rel
  }

  let emitted: Array<{ type: string, fileName: string, source: string }>

  const pluginContext = {
    emitFile(file: { type: string, fileName: string, source: string }) {
      emitted.push(file)
      return `asset-${emitted.length}`
    },
    addWatchFile: vi.fn(),
  }

  const configService = {
    cwd,
    absoluteSrcRoot,
    platform: 'weapp',
    outputExtensions: { wxss: 'wxss' },
    relativeAbsoluteSrcRoot,
    currentSubPackageRoot: undefined,
    relativeOutputPath(id: string) {
      return relativeAbsoluteSrcRoot(id)
    },
  } as any

  const subPackageStyleEntry: SubPackageStyleEntry = {
    source: 'styles/index.wxss',
    absolutePath: styleAbsolutePath,
    outputRelativePath: 'subpackages/foo/styles/index.wxss',
    inputExtension: '.wxss',
    scope: 'all',
    include: ['**/*'],
    exclude: [],
  }
  const secondStyleAbsolutePath = resolve(absoluteSrcRoot, 'subpackages/foo/styles/second.wxss')
  const secondSubPackageStyleEntry: SubPackageStyleEntry = {
    source: 'styles/second.wxss',
    absolutePath: secondStyleAbsolutePath,
    outputRelativePath: 'subpackages/foo/styles/second.wxss',
    inputExtension: '.wxss',
    scope: 'all',
    include: ['**/*'],
    exclude: [],
  }

  const scanService = {
    subPackageMap: new Map([
      [
        'subpackages/foo',
        {
          subPackage: { root: 'subpackages/foo' },
          entries: ['subpackages/foo/pages/list'],
          styleEntries: [subPackageStyleEntry],
        },
      ],
    ]),
  }

  const ctx = {
    configService,
    scanService,
    runtimeState: {
      css: {
        importerToDependencies: new Map<string, Set<string>>(),
        dependencyToImporters: new Map<string, Set<string>>(),
        emittedSource: new Map(),
      },
    },
  } as unknown as CompilerContext

  const resolvedConfig = {
    root: cwd,
    css: {
      preprocessorOptions: {},
      devSourcemap: false,
      modules: false,
      transformer: 'postcss',
    },
  } as unknown as ResolvedConfig

  beforeEach(() => {
    emitted = []
    readFileMock.mockReset()
    readFileMock.mockResolvedValue('.sidecar{color:red}')
    processCssWithCache.mockClear()
    preprocessCSSMock.mockReset()
    preprocessCSSMock.mockImplementation(async (code: string) => ({
      code,
      deps: [],
    }))
    renderSharedStyleEntry.mockReset()
    renderSharedStyleEntry.mockResolvedValue({
      css: '/* shared */',
      dependencies: [],
      source: '/* shared source */',
    })
    pathExistsMock.mockReset()
    pathExistsMock.mockResolvedValue(true)
    pluginContext.addWatchFile.mockClear()
    ;(ctx as any).runtimeState.css.importerToDependencies.clear()
    ;(ctx as any).runtimeState.css.dependencyToImporters.clear()
    ;(ctx as any).runtimeState.css.emittedSource.clear()
  })

  it('emits wxss asset with shared style imports for modules without local styles', async () => {
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
        viteMetadata: {
          importedAssets: new Set(),
          importedCss: new Set(),
          importedScripts: new Set(),
          importedUrls: new Set(),
        },
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(renderSharedStyleEntry).toHaveBeenCalledTimes(1)

    const sharedAsset = emitted.find(asset => asset.fileName === 'subpackages/foo/styles/index.wxss')
    expect(sharedAsset).toBeTruthy()

    const pageAsset = emitted.find(asset => asset.fileName === 'subpackages/foo/pages/list.wxss')
    expect(pageAsset).toBeTruthy()
    expect(pageAsset?.source).toBe('@import \'../styles/index.wxss\';\n')

    expect(processCssWithCache).toHaveBeenCalledWith('@import \'../styles/index.wxss\';\n', configService)
  })

  it('prepares shared style import assets concurrently while committing in chunk order', async () => {
    const plugin = css(ctx)[0]
    const events: string[] = []
    let releaseList!: () => void
    const listBlocked = new Promise<void>((resolve) => {
      releaseList = resolve
    })
    let sharedImportCallCount = 0
    processCssWithCache.mockImplementation(async (code: string) => {
      events.push(code)
      if (code.includes('@import')) {
        sharedImportCallCount += 1
      }
      if (sharedImportCallCount === 1 && code.includes('@import')) {
        await listBlocked
      }
      return code
    })
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
      'subpackages/foo/pages/detail.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/detail.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/detail.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    const generating = invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    await vi.waitFor(() => {
      expect(events).toEqual([
        '/* shared */',
        '@import \'../styles/index.wxss\';\n',
        '@import \'../styles/index.wxss\';\n',
      ])
    })
    releaseList()
    await generating

    expect(emitted.map(asset => asset.fileName)).toEqual([
      'subpackages/foo/styles/index.wxss',
      'subpackages/foo/pages/list.wxss',
      'subpackages/foo/pages/detail.wxss',
    ])
  })

  it('skips shared style work for hmr bundles without style changes', async () => {
    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {
              dirtyReasonSummary: ['sidecar-direct:1'],
            },
          },
        },
      },
      scanService,
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
      'subpackages/foo/pages/list.wxml': {
        type: 'asset',
        fileName: 'subpackages/foo/pages/list.wxml',
        source: '<view />',
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, true)

    expect(renderSharedStyleEntry).not.toHaveBeenCalled()
    expect(processCssWithCache).not.toHaveBeenCalled()
    expect(emitted).toEqual([])
  })

  it('keeps style asset processing during asset-only dev hmr bundles', async () => {
    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {
              dirtyReasonSummary: ['style-sidecar:1'],
            },
          },
        },
      },
      scanService,
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.wxss': {
        type: 'asset',
        fileName: 'subpackages/foo/pages/list.wxss',
        source: '.page{color:red}',
        originalFileNames: [resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.wxss')],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, true)

    expect(processCssWithCache).toHaveBeenCalled()
  })

  it('tracks imports from the original final wxss asset source', async () => {
    const originalStylePath = resolve(absoluteSrcRoot, 'pages/native/index.wxss')
    const sharedStylePath = resolve(absoluteSrcRoot, 'shared/styles/shared.scss')
    readFileMock.mockResolvedValueOnce('@import "../../shared/styles/shared.scss";\n.native-page{}')
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'pages/native/index.wxss': {
        type: 'asset',
        fileName: 'pages/native/index.wxss',
        source: '.native-page{}',
        originalFileNames: [originalStylePath],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    const graph = (ctx as any).runtimeState.css
    expect(readFileMock).toHaveBeenCalledWith(originalStylePath, 'utf8')
    expect(graph.dependencyToImporters.get(sharedStylePath)).toEqual(new Set([originalStylePath]))
    expect(graph.dependencyToImporters.get(sharedStylePath.slice(0, -'.scss'.length))).toEqual(new Set([originalStylePath]))
  })

  it('emits wxss from css asset via chunk viteMetadata (no originalFileNames)', async () => {
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'app.js': {
        type: 'chunk',
        fileName: 'app.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'app.vue'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
        viteMetadata: {
          importedAssets: new Set(),
          importedCss: new Set(['app.css']),
          importedScripts: new Set(),
          importedUrls: new Set(),
        },
      },
      'app.css': {
        type: 'asset',
        fileName: 'app.css',
        source: '.root{color:red}',
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    const cssAsset = emitted.find(asset => asset.fileName === 'app.wxss')
    expect(cssAsset).toBeTruthy()
    expect(cssAsset?.source).toContain('.root{color:red}')
  })

  it('reuses processed css asset source for multiple chunk owners', async () => {
    preprocessCSSMock.mockResolvedValue({
      code: '.shared{color:red}',
      deps: ['/project/src/shared/dep.scss'],
    })
    processCssWithCache.mockResolvedValueOnce('.shared{color:red}/* processed */')
    const pageA = resolve(absoluteSrcRoot, 'pages/a/index.ts')
    const pageB = resolve(absoluteSrcRoot, 'pages/b/index.ts')
    const plugin = css({
      configService,
      scanService: { subPackageMap: new Map() },
      runtimeState: {
        css: {
          importerToDependencies: new Map<string, Set<string>>(),
          dependencyToImporters: new Map<string, Set<string>>(),
          emittedSource: new Map(),
        },
      },
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'pages/a/index.js': {
        type: 'chunk',
        fileName: 'pages/a/index.js',
        facadeModuleId: pageA,
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
        viteMetadata: {
          importedAssets: new Set(),
          importedCss: new Set(['shared.scss']),
          importedScripts: new Set(),
          importedUrls: new Set(),
        },
      },
      'pages/b/index.js': {
        type: 'chunk',
        fileName: 'pages/b/index.js',
        facadeModuleId: pageB,
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
        viteMetadata: {
          importedAssets: new Set(),
          importedCss: new Set(['shared.scss']),
          importedScripts: new Set(),
          importedUrls: new Set(),
        },
      },
      'shared.scss': {
        type: 'asset',
        fileName: 'shared.scss',
        source: '$brand:red;.shared{color:$brand}',
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(preprocessCSSMock).toHaveBeenCalledTimes(1)
    expect(processCssWithCache).toHaveBeenCalledWith('.shared{color:red}', configService)
    expect(processCssWithCache).toHaveBeenCalledTimes(1)
    expect(pluginContext.addWatchFile).toHaveBeenCalledWith(normalizeWatchPath('/project/src/shared/dep.scss'))
    expect(emitted.map(asset => asset.fileName).sort()).toEqual([
      'pages/a/index.wxss',
      'pages/b/index.wxss',
    ])
    expect(emitted.every(asset => asset.source.includes('/* processed */'))).toBe(true)
  })

  it('emits shared style imports for css importer hmr entries outside the representative bundle', async () => {
    const pageA = resolve(absoluteSrcRoot, 'pages/a/index.ts')
    const pageB = resolve(absoluteSrcRoot, 'pages/b/index.ts')
    const runtimeState = {
      build: {
        hmr: {
          lastHmrEntryIds: new Set([pageA, pageB]),
          lastEmittedEntryIds: new Set([pageA]),
          profile: {
            event: 'update',
            dirtyReasonSummary: ['css-importer:2'],
          },
        },
      },
    }
    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState,
      scanService: {
        subPackageMap: new Map([
          ['pages', {
            styleEntries: [{
              ...subPackageStyleEntry,
              outputRelativePath: 'pages/shared/styles/index.wxss',
            }],
          }],
        ]),
      },
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'pages/a/index.js': {
        type: 'chunk',
        fileName: 'pages/a/index.js',
        facadeModuleId: pageA,
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(emitted.map(asset => asset.fileName).sort()).toEqual([
      'pages/a/index.wxss',
      'pages/b/index.wxss',
      'pages/shared/styles/index.wxss',
    ])
  })

  it('normalizes source style asset filenames to wxss after Vite preprocessing', async () => {
    preprocessCSSMock.mockResolvedValue({
      code: '.page .title{color:red;background-clip:text;-webkit-background-clip:text}',
      deps: ['/project/src/pages/index/tokens.scss'],
    })

    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'pages/index/index.scss': {
        type: 'asset',
        fileName: 'pages/index/index.scss',
        source: '$brand: red;\n// https://example.com\n.page { .title { color: $brand; background-clip: text; } }',
        originalFileNames: [resolve(absoluteSrcRoot, 'pages/index/index.scss')],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(bundle['pages/index/index.scss']).toBeUndefined()
    const cssAsset = emitted.find(asset => asset.fileName === 'pages/index/index.wxss')
    expect(cssAsset).toBeTruthy()
    expect(cssAsset?.source).toContain('.page .title')
    expect(cssAsset?.source).toContain('-webkit-background-clip:text')
    expect(cssAsset?.source).not.toContain('$brand')
    expect(cssAsset?.source).not.toContain('// https://example.com')
    expect(preprocessCSSMock).toHaveBeenCalledWith(
      expect.stringContaining('$brand: red;'),
      resolve(absoluteSrcRoot, 'pages/index/index.scss'),
      resolvedConfig,
    )
    expect(pluginContext.addWatchFile).toHaveBeenCalledWith(normalizeWatchPath('/project/src/pages/index/tokens.scss'))
    expect((ctx as any).runtimeState.css.dependencyToImporters.get('/project/src/pages/index/tokens.scss')).toEqual(
      new Set([resolve(absoluteSrcRoot, 'pages/index/index.scss')]),
    )
  })

  it('registers css import graph from original source assets after Vite preprocessing removed imports', async () => {
    const stylePath = resolve(absoluteSrcRoot, 'pages/native/index.wxss')
    const sharedPath = resolve(absoluteSrcRoot, 'shared/styles/shared.scss')
    readFileMock.mockResolvedValueOnce('@import "../../shared/styles/shared.scss";\n.native{color:red}')
    preprocessCSSMock.mockResolvedValueOnce({
      code: '.shared{color:green}.native{color:red}',
      deps: [sharedPath],
    })

    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'pages/native/index.wxss': {
        type: 'asset',
        fileName: 'pages/native/index.wxss',
        source: '.shared{color:green}.native{color:red}',
        originalFileNames: [stylePath],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect((ctx as any).runtimeState.css.dependencyToImporters.get(sharedPath)).toEqual(new Set([stylePath]))
    expect((ctx as any).runtimeState.css.dependencyToImporters.get(sharedPath.slice(0, -'.scss'.length))).toEqual(new Set([stylePath]))
    expect(bundle['pages/native/index.wxss']?.source).toContain('.native{color:red}')
  })

  it('keeps existing wxss asset source instead of using raw scss original files as output', async () => {
    readFileMock.mockResolvedValueOnce('$brand: red;\n.page { .title { color: $brand; } }')

    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'pages/index/index.wxss': {
        type: 'asset',
        fileName: 'pages/index/index.wxss',
        source: '.page .title{color:red}',
        originalFileNames: [resolve(absoluteSrcRoot, 'pages/index/index.scss')],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(readFileMock).toHaveBeenCalledWith(resolve(absoluteSrcRoot, 'pages/index/index.scss'), 'utf8')
    expect(preprocessCSSMock).toHaveBeenCalledWith(
      '.page .title{color:red}',
      resolve(absoluteSrcRoot, 'pages/index/index.scss'),
      resolvedConfig,
    )
    expect(bundle['pages/index/index.wxss']?.source).toBe('.page .title{color:red}')
    expect((ctx as any).runtimeState.css.emittedSource.get('pages/index/index.wxss')).toBe('.page .title{color:red}')
    expect(emitted.find(asset => asset.fileName === 'pages/index/index.scss')).toBeUndefined()
  })

  it('rebuilds the current hmr final style asset from the latest sidecar source', async () => {
    const stylePath = resolve(absoluteSrcRoot, 'pages/index/index.scss')
    readFileMock.mockResolvedValueOnce('$brand: green;\n.page { .title { color: $brand; } }')
    preprocessCSSMock.mockResolvedValueOnce({
      code: '.page .title{color:green}',
      deps: [],
    })
    const runtimeState = {
      css: {
        emittedSource: new Map([
          ['pages/index/index.wxss', '.page .title{color:red}'],
        ]),
      },
      build: {
        hmr: {
          didEmitAllEntries: false,
          lastHmrEntryIds: new Set([resolve(absoluteSrcRoot, 'pages/index/index.ts')]),
          lastEmittedEntryIds: new Set(),
          profile: {
            event: 'update',
            file: stylePath,
          },
        },
      },
    }

    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState,
      scanService,
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'pages/index/index.wxss': {
        type: 'asset',
        fileName: 'pages/index/index.wxss',
        source: '.page .title{color:red}',
        originalFileNames: [stylePath],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, true)

    expect(readFileMock).toHaveBeenCalledWith(stylePath, 'utf8')
    expect(preprocessCSSMock).toHaveBeenCalledWith(
      expect.stringContaining('$brand: green;'),
      stylePath,
      resolvedConfig,
    )
    expect(bundle['pages/index/index.wxss']?.source).toBe('.page .title{color:green}')
    expect(runtimeState.css.emittedSource.get('pages/index/index.wxss')).toBe('.page .title{color:green}')
  })

  it('drops unchanged existing style assets during dev hmr writes', async () => {
    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState: {
        css: {
          emittedSource: new Map([
            ['pages/index/index.wxss', '.page .title{color:red}'],
          ]),
        },
        build: {
          hmr: {
            didEmitAllEntries: false,
            lastHmrEntryIds: new Set([resolve(absoluteSrcRoot, 'pages/index/index.ts')]),
            lastEmittedEntryIds: new Set(),
            profile: {
              event: 'update',
            },
          },
        },
      },
      scanService,
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'pages/index/index.wxss': {
        type: 'asset',
        fileName: 'pages/index/index.wxss',
        source: '.page .title{color:red}',
        originalFileNames: [resolve(absoluteSrcRoot, 'pages/index/index.scss')],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, true)

    expect(bundle['pages/index/index.wxss']).toBeUndefined()
    expect(emitted.find(asset => asset.fileName === 'pages/index/index.wxss')).toBeUndefined()
  })

  it('keeps the current style sidecar output even when the cache was prewarmed', async () => {
    const appCssPath = resolve(absoluteSrcRoot, 'app.css')
    const plugin = css({
      configService: {
        ...configService,
        isDev: true,
      },
      runtimeState: {
        css: {
          emittedSource: new Map([
            ['app.wxss', '.app{color:red}'],
          ]),
        },
        build: {
          hmr: {
            didEmitAllEntries: false,
            lastHmrEntryIds: new Set([appCssPath]),
            lastEmittedEntryIds: new Set(),
            profile: {
              event: 'update',
              file: appCssPath,
            },
          },
        },
      },
      scanService,
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'app.wxss': {
        type: 'asset',
        fileName: 'app.wxss',
        source: '.app{color:red}',
        originalFileNames: [appCssPath],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, true)

    expect(bundle['app.wxss']).toBeDefined()
    expect(bundle['app.wxss'].source).toBe('.app{color:red}')
  })

  it('emits style sidecars as wxss and preprocesses raw scss during dev updates', async () => {
    readFileMock.mockResolvedValueOnce('$brand: red;\n// https://example.com\n.page { .title { color: $brand; } }')
    preprocessCSSMock.mockResolvedValueOnce({
      code: '.page .title{color:red}',
      deps: ['/project/src/pages/index/tokens.scss'],
    })

    await emitStyleSidecarAsset(
      ctx,
      pluginContext,
      {} as any,
      resolve(absoluteSrcRoot, 'pages/index/index.scss'),
      resolvedConfig,
    )

    const sidecarAsset = emitted.find(asset => asset.fileName === 'pages/index/index.wxss')
    expect(sidecarAsset).toBeTruthy()
    expect(sidecarAsset?.source).toBe('.page .title{color:red}')
    expect(emitted.find(asset => asset.fileName.endsWith('.scss'))).toBeUndefined()
    expect(preprocessCSSMock).toHaveBeenCalledWith(
      expect.stringContaining('$brand: red;'),
      resolve(absoluteSrcRoot, 'pages/index/index.scss'),
      resolvedConfig,
    )
    expect(pluginContext.addWatchFile).toHaveBeenCalledWith(normalizeWatchPath('/project/src/pages/index/tokens.scss'))
  })

  it('returns early when shared style entries are empty', async () => {
    const plugin = css({
      configService,
      scanService: { subPackageMap: new Map() },
    } as unknown as CompilerContext)[0]

    const bundle: Record<string, any> = {
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'pages/index/index.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(emitted).toEqual([])
  })

  it('covers shared style import guard branches for non-chunk and invalid chunk metadata', async () => {
    const guardedConfigService = {
      ...configService,
      relativeOutputPath(id: string) {
        if (id.endsWith('skip.wxss')) {
          return undefined
        }
        return relativeAbsoluteSrcRoot(id)
      },
    } as any

    const plugin = css({
      configService: guardedConfigService,
      scanService,
    } as unknown as CompilerContext)[0]

    const createChunk = (fileName: string, facadeModuleId?: string) => ({
      type: 'chunk',
      fileName,
      facadeModuleId,
      code: '',
      map: null,
      imports: [],
      exports: [],
      modules: {},
      dynamicImports: [],
      implicitlyLoadedBefore: [],
      referencedFiles: [],
    })

    const bundle: Record<string, any> = {
      'asset.txt': {
        type: 'asset',
        fileName: 'asset.txt',
        source: '',
      },
      'no-facade.js': createChunk('no-facade.js'),
      'outside.js': createChunk('outside.js', resolve(cwd, 'outside.ts')),
      'skip.js': createChunk('skip.js', resolve(absoluteSrcRoot, 'skip.ts')),
      'pages/index.js': createChunk('pages/index.js', resolve(absoluteSrcRoot, 'pages/index/index.ts')),
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    const pageStyleAsset = emitted.find(asset => asset.fileName === 'pages/index/index.wxss')
    expect(pageStyleAsset).toBeUndefined()
  })

  it('skips shared style emission when shared style source file does not exist', async () => {
    pathExistsMock.mockResolvedValue(false)
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(renderSharedStyleEntry).not.toHaveBeenCalled()
    expect(emitted.find(asset => asset.fileName === 'subpackages/foo/styles/index.wxss')).toBeUndefined()
  })

  it('adds watch files for shared style dependencies and replaces existing bundle shared asset', async () => {
    const dependencyPath = resolve(absoluteSrcRoot, 'subpackages/foo/styles/dep.wxss')
    renderSharedStyleEntry.mockResolvedValue({
      css: '/* shared with deps */',
      dependencies: [styleAbsolutePath, dependencyPath],
      source: '@import "./dep.wxss";\n.shared{}',
    })

    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
      'subpackages/foo/styles/index.wxss': {
        type: 'chunk',
        fileName: 'subpackages/foo/styles/index.wxss',
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(bundle['subpackages/foo/styles/index.wxss']).toBeUndefined()
    expect(pluginContext.addWatchFile).toHaveBeenCalledWith(normalizeWatchPath(styleAbsolutePath))
    expect(pluginContext.addWatchFile).toHaveBeenCalledWith(normalizeWatchPath(dependencyPath))
    expect(readFileMock).not.toHaveBeenCalledWith(styleAbsolutePath, 'utf8')
  })

  it('renders shared style entries concurrently while emitting in config order', async () => {
    const plugin = css({
      ...ctx,
      scanService: {
        subPackageMap: new Map([
          [
            'subpackages/foo',
            {
              subPackage: { root: 'subpackages/foo' },
              entries: ['subpackages/foo/pages/list'],
              styleEntries: [subPackageStyleEntry, secondSubPackageStyleEntry],
            },
          ],
        ]),
      },
    } as unknown as CompilerContext)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/pages/list.js': {
        type: 'chunk',
        fileName: 'subpackages/foo/pages/list.js',
        facadeModuleId: resolve(absoluteSrcRoot, 'subpackages/foo/pages/list.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
      },
    }
    const startedBeforeRelease: string[] = []
    let releaseFirstRender!: () => void
    let firstReleased = false
    renderSharedStyleEntry.mockImplementation(async (entry: SubPackageStyleEntry) => {
      if (!firstReleased) {
        startedBeforeRelease.push(entry.absolutePath)
      }
      if (entry.absolutePath === styleAbsolutePath) {
        await new Promise<void>((resolve) => {
          releaseFirstRender = () => {
            firstReleased = true
            resolve()
          }
        })
      }
      return {
        css: `/* ${entry.outputRelativePath} */`,
        dependencies: [],
        source: `/* source ${entry.outputRelativePath} */`,
      }
    })

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    const pending = invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    await vi.waitFor(() => {
      expect(releaseFirstRender).toBeDefined()
      expect(startedBeforeRelease).toEqual([
        styleAbsolutePath,
        secondStyleAbsolutePath,
      ])
    })
    releaseFirstRender()
    await pending

    expect(emitted.map(asset => asset.fileName)).toEqual([
      'subpackages/foo/styles/index.wxss',
      'subpackages/foo/styles/second.wxss',
      'subpackages/foo/pages/list.wxss',
    ])
  })

  it('skips rendering shared style entries when the same output was already emitted', async () => {
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'subpackages/foo/styles/index.wxss': {
        type: 'asset',
        fileName: 'subpackages/foo/styles/index.wxss',
        source: '',
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(renderSharedStyleEntry).not.toHaveBeenCalled()
  })

  it('skips css owner emission when converted owner output path cannot be resolved', async () => {
    const plugin = css(ctx)[0]
    const bundle: Record<string, any> = {
      'outside.js': {
        type: 'chunk',
        fileName: 'outside.js',
        facadeModuleId: resolve(cwd, 'outside.ts'),
        code: '',
        map: null,
        imports: [],
        exports: [],
        modules: {},
        dynamicImports: [],
        implicitlyLoadedBefore: [],
        referencedFiles: [],
        viteMetadata: {
          importedAssets: new Set(),
          importedCss: new Set(['outside.css']),
          importedScripts: new Set(),
          importedUrls: new Set(),
        },
      },
      'outside.css': {
        type: 'asset',
        fileName: 'outside.css',
        source: '.outside{color:blue}',
      },
    }

    await invokeHook(plugin.configResolved, pluginContext, resolvedConfig)
    await invokeHook(plugin.generateBundle, pluginContext, {} as any, bundle, false)

    expect(bundle['outside.css']).toBeUndefined()
    expect(emitted.find(asset => asset.fileName === 'outside.wxss')).toBeUndefined()
    expect(processCssWithCache).not.toHaveBeenCalledWith('.outside{color:blue}', configService)
  })
})
