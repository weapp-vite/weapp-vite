import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseJsLikeMock = vi.hoisted(() => vi.fn(() => ({ type: 'Program' })))
const traverseMock = vi.hoisted(() => vi.fn())
const generateMock = vi.hoisted(() => vi.fn(() => ({ code: 'generated' })))
const mayContainPlatformApiAccessMock = vi.hoisted(() => vi.fn(() => true))
const mayContainStaticRequireLiteralMock = vi.hoisted(() => vi.fn(() => true))
const resolveAstEngineMock = vi.hoisted(() => vi.fn(() => 'babel'))

const flushIndependentBuildsMock = vi.hoisted(() => vi.fn(async () => {}))
const removeImplicitPagePreloadsMock = vi.hoisted(() => vi.fn())
const refreshModuleGraphMock = vi.hoisted(() => vi.fn())
const syncChunkImportsFromRequireCallsMock = vi.hoisted(() => vi.fn())

vi.mock('../../../runtime/chunkStrategy', () => ({
  DEFAULT_SHARED_CHUNK_STRATEGY: 'copy',
  applySharedChunkStrategy: vi.fn(),
  applyRuntimeChunkLocalization: vi.fn(),
}))

vi.mock('../../../ast', () => ({
  mayContainPlatformApiAccess: mayContainPlatformApiAccessMock,
  mayContainStaticRequireLiteral: mayContainStaticRequireLiteralMock,
  resolveAstEngine: resolveAstEngineMock,
}))

vi.mock('../../../utils/babel', () => ({
  parseJsLike: parseJsLikeMock,
  traverse: traverseMock,
  generate: generateMock,
}))

vi.mock('../../utils/wxmlEmit', () => ({
  emitWxmlAssetsWithCache: vi.fn(),
}))

vi.mock('../helpers', () => ({
  emitJsonAssets: vi.fn(),
  filterPluginBundleOutputs: vi.fn(),
  flushIndependentBuilds: flushIndependentBuildsMock,
  formatBytes: vi.fn(() => '0B'),
  refreshModuleGraph: refreshModuleGraphMock,
  refreshSharedChunkImporters: vi.fn(),
  removeImplicitPagePreloads: removeImplicitPagePreloadsMock,
  syncChunkImportsFromRequireCalls: syncChunkImportsFromRequireCallsMock,
}))

vi.mock('../../../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

function createState(overrides: Record<string, any> = {}) {
  const defaultConfigService = {
    isDev: false,
    platform: 'alipay',
    packageJson: {
      dependencies: undefined,
    },
    weappViteConfig: {
      injectWeapi: {
        enabled: true,
        replaceWx: true,
      },
    },
    relativeAbsoluteSrcRoot: (id: string) => id,
  }

  const mergedCtx = {
    scanService: {
      subPackageMap: new Map(),
      ...((overrides.ctx?.scanService as any) ?? {}),
    },
    configService: {
      ...defaultConfigService,
      ...((overrides.ctx?.configService as any) ?? {}),
    },
  }

  const baseState = {
    ctx: mergedCtx,
    subPackageMeta: null,
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
  }

  return Object.assign(baseState, overrides, { ctx: mergedCtx }) as any
}

describe('core lifecycle emit edge branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mayContainPlatformApiAccessMock.mockReturnValue(true)
    mayContainStaticRequireLiteralMock.mockReturnValue(true)
    resolveAstEngineMock.mockReturnValue('babel')
  })

  it('covers guarded call/member branches when dependencies are undefined', async () => {
    traverseMock.mockImplementation((_: any, visitors: Record<string, (path: any) => void>) => {
      if (visitors.CallExpression) {
        visitors.CallExpression({
          node: {
            callee: { type: 'Identifier', name: 'require' },
            arguments: [undefined],
          },
          scope: { hasBinding: () => false },
        })
        visitors.CallExpression({
          node: {
            callee: { type: 'Identifier', name: 'require' },
            arguments: [{ type: 'Literal', value: 123 }],
          },
          scope: { hasBinding: () => false },
        })
        visitors.CallExpression({
          node: {
            callee: { type: 'Identifier', name: 'require' },
            arguments: [{ type: 'StringLiteral', value: 'foo/path' }],
          },
          scope: { hasBinding: () => false },
        })
      }
      if (visitors.MemberExpression) {
        visitors.MemberExpression({
          node: { object: null },
          scope: { hasBinding: () => false },
        })
        visitors.MemberExpression({
          node: { object: { type: 'Identifier', name: 'console' } },
          scope: { hasBinding: () => false },
        })
      }
    })

    const { createGenerateBundleHook } = await import('./emit')
    const state = createState()
    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: 'const x = 1',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toBe('const x = 1')
    expect(flushIndependentBuildsMock).toHaveBeenCalledTimes(1)
    expect(removeImplicitPagePreloadsMock).toHaveBeenCalledTimes(1)
    expect(refreshModuleGraphMock).toHaveBeenCalledTimes(1)
  })

  it('covers hasDependencyPrefix edge cases for empty and overlong dependency tokens', async () => {
    traverseMock.mockImplementation((_: any, visitors: Record<string, (path: any) => void>) => {
      if (!visitors.CallExpression) {
        return
      }
      visitors.CallExpression({
        node: {
          callee: { type: 'Identifier', name: 'require' },
          arguments: [{ type: 'StringLiteral', value: 'npm:' }],
        },
        scope: { hasBinding: () => false },
      })
      visitors.CallExpression({
        node: {
          callee: { type: 'Identifier', name: 'require' },
          arguments: [{ type: 'StringLiteral', value: 'foo/bar' }],
        },
        scope: { hasBinding: () => false },
      })
    })

    const { createGenerateBundleHook } = await import('./emit')
    const state = createState({
      ctx: {
        configService: {
          packageJson: {
            dependencies: {
              'foo/bar/baz': '^1.0.0',
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
        code: 'const y = 2',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toBe('const y = 2')
  })

  it('skips babel rewrite when oxc fast path finds no platform api access', async () => {
    const { createGenerateBundleHook } = await import('./emit')
    const state = createState({
      ctx: {
        configService: {
          weappViteConfig: {
            ast: {
              engine: 'oxc',
            },
            injectWeapi: {
              enabled: true,
              replaceWx: true,
            },
          },
        },
      },
    })
    resolveAstEngineMock.mockReturnValue('oxc')
    mayContainPlatformApiAccessMock.mockReturnValue(false)
    mayContainStaticRequireLiteralMock.mockReturnValue(false)

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: 'const answer = 42',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toBe('const answer = 42')
    expect(parseJsLikeMock).not.toHaveBeenCalled()
    expect(traverseMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('skips babel require rewrite when oxc fast path finds no static require literal', async () => {
    const { createGenerateBundleHook } = await import('./emit')
    const state = createState({
      ctx: {
        configService: {
          platform: 'alipay',
          packageJson: {
            dependencies: {
              dayjs: '^1.0.0',
            },
          },
          weappViteConfig: {
            ast: {
              engine: 'oxc',
            },
          },
        },
      },
    })
    resolveAstEngineMock.mockReturnValue('oxc')
    mayContainPlatformApiAccessMock.mockReturnValue(false)
    mayContainStaticRequireLiteralMock.mockReturnValue(false)

    const hook = createGenerateBundleHook(state, false)
    const bundle = {
      'main.js': {
        type: 'chunk',
        fileName: 'main.js',
        code: 'const value = getLoader()',
        imports: [],
        dynamicImports: [],
      },
    } as any

    await hook.call({}, {}, bundle)

    expect(bundle['main.js'].code).toBe('const value = getLoader()')
    expect(parseJsLikeMock).not.toHaveBeenCalled()
    expect(traverseMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })
})
