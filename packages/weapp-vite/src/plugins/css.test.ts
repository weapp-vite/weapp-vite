import type { ResolvedConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { SubPackageStyleEntry } from '../types'
import { fileURLToPath } from 'node:url'
import { dirname, relative, resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const processCssWithCache = vi.fn(async (code: string) => code)
const renderSharedStyleEntry = vi.fn(async () => ({
  css: '/* shared */',
  dependencies: [],
}))

vi.mock('./css/shared/preprocessor', () => ({
  cssCodeCache: { get: () => undefined, set: () => undefined },
  processCssWithCache,
  renderSharedStyleEntry,
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
    renderSharedStyleEntry.mockClear()
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
})
