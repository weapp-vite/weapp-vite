import type { OutputBundle, OutputChunk } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import {
  collectAffectedEntries,
  collectAffectedEntriesFromSharedChunks,
  refreshModuleGraph,
  refreshPartialSharedChunkImporters,
  refreshSharedChunkImporters,
} from './graph'

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
    ctx: {
      configService: {
        absoluteSrcRoot: '/project/src',
      },
    },
    hmrSharedChunkImporters: new Map<string, Set<string>>(),
    hmrSharedChunksByEntry: new Map<string, Set<string>>(),
    hmrSharedChunkDependencies: new Map<string, Set<string>>(),
    hmrSharedChunksByModule: new Map<string, Set<string>>(),
    hmrSourceSharedChunks: new Set<string>(),
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
    state.resolvedEntryMap.set('/project/src/layouts/default.vue', {
      value: true,
    })
    state.resolvedEntryMap.set('/project/src/components/base-navbar/index.vue', {
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
      'layouts/default.js': createChunk('layouts/default.js', {
        isEntry: false,
        facadeModuleId: null,
        moduleIds: ['/project/src/layouts/default.vue'],
        imports: ['chunks/shared.js'],
      }),
      'components/base-navbar/index.js': createChunk('components/base-navbar/index.js', {
        isEntry: false,
        facadeModuleId: null,
        moduleIds: ['/project/src/components/base-navbar/index.vue'],
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
      new Set([
        '/project/src/pages/a.ts',
        '/project/src/virtual-entry.ts',
        '/project/src/layouts/default.vue',
        '/project/src/components/base-navbar/index.vue',
      ]),
    )
    expect(state.hmrSharedChunkImporters.get('chunks/lazy.js')).toEqual(
      new Set(['/project/src/pages/a.ts']),
    )
    expect(state.hmrSharedChunksByEntry.get('/project/src/pages/a.ts')).toEqual(
      new Set(['chunks/shared.js', 'chunks/lazy.js']),
    )
    expect(state.hmrSharedChunksByEntry.get('/project/src/virtual-entry.ts')).toEqual(
      new Set(['chunks/shared.js']),
    )
    expect(state.hmrSharedChunkImporters.has('chunks/entry-like.js')).toBe(false)
    expect(state.hmrSharedChunkImporters.has('chunks/missing.js')).toBe(false)
    expect(state.hmrSourceSharedChunks).toEqual(new Set([
      'entries/a.js',
      'entries/virtual.js',
      'layouts/default.js',
      'components/base-navbar/index.js',
      'chunks/shared.js',
      'chunks/lazy.js',
      'chunks/entry-like.js',
    ]))
  })

  it('collects affected entries from shared chunk source module index', () => {
    const state = createState()
    const appEntry = '/project/src/app.ts'
    const pageEntry = '/project/src/pages/native/index.ts'
    const componentEntry = '/project/src/components/probe-card/index.ts'
    const sharedModule = '/project/src/shared/tokens.ts'
    state.resolvedEntryMap.set(appEntry, { value: true })
    state.resolvedEntryMap.set(pageEntry, { value: true })
    state.resolvedEntryMap.set(componentEntry, { value: true })

    const bundle: OutputBundle = {
      'app.js': createChunk('app.js', {
        isEntry: true,
        facadeModuleId: appEntry,
        imports: ['./weapp-vendors/wevu-ref.js'],
      }),
      'pages/native/index.js': createChunk('pages/native/index.js', {
        isEntry: true,
        facadeModuleId: pageEntry,
        imports: ['../../weapp-vendors/wevu-ref.js'],
      }),
      'components/probe-card/index.js': createChunk('components/probe-card/index.js', {
        isEntry: false,
        moduleIds: [componentEntry],
        imports: ['../../weapp-vendors/wevu-ref.js'],
      }),
      'weapp-vendors/wevu-ref.js': createChunk('weapp-vendors/wevu-ref.js', {
        moduleIds: [sharedModule],
        modules: {
          [sharedModule]: {} as any,
        },
      }),
    }

    refreshSharedChunkImporters(bundle, state)

    expect(state.hmrSharedChunksByModule.get(sharedModule)).toEqual(
      new Set(['weapp-vendors/wevu-ref.js']),
    )
    expect(collectAffectedEntriesFromSharedChunks(state, sharedModule)).toEqual(
      new Set([appEntry, pageEntry, componentEntry]),
    )
  })

  it('propagates shared chunk importers through intermediate shared chunks', () => {
    const state = createState()
    state.resolvedEntryMap.set('/project/src/app.ts', { value: true })
    state.resolvedEntryMap.set('/project/src/pages/hmr/index.ts', { value: true })

    const bundle: OutputBundle = {
      'app.js': createChunk('app.js', {
        isEntry: true,
        facadeModuleId: '/project/src/app.ts',
        imports: ['./weapp-vendors/wevu-ref.js'],
      }),
      'pages/hmr/index.js': createChunk('pages/hmr/index.js', {
        isEntry: true,
        facadeModuleId: '/project/src/pages/hmr/index.ts',
        imports: ['../../common.js'],
      }),
      'common.js': createChunk('common.js', {
        imports: ['./weapp-vendors/wevu-ref.js'],
      }),
      'weapp-vendors/wevu-ref.js': createChunk('weapp-vendors/wevu-ref.js'),
    }

    refreshSharedChunkImporters(bundle, state)

    expect(state.hmrSharedChunkImporters.get('common.js')).toEqual(
      new Set(['/project/src/pages/hmr/index.ts']),
    )
    expect(state.hmrSharedChunkImporters.get('weapp-vendors/wevu-ref.js')).toEqual(
      new Set(['/project/src/app.ts', '/project/src/pages/hmr/index.ts']),
    )
  })

  it('preserves existing shared chunk importers when partial emits omit unchanged shared chunks', () => {
    const state = createState()
    state.resolvedEntryMap.set('/project/src/pages/issue-398.vue', { value: true })
    state.resolvedEntryMap.set('/project/src/components/base-navbar.vue', { value: true })
    state.resolvedEntryMap.set('/project/src/components/base-footer.vue', { value: true })
    state.hmrSharedChunkImporters.set('chunks/runtime.js', new Set([
      '/project/src/pages/issue-398.vue',
      '/project/src/components/base-navbar.vue',
      '/project/src/components/base-footer.vue',
    ]))

    const partialBundle: OutputBundle = {
      'components/base-navbar.js': createChunk('components/base-navbar.js', {
        moduleIds: ['/project/src/components/base-navbar.vue'],
        imports: ['chunks/runtime.js'],
      }),
    }

    refreshPartialSharedChunkImporters(partialBundle, state, new Set(['/project/src/components/base-navbar.vue']))

    expect(state.hmrSharedChunkImporters.get('chunks/runtime.js')).toEqual(
      new Set([
        '/project/src/pages/issue-398.vue',
        '/project/src/components/base-navbar.vue',
        '/project/src/components/base-footer.vue',
      ]),
    )
    expect(state.hmrSharedChunksByEntry.get('/project/src/components/base-navbar.vue')).toEqual(
      new Set(['chunks/runtime.js']),
    )
  })

  it('replaces module index for chunks included in partial refreshes', () => {
    const state = createState()
    const entry = '/project/src/pages/hmr/index.ts'
    const previousModule = '/project/src/shared/previous.ts'
    const nextModule = '/project/src/shared/next.ts'
    state.resolvedEntryMap.set(entry, { value: true })
    state.hmrSharedChunkImporters.set('common.js', new Set([entry]))
    state.hmrSharedChunksByModule.set(previousModule, new Set(['common.js']))

    const partialBundle: OutputBundle = {
      'pages/hmr/index.js': createChunk('pages/hmr/index.js', {
        isEntry: true,
        facadeModuleId: entry,
        imports: ['../../common.js'],
      }),
      'common.js': createChunk('common.js', {
        moduleIds: [nextModule],
      }),
    }

    refreshPartialSharedChunkImporters(partialBundle, state, new Set([entry]))

    expect(state.hmrSharedChunksByModule.has(previousModule)).toBe(false)
    expect(state.hmrSharedChunksByModule.get(nextModule)).toEqual(new Set(['common.js']))
  })

  it('preserves transitive shared chunk importers when partial emits omit nested shared chunks', () => {
    const state = createState()
    const appEntry = '/project/src/app.ts'
    const pageEntry = '/project/src/pages/hmr/index.ts'
    state.resolvedEntryMap.set(appEntry, { value: true })
    state.resolvedEntryMap.set(pageEntry, { value: true })
    state.hmrSharedChunkImporters.set('common.js', new Set([pageEntry]))
    state.hmrSharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set([appEntry, pageEntry]))

    const partialBundle: OutputBundle = {
      'pages/hmr/index.js': createChunk('pages/hmr/index.js', {
        isEntry: true,
        facadeModuleId: pageEntry,
        imports: ['../../common.js'],
      }),
      'common.js': createChunk('common.js', {
        imports: ['./weapp-vendors/wevu-ref.js'],
      }),
    }

    refreshPartialSharedChunkImporters(partialBundle, state, new Set([pageEntry]))

    expect(state.hmrSharedChunkImporters.get('common.js')).toEqual(new Set([pageEntry]))
    expect(state.hmrSharedChunkImporters.get('weapp-vendors/wevu-ref.js')).toEqual(
      new Set([appEntry, pageEntry]),
    )
  })

  it('preserves nested shared chunk importers when partial emits omit the intermediate shared chunk', () => {
    const state = createState()
    const appEntry = '/project/src/app.ts'
    const componentEntry = '/project/src/components/issue-446/ShortBindProbe/index.vue'
    state.resolvedEntryMap.set(appEntry, { value: true })
    state.resolvedEntryMap.set(componentEntry, { value: true })
    state.hmrSharedChunkImporters.set('weapp-vendors/wevu-src.js', new Set([componentEntry]))
    state.hmrSharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set([appEntry, componentEntry]))
    state.hmrSharedChunkDependencies.set(
      'weapp-vendors/wevu-src.js',
      new Set(['weapp-vendors/wevu-ref.js']),
    )

    const partialBundle: OutputBundle = {
      'components/issue-446/ShortBindProbe/index.js': createChunk('components/issue-446/ShortBindProbe/index.js', {
        moduleIds: [componentEntry],
        imports: ['../../../weapp-vendors/wevu-src.js'],
      }),
    }

    refreshPartialSharedChunkImporters(partialBundle, state, new Set([componentEntry]))

    expect(state.hmrSharedChunkImporters.get('weapp-vendors/wevu-src.js')).toEqual(
      new Set([componentEntry]),
    )
    expect(state.hmrSharedChunkImporters.get('weapp-vendors/wevu-ref.js')).toEqual(
      new Set([appEntry, componentEntry]),
    )
    expect(state.hmrSharedChunksByEntry.get(componentEntry)).toEqual(
      new Set(['weapp-vendors/wevu-src.js', 'weapp-vendors/wevu-ref.js']),
    )
  })

  it('keeps existing shared chunk importers when partial bundle omits unchanged entry chunks', () => {
    const state = createState()
    const appEntry = '/project/src/app.ts'
    const pageEntry = '/project/src/pages/hmr/index.ts'
    state.resolvedEntryMap.set(appEntry, { value: true })
    state.resolvedEntryMap.set(pageEntry, { value: true })
    state.hmrSharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set([appEntry, pageEntry]))

    const partialBundle: OutputBundle = {
      'weapp-vendors/wevu-ref.js': createChunk('weapp-vendors/wevu-ref.js'),
    }

    refreshPartialSharedChunkImporters(partialBundle, state, new Set([pageEntry]))

    expect(state.hmrSharedChunkImporters.get('weapp-vendors/wevu-ref.js')).toEqual(
      new Set([appEntry, pageEntry]),
    )
  })
})
