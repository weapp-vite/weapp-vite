import type { OutputBundle, OutputChunk } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import {
  collectAffectedSharedChunkEntriesAndChunks,
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
    resolvedEntryMap: new Map<string, any>(),
    ctx: {
      configService: {
        absoluteSrcRoot: '/project/src',
      },
      runtimeState: {
        build: {
          hmr: {
            sharedChunkSourceModuleIds: new Set<string>(),
          },
        },
      },
    },
    hmrSharedChunkImporters: new Map<string, Set<string>>(),
    hmrSharedChunksByEntry: new Map<string, Set<string>>(),
    hmrSharedChunkDependencies: new Map<string, Set<string>>(),
    outputChunksByModule: new Map<string, Set<string>>(),
    hmrSourceSharedChunks: new Set<string>(),
  } as any
}

describe('core output graph', () => {
  it('keeps logical source traversal out of output graph state', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/home/index.ts'
    const sharedModule = '/project/src/shared/value.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    const bundle: OutputBundle = {
      'pages/home/index.js': createChunk('pages/home/index.js', {
        isEntry: true,
        facadeModuleId: createLogicalEntryId(pageEntry, 'page'),
        moduleIds: [createLogicalEntryId(pageEntry, 'page'), pageEntry],
        imports: ['common.js'],
      }),
      'common.js': createChunk('common.js', {
        moduleIds: [sharedModule],
        modules: {
          [sharedModule]: {} as any,
        },
      }),
    }

    refreshSharedChunkImporters(bundle, state)

    expect(state.hmrSharedChunkImporters.get('common.js')).toEqual(new Set([pageEntry]))
    expect(state.outputChunksByModule.get(sharedModule)).toEqual(new Set(['common.js']))
    expect(state).not.toHaveProperty('moduleImporters')
    expect(state).not.toHaveProperty('entryModuleIds')
  })

  it('collects affected emitted chunks and their source entries in one pass', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/index.ts'
    const componentEntry = '/project/src/components/card/index.ts'
    const sharedModule = '/project/src/shared/tokens.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    state.resolvedEntryMap.set(componentEntry, { id: componentEntry })
    state.outputChunksByModule.set(sharedModule, new Set(['common.js', 'vendor.js']))
    state.hmrSharedChunkImporters.set('common.js', new Set([pageEntry]))
    state.hmrSharedChunkImporters.set('vendor.js', new Set([pageEntry, componentEntry]))

    expect(collectAffectedSharedChunkEntriesAndChunks(state, sharedModule)).toEqual({
      affectedChunks: new Set(['common.js', 'vendor.js']),
      affectedEntries: new Set([pageEntry, componentEntry]),
    })
  })

  it('propagates entry ownership through nested output chunk imports', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/index.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    refreshSharedChunkImporters({
      'pages/index.js': createChunk('pages/index.js', {
        isEntry: true,
        facadeModuleId: createLogicalEntryId(pageEntry, 'page'),
        imports: ['common.js'],
      }),
      'common.js': createChunk('common.js', { imports: ['vendor.js'] }),
      'vendor.js': createChunk('vendor.js'),
    }, state)

    expect(state.hmrSharedChunkImporters.get('common.js')).toEqual(new Set([pageEntry]))
    expect(state.hmrSharedChunkImporters.get('vendor.js')).toEqual(new Set([pageEntry]))
  })

  it('refreshes partial output membership without dropping unrelated entries', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/index.ts'
    const otherEntry = '/project/src/pages/other.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    state.resolvedEntryMap.set(otherEntry, { id: otherEntry })
    state.hmrSharedChunkImporters.set('common.js', new Set([pageEntry, otherEntry]))
    state.hmrSharedChunksByEntry.set(pageEntry, new Set(['common.js']))
    state.hmrSharedChunksByEntry.set(otherEntry, new Set(['common.js']))

    refreshPartialSharedChunkImporters({
      'pages/index.js': createChunk('pages/index.js', {
        isEntry: true,
        facadeModuleId: createLogicalEntryId(pageEntry, 'page'),
        imports: ['next-common.js'],
      }),
      'next-common.js': createChunk('next-common.js'),
    }, state, new Set([pageEntry]))

    expect(state.hmrSharedChunkImporters.get('common.js')).toEqual(new Set([otherEntry]))
    expect(state.hmrSharedChunkImporters.get('next-common.js')).toEqual(new Set([pageEntry]))
  })

  it('replaces stale module-to-output membership on partial refresh', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/index.ts'
    const staleModule = '/project/src/shared/stale.ts'
    const nextModule = '/project/src/shared/next.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    state.outputChunksByModule.set(staleModule, new Set(['common.js']))
    state.hmrSharedChunkImporters.set('common.js', new Set([pageEntry]))
    state.hmrSharedChunksByEntry.set(pageEntry, new Set(['common.js']))

    refreshPartialSharedChunkImporters({
      'pages/index.js': createChunk('pages/index.js', {
        isEntry: true,
        facadeModuleId: createLogicalEntryId(pageEntry, 'page'),
        imports: ['common.js'],
      }),
      'common.js': createChunk('common.js', {
        moduleIds: [nextModule],
        modules: { [nextModule]: {} as any },
      }),
    }, state, new Set([pageEntry]))

    expect(state.outputChunksByModule.has(staleModule)).toBe(false)
    expect(state.outputChunksByModule.get(nextModule)).toEqual(new Set(['common.js']))
  })
})
