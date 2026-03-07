import type { OutputBundle, OutputChunk } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { collectAffectedEntries, refreshModuleGraph, refreshSharedChunkImporters } from './graph'

function createChunk(fileName: string, overrides: Partial<OutputChunk> = {}): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    code: '',
    name: fileName.replace(/\.js$/, '').replace(/\//g, '_'),
    modules: {},
    imports: [],
    dynamicImports: [],
    exports: [],
    isEntry: false,
    facadeModuleId: null,
    isDynamicEntry: false,
    moduleIds: [],
    map: null,
    sourcemapFileName: `${fileName}.map`,
    preliminaryFileName: fileName,
    ...overrides,
  }
}

function createState() {
  return {
    moduleImporters: new Map<string, Set<string>>(),
    entryModuleIds: new Set<string>(),
    resolvedEntryMap: new Map<string, any>(),
    hmrSharedChunkImporters: new Map<string, Set<string>>(),
  } as any
}

describe('core helpers graph', () => {
  it('collects affected entries through importer graph traversal', () => {
    const state = createState()
    state.entryModuleIds = new Set(['/src/app.ts', '/src/admin.ts'])
    state.moduleImporters = new Map<string, Set<string>>([
      ['/src/shared.ts', new Set(['/src/mid.ts'])],
      ['/src/mid.ts', new Set(['/src/app.ts', '/src/loop-a.ts'])],
      ['/src/loop-a.ts', new Set(['/src/loop-b.ts'])],
      ['/src/loop-b.ts', new Set(['/src/loop-a.ts'])],
    ])

    expect(collectAffectedEntries(state, '/src/shared.ts')).toEqual(new Set(['/src/app.ts']))
    expect(collectAffectedEntries(state, '/src/unknown.ts')).toEqual(new Set())
  })

  it('refreshes module graph and skips virtual or node built-in ids', () => {
    const state = createState()
    state.moduleImporters.set('stale', new Set(['stale']))
    state.entryModuleIds.add('stale')

    refreshModuleGraph({}, state)
    expect(state.moduleImporters.size).toBe(0)
    expect(state.entryModuleIds.size).toBe(0)

    const moduleInfoMap = new Map<string, any>([
      ['/project/src/entry.ts?raw=1', {
        isEntry: true,
        importers: [],
        dynamicImporters: [],
      }],
      ['/project/src/dep.ts', {
        isEntry: false,
        importers: [
          '/@fs/project/src/entry.ts?x=1',
          'node:path',
          '\0virtual:skip',
        ],
        dynamicImporters: [
          'file:///project/src/dynamic.ts',
        ],
      }],
      ['/project/src/dynamic.ts', {
        isEntry: false,
      }],
      ['/project/src/no-info.ts', undefined],
    ])

    refreshModuleGraph({
      getModuleIds: () => [
        '/project/src/entry.ts?raw=1',
        '/project/src/dep.ts',
        '/project/src/dynamic.ts',
        '/project/src/no-info.ts',
        '\0virtual:skip',
        'node:fs',
      ],
      getModuleInfo: (id: string) => moduleInfoMap.get(id),
    }, state)

    expect(state.entryModuleIds).toEqual(new Set(['/project/src/entry.ts']))
    const normalizedDynamicImporter = normalizeFsResolvedId('file:///project/src/dynamic.ts')
    expect(state.moduleImporters.get('/project/src/dep.ts')).toEqual(
      new Set(['/project/src/entry.ts', normalizedDynamicImporter]),
    )
    expect(state.moduleImporters.has('/project/src/dynamic.ts')).toBe(false)
    expect(state.moduleImporters.has('\0virtual:skip')).toBe(false)
  })

  it('refreshes shared chunk importers from entry chunks only', () => {
    const state = createState()
    state.resolvedEntryMap.set('/project/src/virtual-entry.ts', {
      value: true,
    })

    const bundle: OutputBundle = {
      'asset.txt': {
        type: 'asset',
        fileName: 'asset.txt',
        source: 'asset',
      } as any,
      'entries/a.js': createChunk('entries/a.js', {
        isEntry: true,
        facadeModuleId: '/project/src/pages/a.ts',
        imports: ['chunks/shared.js', 'chunks/entry-like.js', 'chunks/missing.js'],
        dynamicImports: ['chunks/lazy.js'],
      }),
      'entries/virtual.js': createChunk('entries/virtual.js', {
        isEntry: false,
        facadeModuleId: '/project/src/virtual-entry.ts',
        imports: ['chunks/shared.js'],
      }),
      'chunks/shared.js': createChunk('chunks/shared.js', {
        facadeModuleId: '/project/src/chunks/shared.ts',
      }),
      'chunks/lazy.js': createChunk('chunks/lazy.js', {
        facadeModuleId: '/project/src/chunks/lazy.ts',
      }),
      'chunks/entry-like.js': createChunk('chunks/entry-like.js', {
        facadeModuleId: '/project/src/virtual-entry.ts',
      }),
      'chunks/no-facade.js': createChunk('chunks/no-facade.js', {
        facadeModuleId: null,
      }),
    }

    state.hmrSharedChunkImporters.set('stale', new Set(['/stale']))

    refreshSharedChunkImporters(bundle, state)

    expect(state.hmrSharedChunkImporters.has('stale')).toBe(false)
    expect(state.hmrSharedChunkImporters.get('chunks/shared.js')).toEqual(
      new Set(['/project/src/pages/a.ts', '/project/src/virtual-entry.ts']),
    )
    expect(state.hmrSharedChunkImporters.get('chunks/lazy.js')).toEqual(
      new Set(['/project/src/pages/a.ts']),
    )
    expect(state.hmrSharedChunkImporters.has('chunks/entry-like.js')).toBe(false)
    expect(state.hmrSharedChunkImporters.has('chunks/missing.js')).toBe(false)
  })
})
