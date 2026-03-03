import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import { fileURLToPath } from 'node:url'
import { dirname, relative, resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeWatchPath } from '../utils/path'

const processCssWithCache = vi.fn(async (code: string) => code)
const renderSharedStyleEntry = vi.fn(async () => ({
  css: '/* shared */',
  dependencies: [],
}))
const pathExistsMock = vi.fn(async () => true)

vi.mock('./css/shared/preprocessor', () => ({
  cssCodeCache: { get: () => undefined, set: () => undefined },
  processCssWithCache,
  renderSharedStyleEntry,
}))

vi.mock('./utils/cache', () => ({
  pathExists: pathExistsMock,
}))

const { css } = await import('./css')

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
    processCssWithCache.mockClear()
    renderSharedStyleEntry.mockReset()
    renderSharedStyleEntry.mockResolvedValue({
      css: '/* shared */',
      dependencies: [],
    })
    pathExistsMock.mockReset()
    pathExistsMock.mockResolvedValue(true)
    pluginContext.addWatchFile.mockClear()
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
