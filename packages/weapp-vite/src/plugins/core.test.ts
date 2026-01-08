import { describe, expect, it, vi } from 'vitest'
import { weappVite } from './core'

const mocked = vi.hoisted(() => {
  const loadEntry = vi.fn(async () => ({ code: 'ok' }))
  const loadedEntrySet = new Set<string>()
  const resolvedEntryMap = new Map<string, any>()
  const markEntryDirty = vi.fn()
  const emitDirtyEntries = vi.fn()
  let sharedChunkImporters: Map<string, Set<string>> | undefined
  return {
    loadEntry,
    loadedEntrySet,
    resolvedEntryMap,
    markEntryDirty,
    emitDirtyEntries,
    get sharedChunkImporters() {
      return sharedChunkImporters
    },
    set sharedChunkImporters(value: Map<string, Set<string>> | undefined) {
      sharedChunkImporters = value
    },
  }
})

vi.mock('./hooks/useLoadEntry', () => {
  return {
    __esModule: true,
    useLoadEntry: (_ctx: any, options?: { hmr?: { sharedChunkImporters?: Map<string, Set<string>> } }) => {
      mocked.sharedChunkImporters = options?.hmr?.sharedChunkImporters
      return {
        loadEntry: mocked.loadEntry,
        loadedEntrySet: mocked.loadedEntrySet,
        resolvedEntryMap: mocked.resolvedEntryMap,
        markEntryDirty: mocked.markEntryDirty,
        emitDirtyEntries: mocked.emitDirtyEntries,
        entriesMap: new Map(),
        jsonEmitFilesMap: new Map(),
      }
    },
  }
})

describe('weapp-vite:pre load', () => {
  it('unwraps \\0vue: ids for app entry detection', async () => {
    mocked.loadEntry.mockClear()
    mocked.loadedEntrySet.clear()
    mocked.resolvedEntryMap.clear()

    const plugins = weappVite({
      currentBuildTarget: 'app',
      configService: {
        absoluteSrcRoot: '/project/src',
        isDev: false,
        weappViteConfig: {},
        relativeAbsoluteSrcRoot(id: string) {
          return id.replace('/project/src/', '')
        },
      },
      scanService: {} as any,
      buildService: {} as any,
    } as any)

    const core = plugins.find(p => p.name === 'weapp-vite:pre')!
    await core.load!.call({} as any, '\0vue:/project/src/app.vue')

    expect(mocked.loadEntry).toHaveBeenCalledWith('/project/src/app.vue', 'app')
  })

  it('matches loadedEntrySet against unwrapped vue ids', async () => {
    mocked.loadEntry.mockClear()
    mocked.loadedEntrySet.clear()
    mocked.resolvedEntryMap.clear()
    mocked.loadedEntrySet.add('/project/src/pages/a.vue')

    const plugins = weappVite({
      currentBuildTarget: 'app',
      configService: {
        absoluteSrcRoot: '/project/src',
        isDev: false,
        weappViteConfig: {},
        relativeAbsoluteSrcRoot(id: string) {
          return id.replace('/project/src/', '')
        },
      },
      scanService: {} as any,
      buildService: {} as any,
    } as any)

    const core = plugins.find(p => p.name === 'weapp-vite:pre')!
    await core.load!.call({} as any, '\0vue:/project/src/pages/a.vue')

    expect(mocked.loadEntry).toHaveBeenCalledWith('/project/src/pages/a.vue', 'component')
  })

  it('tracks shared chunk importers in auto hmr mode', async () => {
    mocked.loadEntry.mockClear()
    mocked.loadedEntrySet.clear()
    mocked.resolvedEntryMap.clear()

    const dataEntry = '/project/src/pages/data/index.ts'
    const indexEntry = '/project/src/pages/index/index.ts'
    mocked.resolvedEntryMap.set(dataEntry, { id: dataEntry })
    mocked.resolvedEntryMap.set(indexEntry, { id: indexEntry })

    const plugins = weappVite({
      currentBuildTarget: 'app',
      configService: {
        absoluteSrcRoot: '/project/src',
        isDev: true,
        weappViteConfig: {
          hmr: { sharedChunks: 'auto' },
          chunks: { sharedStrategy: 'hoist' },
        },
        relativeAbsoluteSrcRoot(id: string) {
          return id.replace('/project/src/', '')
        },
      },
      scanService: {
        subPackageMap: new Map(),
      } as any,
      buildService: {} as any,
    } as any)

    const core = plugins.find(p => p.name === 'weapp-vite:pre')!
    const bundle = {
      'pages/data/index.js': {
        type: 'chunk',
        isEntry: true,
        facadeModuleId: dataEntry,
        imports: ['common.js'],
        dynamicImports: [],
        code: '',
      },
      'pages/index/index.js': {
        type: 'chunk',
        isEntry: true,
        facadeModuleId: indexEntry,
        imports: ['common.js'],
        dynamicImports: [],
        code: '',
      },
      'common.js': {
        type: 'chunk',
        isEntry: false,
        facadeModuleId: '/project/src/common.ts',
        imports: [],
        dynamicImports: [],
        code: '',
      },
    } as any

    await core.generateBundle!.call({} as any, {}, bundle)

    const importers = mocked.sharedChunkImporters?.get('common.js')
    expect(importers).toBeTruthy()
    expect(Array.from(importers ?? []).sort()).toEqual([dataEntry, indexEntry].sort())
  })
})
