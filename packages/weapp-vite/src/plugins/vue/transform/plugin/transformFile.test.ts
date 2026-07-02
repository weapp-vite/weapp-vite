import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transformVueLikeFile } from './transformFile'

const compileVueFileMock = vi.hoisted(() => vi.fn(async () => ({
  template: '<view />',
  script: 'Component({ refreshed: true })',
  meta: {
    styleBlocks: [],
  },
})))
const compileJsxFileMock = vi.hoisted(() => vi.fn(async () => ({
  template: '<view />',
  script: 'Component({ refreshed: true })',
  meta: {
    styleBlocks: [],
  },
})))
const readFileCachedMock = vi.hoisted(() => vi.fn(async () => '<template><view /></template>'))
const syncVueSfcStyleDependenciesMock = vi.hoisted(() => vi.fn(() => []))
const createPageEntryMatcherMock = vi.hoisted(() => vi.fn(() => ({
  isPageFile: vi.fn(async () => false),
  markDirty: vi.fn(),
})))
const getSourceFromVirtualIdMock = vi.hoisted(() => vi.fn((id: string) => id))
const createCompileVueFileOptionsMock = vi.hoisted(() => vi.fn(() => ({})))
const emitScopedSlotChunksMock = vi.hoisted(() => vi.fn())
const registerScopedSlotHostGenericsMock = vi.hoisted(() => vi.fn())
const addNormalizedWatchFileMock = vi.hoisted(() => vi.fn())
const resolveVueSfcStyleIndependentSignatureMock = vi.hoisted(() => vi.fn((source: string) => source.replace(/<style[\s\S]*?<\/style>/g, '')))

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    ...actual,
    compileJsxFile: compileJsxFileMock,
    compileVueFile: compileVueFileMock,
  }
})

vi.mock('../../../utils/cache', () => ({
  readFile: readFileCachedMock,
}))

vi.mock('../../../utils/invalidateEntry', () => ({
  syncVueSfcStyleDependencies: syncVueSfcStyleDependenciesMock,
}))

vi.mock('../../../utils/watchFiles', () => ({
  addNormalizedWatchFile: addNormalizedWatchFileMock,
}))

vi.mock('../../../wevu', () => ({
  createPageEntryMatcher: createPageEntryMatcherMock,
}))

vi.mock('../../resolver', () => ({
  getSourceFromVirtualId: getSourceFromVirtualIdMock,
}))

vi.mock('../compileOptions', () => ({
  createCompileVueFileOptions: createCompileVueFileOptionsMock,
  isVueTransformSourceMapEnabled: vi.fn(() => false),
}))

vi.mock('../scopedSlot', () => ({
  emitScopedSlotChunks: emitScopedSlotChunksMock,
  registerScopedSlotHostGenerics: registerScopedSlotHostGenericsMock,
}))

vi.mock('../../../../utils/file/vueSfcSignature', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../utils/file/vueSfcSignature')>()
  return {
    ...actual,
    resolveVueSfcStyleIndependentSignature: resolveVueSfcStyleIndependentSignatureMock,
  }
})

function createBaseOptions(overrides: Record<string, any> = {}) {
  return {
    ctx: {
      configService: {
        isDev: true,
        platform: 'weapp',
        outputExtensions: { js: 'js' },
        relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
        weappViteConfig: {},
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
        build: {
          hmr: {
            dirtyVueEntryIds: new Set<string>(),
            profile: {},
          },
        },
      },
      autoImportService: {
        resolve: () => undefined,
      },
    },
    pluginCtx: {
      addWatchFile: vi.fn(),
      emitFile: vi.fn(),
    },
    code: '<template><view /></template>',
    id: '/project/src/components/card.vue',
    compilationCache: new Map<string, any>(),
    setAppShell: vi.fn(),
    pageMatcher: null,
    setPageMatcher: vi.fn(),
    scanDirtySynced: true,
    setScanDirtySynced: vi.fn(),
    reExportResolutionCache: new Map(),
    compileOptionsCache: new Map(),
    componentMetaCache: new Map(),
    styleBlocksCache: new Map(),
    styleRefreshTokens: new Map(),
    scopedSlotModules: new Map(),
    emittedScopedSlotChunks: new Set(),
    classStyleRuntimeWarned: { value: false },
    readAndParseSfc: vi.fn(),
    createReadAndParseSfcOptions: vi.fn(),
    ...overrides,
  } as any
}

describe('transformVueLikeFile cache reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compileVueFileMock.mockResolvedValue({
      template: '<view />',
      script: 'Component({ refreshed: true })',
      meta: {
        styleBlocks: [],
      },
    })
    compileJsxFileMock.mockResolvedValue({
      template: '<view />',
      script: 'Component({ refreshed: true })',
      meta: {
        styleBlocks: [],
      },
    })
    readFileCachedMock.mockResolvedValue('<template><view /></template>')
    syncVueSfcStyleDependenciesMock.mockReturnValue([])
    createPageEntryMatcherMock.mockReturnValue({
      isPageFile: vi.fn(async () => false),
      markDirty: vi.fn(),
    })
    getSourceFromVirtualIdMock.mockImplementation((id: string) => id)
    createCompileVueFileOptionsMock.mockReturnValue({})
    resolveVueSfcStyleIndependentSignatureMock.mockImplementation((source: string) => source.replace(/<style[\s\S]*?<\/style>/g, ''))
  })

  it('reuses cached vue compilation when source and invalidation state are unchanged', async () => {
    const cachedResult = {
      template: '<view />',
      script: 'Component({ cached: true })',
      meta: {
        styleBlocks: [{ attrs: {}, content: '.card{}' }],
      },
    }
    const options = createBaseOptions({
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: cachedResult,
          source: '<template><view /></template>',
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
        }],
      ]),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ cached: true })'),
    })

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(compileJsxFileMock).not.toHaveBeenCalled()
    expect(options.compilationCache.get('/project/src/components/card.vue').refreshToken).toBe(0)
  })

  it('reuses dirty vue entries when transformed source is unchanged', async () => {
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const options = createBaseOptions({
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {},
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: {
            template: '<view />',
            script: 'Component({ cached: true })',
            meta: {
              styleBlocks: [],
            },
          },
          source: '<template><view /></template>',
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
        }],
      ]),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ cached: true })'),
    })

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(dirtyVueEntryIds.size).toBe(0)
    expect(options.compilationCache.get('/project/src/components/card.vue').refreshToken).toBe(0)
    expect(resolveVueSfcStyleIndependentSignatureMock).not.toHaveBeenCalled()
  })

  it('recompiles dirty vue entries when transformed source changes', async () => {
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const options = createBaseOptions({
      code: '<template><view>{{ title }}</view></template>',
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {},
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: {
            template: '<view />',
            script: 'Component({ cached: true })',
            meta: {
              styleBlocks: [],
            },
          },
          source: '<template><view /></template>',
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
        }],
      ]),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ refreshed: true })'),
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(dirtyVueEntryIds.size).toBe(0)
  })

  it('does not parse styled sfc blocks before reusing an unchanged cached compilation', async () => {
    const source = '<template><view /></template><style>.card{color:red}</style>'
    const readAndParseSfc = vi.fn()
    const options = createBaseOptions({
      code: source,
      readAndParseSfc,
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: {
            template: '<view />',
            script: 'Component({ cached: true })',
            meta: {
              styleBlocks: [{ attrs: {}, content: '.card{color:red}' }],
            },
          },
          source,
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
        }],
      ]),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ cached: true })'),
    })

    expect(readAndParseSfc).not.toHaveBeenCalled()
    expect(compileVueFileMock).not.toHaveBeenCalled()
  })

  it('does not parse styled sfc blocks before full dirty recompilation', async () => {
    const { resolveVueSfcStyleIndependentSignature } = await import('../../../../utils/file/vueSfcSignature')
    const previousSource = '<template><view /></template><script>const title = "old"</script><style>.card{color:red}</style>'
    const nextSource = '<template><view /></template><script>const title = "new"</script><style>.card{color:red}</style>'
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const readAndParseSfc = vi.fn()
    const options = createBaseOptions({
      code: nextSource,
      readAndParseSfc,
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {
                eventId: 'hmr-1',
                dirtyReasonSummary: ['entry-style-only:1'],
              },
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: {
            template: '<view />',
            script: 'Component({ cached: true })',
            meta: {
              styleBlocks: [{ attrs: {}, content: '.card{color:red}' }],
            },
          },
          source: previousSource,
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
          styleIndependentSignature: resolveVueSfcStyleIndependentSignature(previousSource, '/project/src/components/card.vue'),
        }],
      ]),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ refreshed: true })'),
    })

    expect(readAndParseSfc).not.toHaveBeenCalled()
    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(dirtyVueEntryIds.size).toBe(0)
  })

  it('reuses cached vue compilation for style-only dirty updates', async () => {
    const { resolveVueSfcStyleIndependentSignature } = await import('../../../../utils/file/vueSfcSignature')
    const previousSource = '<template><view /></template><style>.card{color:red}</style>'
    const nextSource = '<template><view /></template><style>.card{color:blue}</style>'
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const cachedResult = {
      template: '<view />',
      script: 'Component({ cached: true })',
      meta: {
        styleBlocks: [{ attrs: {}, content: '.card{color:red}' }],
      },
    }
    const nextStyleBlocks = [{ attrs: {}, content: '.card{color:blue}' }]
    const options = createBaseOptions({
      code: nextSource,
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {
                eventId: 'hmr-1',
                dirtyReasonSummary: ['entry-style-only:1'],
              },
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: cachedResult,
          source: previousSource,
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
          styleIndependentSignature: resolveVueSfcStyleIndependentSignature(previousSource, '/project/src/components/card.vue'),
        }],
      ]),
      readAndParseSfc: vi.fn(async () => ({
        descriptor: {
          styles: nextStyleBlocks,
        },
      })),
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ cached: true })'),
    })

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(options.compilationCache.get('/project/src/components/card.vue')).toMatchObject({
      source: nextSource,
      refreshToken: 0,
    })
    expect(options.compilationCache.get('/project/src/components/card.vue').result.style).toContain('color:blue')
    expect(options.styleBlocksCache.get('/project/src/components/card.vue')).toBe(nextStyleBlocks)
    expect(options.styleRefreshTokens.get('/project/src/components/card.vue')).toBe('hmr-1')
    expect(dirtyVueEntryIds.size).toBe(0)
  })

  it('refreshes cached style blocks for unchanged vue files when css importers are dirty', async () => {
    const source = '<template><view /></template><style src="./external.css"></style>'
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const previousStyleBlocks = [{
      attrs: { src: './external.css' },
      content: '.external{color:red}',
      lang: 'css',
      src: './external.css',
    }]
    const nextStyleBlocks = [{
      attrs: { src: './external.css' },
      content: '.external{--hmr-marker: refreshed;}',
      lang: 'css',
      src: './external.css',
    }]
    const cachedResult = {
      template: '<view />',
      script: 'Component({ cached: true })',
      style: '.external{color:red}',
      meta: {
        styleBlocks: previousStyleBlocks,
      },
    }
    const readAndParseSfc = vi.fn(async () => ({
      descriptor: {
        styles: nextStyleBlocks,
      },
    }))
    const options = createBaseOptions({
      code: source,
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {
                eventId: 'hmr-2',
                dirtyReasonSummary: ['css-importer:1'],
              },
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: cachedResult,
          source,
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
          styleIndependentSignature: resolveVueSfcStyleIndependentSignatureMock(source, '/project/src/components/card.vue'),
        }],
      ]),
      styleBlocksCache: new Map([
        ['/project/src/components/card.vue', previousStyleBlocks],
      ]),
      readAndParseSfc,
    })

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ cached: true })'),
    })

    expect(readAndParseSfc).toHaveBeenCalledTimes(1)
    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(options.compilationCache.get('/project/src/components/card.vue')).toMatchObject({
      source,
      refreshToken: 0,
    })
    expect(options.compilationCache.get('/project/src/components/card.vue').result.style).toContain('--hmr-marker: refreshed')
    expect(options.styleBlocksCache.get('/project/src/components/card.vue')).toBe(nextStyleBlocks)
    expect(options.styleRefreshTokens.get('/project/src/components/card.vue')).toBe('hmr-2')
    expect(dirtyVueEntryIds.size).toBe(0)
  })

  it('recompiles json-only dirty updates even when style-independent signature is unchanged', async () => {
    const previousSource = [
      '<script setup>',
      'definePageJson({ navigationBarTitleText: "before" })',
      '</script>',
      '<template><view /></template>',
    ].join('\n')
    const nextSource = previousSource.replace('before', 'after')
    const dirtyVueEntryIds = new Set(['/project/src/components/card.vue'])
    const options = createBaseOptions({
      code: nextSource,
      ctx: {
        ...createBaseOptions().ctx,
        runtimeState: {
          scan: {
            isDirty: false,
          },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {
                dirtyReasonSummary: ['entry-json-only:1'],
              },
            },
          },
        },
      },
      compilationCache: new Map([
        ['/project/src/components/card.vue', {
          result: {
            template: '<view />',
            script: 'Component({ cached: true })',
            meta: {},
          },
          source: previousSource,
          isPage: false,
          autoRoutesSignature: undefined,
          refreshToken: 1,
          styleIndependentSignature: 'same-signature',
        }],
      ]),
    })
    resolveVueSfcStyleIndependentSignatureMock.mockReturnValue('same-signature')

    await expect(transformVueLikeFile(options)).resolves.toMatchObject({
      code: expect.stringContaining('Component({ refreshed: true })'),
    })

    expect(compileVueFileMock).toHaveBeenCalledTimes(1)
    expect(dirtyVueEntryIds.size).toBe(0)
  })
})
