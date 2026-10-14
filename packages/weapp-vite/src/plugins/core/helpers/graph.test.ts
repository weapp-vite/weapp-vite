import type { OutputBundle, OutputChunk } from 'rolldown'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import {
  collectAffectedSharedChunkEntriesAndChunks,
  refreshPartialSharedChunkImporters,
  refreshSharedChunkImporters,
} from './graph'

const directories: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

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
  it.each(['full', 'partial'] as const)('%s refresh resolves repeated logical identities once and observes the next junction target', (mode) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'output-graph-paths-'))
    directories.push(directory)
    const root = realpathSync.native(directory).replaceAll('\\', '/')
    const alias = `${root}/alias`
    const logicalId = createLogicalEntryId(`${alias}/page.ts`, 'page')
    for (const target of ['first', 'second']) {
      mkdirSync(`${root}/${target}`)
      writeFileSync(`${root}/${target}/page.ts`, 'Page({})')
    }
    const state = createState()
    state.ctx.configService.absoluteSrcRoot = root
    const bundle: OutputBundle = {
      'pages/index.js': createChunk('pages/index.js', {
        isEntry: true,
        facadeModuleId: logicalId,
        moduleIds: [logicalId, logicalId],
        imports: ['shared.js'],
      }),
      'shared.js': createChunk('shared.js'),
    }
    const native = vi.spyOn(realpathSync, 'native')
    const refresh = (page: string) => mode === 'full'
      ? refreshSharedChunkImporters(bundle, state)
      : refreshPartialSharedChunkImporters(bundle, state, new Set([page]))
    for (const target of ['first', 'second']) {
      const page = `${root}/${target}/page.ts`
      symlinkSync(`${root}/${target}`, alias, 'junction')
      state.resolvedEntryMap.clear()
      state.resolvedEntryMap.set(page, {})
      native.mockClear()
      refresh(page)
      expect(native.mock.calls.map(([file]) => file)).toEqual([`${alias}/page.ts`])
      expect(state.hmrSharedChunkImporters.get('shared.js')).toContain(page)
      Object.defineProperty(bundle['shared.js'], 'imports', {
        configurable: true,
        get() { throw new Error('output graph read failed') },
      })
      expect(() => refresh(page)).toThrow('output graph read failed')
      Object.defineProperty(bundle['shared.js'], 'imports', { value: [], configurable: true })
      native.mockClear()
      refresh(page)
      expect(native.mock.calls.map(([file]) => file)).toEqual([`${alias}/page.ts`])
      expect(state.hmrSharedChunkImporters.get('shared.js')).toContain(page)
      unlinkSync(alias)
    }
  })

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

  it('keeps page ownership when a physical component lives in a non-entry shared chunk', () => {
    const state = createState()
    const pageEntry = '/project/src/pages/index.ts'
    const componentEntry = '/project/src/components/card/index.ts'
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    state.resolvedEntryMap.set(componentEntry, { id: componentEntry })

    refreshSharedChunkImporters({
      'pages/index.js': createChunk('pages/index.js', {
        isEntry: true,
        facadeModuleId: createLogicalEntryId(pageEntry, 'page'),
        imports: ['component-runtime.js'],
      }),
      'component-runtime.js': createChunk('component-runtime.js', {
        moduleIds: [componentEntry],
        imports: ['component-helper.js'],
      }),
      'component-helper.js': createChunk('component-helper.js'),
    }, state)

    expect(state.hmrSharedChunkImporters.get('component-runtime.js')).toEqual(new Set([pageEntry]))
    expect(state.hmrSharedChunkImporters.get('component-helper.js')).toEqual(new Set([pageEntry]))
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
