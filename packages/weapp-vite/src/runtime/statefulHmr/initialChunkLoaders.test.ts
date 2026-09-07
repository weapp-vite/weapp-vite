import type { StatefulHmrOutputFile } from './outputWriter'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { registerStatefulHmrInitialChunkLoaders } from './initialChunkLoaders'

interface Runtime {
  currentModuleId: string
  initialChunkLoaders: Map<string, { ids: string[], loading: boolean, load: () => void }>
  initModule: (id: string) => unknown
  registerModule: (id: string, holder: { exports: unknown }) => void
  registerFactory: (id: string, kind: 'esm', factory: (id: string) => void) => void
  beginPatch: () => void
  endPatch: () => void
}

function chunk(fileName: string, code: string, options: { isEntry?: boolean, imports?: string[] } = {}): Extract<StatefulHmrOutputFile, { type: 'chunk' }> {
  return { type: 'chunk', fileName, code, modules: {}, isEntry: false, ...options }
}

function createRuntime(chunks: StatefulHmrOutputFile[], subPackageRoots: string[] = []) {
  const runtimeChunk = chunk('rolldown-runtime.js', createStatefulHmrRolldownRuntimeSource())
  const output = [runtimeChunk, ...chunks]
  const loads: string[] = []
  const context = createContext({
    console,
    require(specifier: string) {
      loads.push(specifier)
      const target = output.find(item => `./${item.fileName}` === specifier)
      if (!target || target.type !== 'chunk') {
        throw new Error(`Unexpected native chunk: ${specifier}`)
      }
      runInContext(target.code, context, { filename: target.fileName, timeout: 5_000 })
    },
  })
  registerStatefulHmrInitialChunkLoaders(output, subPackageRoots)
  runInContext(runtimeChunk.code, context, { timeout: 5_000 })
  const runtime = runInContext('globalThis.__rolldown_runtime__', context) as Runtime
  return { runtime, loads }
}

describe('initial native chunk loaders', () => {
  it('maps actual runtime registration IDs only for isolated main-package non-entry chunks', () => {
    const { runtime, loads } = createRuntime([
      chunk('app.js', '__rolldown_runtime__.registerModule("app");', { isEntry: true, imports: ['vendor/imported.js'] }),
      chunk('pages/index.js', '__rolldown_runtime__.registerModule("page");', { isEntry: true }),
      chunk('vendor/imported.js', '__rolldown_runtime__.registerModule("imported");'),
      chunk('feature/vendor.js', '__rolldown_runtime__.registerModule("subpackage");'),
      chunk('independent/vendor.js', '__rolldown_runtime__.registerModule("independent");'),
      chunk('unknown.js', '__rolldown_runtime__.registerModule("unknown-entry-status");', { isEntry: undefined }),
      chunk('vendor/facade.js', `
        // __rolldown_runtime__.registerModule("comment-decoy");
        const note = '__rolldown_runtime__.registerModule("string-decoy")';
        other.registerModule('other-receiver');
        const registerModule = 'unrelatedMethod';
        __rolldown_runtime__[registerModule]('computed-variable-decoy');
        __rolldown_runtime__.registerModule('../../runtime/template.mjs', { exports: {} });
      `),
      { type: 'asset', fileName: 'asset.js', source: '__rolldown_runtime__.registerModule("asset");' },
    ], ['feature/', 'independent'])
    expect([...runtime.initialChunkLoaders.keys()]).toEqual(['../../runtime/template.mjs'])
    expect(loads).toEqual([])
  })

  it('does not mutate outputs without the shared runtime', () => {
    const output = [chunk('vendor/facade.js', '__rolldown_runtime__.registerModule("facade");')]
    const before = structuredClone(output)
    registerStatefulHmrInitialChunkLoaders(output, [])
    expect(output).toEqual(before)
  })

  it('loads a shared native chunk on demand once and resolves all its module exports', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/facade.js', `
        __rolldown_runtime__.registerModule('first', { exports: { value: 1 } });
        __rolldown_runtime__.registerModule('second', { exports: { value: 2 } });
      `),
    ])
    expect(loads).toEqual([])
    expect(runtime.initialChunkLoaders.get('first')).toBe(runtime.initialChunkLoaders.get('second'))
    runtime.currentModuleId = 'page'
    expect(runtime.initModule('second')).toEqual({ value: 2 })
    expect(runtime.initModule('first')).toEqual({ value: 1 })
    expect(runtime.initModule('second')).toEqual({ value: 2 })
    expect(loads).toEqual(['./vendor/facade.js'])
    expect(runtime.currentModuleId).toBe('page')
  })

  it('prefers a new patch factory to the original native chunk', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/facade.js', '__rolldown_runtime__.registerModule("facade", { exports: "old" });'),
    ])
    runtime.registerFactory('facade', 'esm', (id) => {
      runtime.registerModule(id, { exports: 'updated' })
    })
    runtime.beginPatch()
    expect(runtime.initModule('facade')).toBe('updated')
    runtime.endPatch()
    expect(runtime.initModule('facade')).toBe('updated')
    expect(loads).toEqual([])
  })

  it('preserves modules already executed without loading their original chunk', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/facade.js', '__rolldown_runtime__.registerModule("facade", { exports: "old" });'),
    ])
    runtime.registerModule('facade', { exports: 'active' })
    expect(runtime.initModule('facade')).toBe('active')
    expect(loads).toEqual([])
  })

  it('rejects a native chunk that would overwrite a previously patched sibling module', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/facade.js', `
        __rolldown_runtime__.registerModule('changed', { exports: 'old' });
        __rolldown_runtime__.registerModule('sibling', { exports: 'sibling' });
      `),
    ])
    runtime.registerFactory('changed', 'esm', id => runtime.registerModule(id, { exports: 'updated' }))
    runtime.beginPatch()
    expect(runtime.initModule('changed')).toBe('updated')
    runtime.endPatch()
    expect(() => runtime.initModule('sibling')).toThrow('Initial HMR chunk contains updated modules: sibling')
    expect(runtime.initModule('changed')).toBe('updated')
    expect(loads).toEqual([])
  })

  it('rejects recursive native loading and resets loading and caller state after failure', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/cycle.js', `
        __rolldown_runtime__.initModule('second');
        __rolldown_runtime__.registerModule('first', { exports: 'first' });
        __rolldown_runtime__.registerModule('second', { exports: 'second' });
      `),
    ])
    runtime.currentModuleId = 'page'
    expect(() => runtime.initModule('first')).toThrow('Circular initial HMR chunk loading: second')
    expect(runtime.initialChunkLoaders.get('first')?.loading).toBe(false)
    expect(runtime.currentModuleId).toBe('page')
    expect(loads).toEqual(['./vendor/cycle.js'])
  })

  it('fails when a native chunk returns without registering the requested module', () => {
    const { runtime, loads } = createRuntime([
      chunk('vendor/facade.js', `if (false) __rolldown_runtime__.registerModule('facade', { exports: 'never' });`),
    ])
    expect(() => runtime.initModule('facade')).toThrow('No factory registered for module facade')
    expect(runtime.initialChunkLoaders.get('facade')?.loading).toBe(false)
    expect(loads).toEqual(['./vendor/facade.js'])
  })
})
