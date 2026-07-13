import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transformVueLikeFile } from '../transformFile'
import { tryRefreshJsonOnlyVueCompilation } from './jsonOnly'

const compileVueFileMock = vi.hoisted(() => vi.fn(async () => ({
  config: '{"navigationBarTitleText":"新标题"}',
  script: 'Component({ refreshed: true })',
  template: '<view />',
  meta: { styleBlocks: [] },
})))
const compileJsxFileMock = vi.hoisted(() => vi.fn())

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  return {
    ...actual,
    compileJsxFile: compileJsxFileMock,
    compileVueFile: compileVueFileMock,
  }
})

vi.mock('../../../../utils/cache', () => ({
  readFile: vi.fn(),
}))

vi.mock('../../../../utils/invalidateEntry', () => ({
  syncVueSfcStyleDependencies: vi.fn(() => []),
}))

vi.mock('../../../../utils/watchFiles', () => ({
  addNormalizedWatchFile: vi.fn(),
}))

vi.mock('../../../wevu', () => ({
  createPageEntryMatcher: vi.fn(() => ({
    isPageFile: vi.fn(async () => true),
    markDirty: vi.fn(),
  })),
}))

vi.mock('../../../vue/transform/resolver', () => ({
  getSourceFromVirtualId: vi.fn((id: string) => id),
}))

vi.mock('../compileOptions', () => ({
  createCompileVueFileOptions: vi.fn(() => ({})),
  isVueTransformSourceMapEnabled: vi.fn(() => false),
}))

vi.mock('../scopedSlot', () => ({
  emitScopedSlotChunks: vi.fn(),
  registerScopedSlotHostGenerics: vi.fn(),
}))

function createOptions() {
  const filename = '/project/src/pages/home/index.vue'
  const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '旧标题' })
</script>
<template><view /></template>`
  const nextSource = previousSource.replace('旧标题', '新标题')
  const dirtyVueEntryIds = new Set([filename])
  const compilationCache = new Map<string, any>([
    [filename, {
      result: {
        config: '{"navigationBarTitleText":"旧标题"}',
        script: 'Component({ cached: true })',
        template: '<view />',
        meta: {
          jsonConfigCache: {
            autoUsingComponentsMap: {},
          },
          jsonMacroHash: 'old-hash',
          styleBlocks: [],
        },
      },
      source: previousSource,
      isPage: true,
      refreshToken: 1,
    }],
  ])

  return {
    filename,
    nextSource,
    dirtyVueEntryIds,
    compilationCache,
    options: {
      ctx: {
        configService: {
          isDev: true,
          platform: 'weapp',
          outputExtensions: { js: 'js' },
          relativeOutputPath: (value: string) => value.replace('/project/src/', ''),
          weappViteConfig: {},
        },
        runtimeState: {
          scan: { isDirty: false },
          build: {
            hmr: {
              dirtyVueEntryIds,
              profile: {
                eventId: 'hmr-json-1',
                dirtyReasonSummary: ['entry-json-only:1'],
              },
            },
          },
        },
        autoImportService: { resolve: () => undefined },
      },
      pluginCtx: {
        addWatchFile: vi.fn(),
        emitFile: vi.fn(),
      },
      code: nextSource,
      id: filename,
      compilationCache,
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
    } as any,
  }
}

describe('transformVueLikeFile json-only reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes page json without recompiling unchanged script and template output', async () => {
    const { compilationCache, dirtyVueEntryIds, filename, nextSource, options } = createOptions()

    await transformVueLikeFile(options)

    expect(compileVueFileMock).not.toHaveBeenCalled()
    expect(compilationCache.get(filename)).toMatchObject({
      source: nextSource,
      result: {
        config: JSON.stringify({ navigationBarTitleText: '新标题' }, null, 2),
        script: 'Component({ cached: true })',
        template: '<view />',
      },
    })
    expect(dirtyVueEntryIds.size).toBe(0)
  })
})

describe('tryRefreshJsonOnlyVueCompilation', () => {
  const source = `<script setup>definePageJson({ navigationBarTitleText: '新标题' })</script>
<template><view /></template>`

  function createRefreshOptions() {
    return {
      cachedResult: {
        config: '{"navigationBarTitleText":"旧标题"}',
        script: 'Component({ cached: true })',
        template: '<view />',
        meta: {
          jsonConfigCache: {
            autoUsingComponentsMap: {},
          },
          styleBlocks: [],
        },
      },
      compileOptions: { isPage: true },
      dirtyEntryId: '/project/src/pages/home/index.vue',
      dirtyReasonSummary: ['entry-json-only:1'],
      filename: '/project/src/pages/home/index.vue',
      isDev: true,
      scanDirty: false,
      source,
      autoRoutesSignature: undefined,
      cachedAutoRoutesSignature: undefined,
    }
  }

  it.each([
    ['production mode', { isDev: false }],
    ['dirty route scan', { scanDirty: true }],
    ['missing dirty entry', { dirtyEntryId: undefined }],
    ['missing compilation cache', { cachedResult: undefined }],
    ['non-vue entry', { filename: '/project/src/pages/home/index.tsx' }],
    ['changed auto-route signature', { autoRoutesSignature: 'next', cachedAutoRoutesSignature: 'previous' }],
    ['missing dirty reasons', { dirtyReasonSummary: undefined }],
    ['mixed dirty reasons', { dirtyReasonSummary: ['entry-json-only:1', 'entry-script:1'] }],
  ])('falls back for %s', async (_label, overrides) => {
    await expect(tryRefreshJsonOnlyVueCompilation({
      ...createRefreshOptions(),
      ...overrides,
    } as any)).resolves.toBeUndefined()
  })

  it('returns undefined when the cached result has no json config inputs', async () => {
    const options = createRefreshOptions()
    options.cachedResult.meta = { styleBlocks: [] } as any

    await expect(tryRefreshJsonOnlyVueCompilation(options)).resolves.toBeUndefined()
  })

  it('refreshes and normalizes a valid json-only compilation', async () => {
    const result = await tryRefreshJsonOnlyVueCompilation(createRefreshOptions())

    expect(result).toMatchObject({
      config: JSON.stringify({ navigationBarTitleText: '新标题' }, null, 2),
      script: 'Component({ cached: true })',
      template: '<view />',
    })
  })
})
