import { createContext, runInContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'

interface PreparedUpdate {
  updateSet: string[]
  boundaries: Array<{ boundary: string, acceptedVia: string }>
}
interface Runtime {
  contexts: Map<string, { data: object }>
  registerGraph: (graph: { ids: string[], localCount: number, edges: number[][], dynamicEdges: number[][] }) => void
  registerFactory: (id: string, kind: string, factory: (id: string) => void) => void
  registerModule: (id: string, module: { exports: unknown }) => void
  createModuleHotContext: (id: string) => { data: object, accept: (...args: unknown[]) => void }
  initModule: (id: string) => void
  isExecuted: (id: string) => boolean
  loadExports: (id: string) => unknown
  prepareUpdate: (ids: string[]) => PreparedUpdate
  applyPreparedUpdate: (update: PreparedUpdate) => void
}

function fixture(edges: Record<string, string[]>) {
  const context = createContext({ console })
  runInContext(createStatefulHmrRolldownRuntimeSource(), context)
  const runtime = context.__rolldown_runtime__ as Runtime
  const graph = (next: Record<string, string[]>) => {
    const ids = [...new Set([...Object.keys(next), ...Object.values(next).flat()])]
    runtime.registerGraph({ ids, localCount: ids.length, edges: ids.map(id => (next[id] ?? []).map(dep => ids.indexOf(dep))), dynamicEdges: ids.map(() => []) })
  }
  graph(edges)
  const register = (id: string, value: unknown, accept?: (hot: ReturnType<Runtime['createModuleHotContext']>) => void) => {
    runtime.registerFactory(id, 'esm', (moduleId) => {
      runtime.registerModule(moduleId, { exports: value })
      accept?.(runtime.createModuleHotContext(moduleId))
    })
  }
  return { runtime, graph, register }
}

describe('stateful HMR executed importer propagation', () => {
  it('uses the old graph and old callback even when the payload replaces both', () => {
    const { runtime, graph, register } = fixture({ owner: ['source'], source: [] })
    const previous = vi.fn()
    register('source', 1)
    register('owner', 'old', hot => hot.accept(previous))
    runtime.initModule('source')
    runtime.initModule('owner')
    const data = runtime.contexts.get('owner')!.data
    const prepared = runtime.prepareUpdate(['source'])
    graph({ owner: [], source: [] })
    register('source', 2)
    register('owner', 'new', hot => hot.accept(vi.fn()))
    runtime.applyPreparedUpdate(prepared)
    expect(runtime.loadExports('owner')).toBe('new')
    expect(previous).toHaveBeenCalledExactlyOnceWith('new')
    expect(runtime.contexts.get('owner')!.data).toBe(data)
  })

  it('keeps a dependency-accepting importer cached and provides the new dependency', () => {
    const { runtime, register } = fixture({ owner: ['source'], source: [] })
    const accepted = vi.fn()
    register('source', 1)
    register('owner', 'held', hot => hot.accept('source', accepted))
    runtime.initModule('source')
    runtime.initModule('owner')
    const prepared = runtime.prepareUpdate(['source', 'source'])
    expect(prepared.updateSet).toEqual(['source'])
    register('source', 2)
    runtime.applyPreparedUpdate(prepared)
    expect(runtime.loadExports('owner')).toBe('held')
    expect(accepted).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('updates every executed owner while ignoring unexecuted importers', () => {
    const { runtime, register } = fixture({ left: ['source'], right: ['source'], lazy: ['source'], source: [] })
    register('source', 1)
    for (const id of ['left', 'right']) {
      register(id, id, hot => hot.accept())
      runtime.initModule(id)
    }
    runtime.initModule('source')
    const prepared = runtime.prepareUpdate(['source'])
    expect(prepared.updateSet.sort()).toEqual(['left', 'right', 'source'])
    expect(prepared.boundaries.map(item => item.boundary).sort()).toEqual(['left', 'right'])
  })

  it('rejects missing factories before evicting any executed module', () => {
    const { runtime, register } = fixture({ owner: ['source'], source: [] })
    runtime.registerModule('source', { exports: 1 })
    register('owner', 'held', hot => hot.accept())
    runtime.initModule('owner')
    const prepared = runtime.prepareUpdate(['source'])
    expect(() => runtime.applyPreparedUpdate(prepared)).toThrow('missing factories: source')
    expect(runtime.isExecuted('source')).toBe(true)
    expect(runtime.isExecuted('owner')).toBe(true)
  })

  it('rejects executed roots and closed cycles without accepting boundaries', () => {
    for (const edges of [{ source: [] }, { source: ['owner'], owner: ['source'] }]) {
      const { runtime, register } = fixture(edges)
      for (const id of Object.keys(edges)) {
        register(id, id)
        runtime.initModule(id)
      }
      expect(() => runtime.prepareUpdate(['source'])).toThrow(/no accepting (importer|boundary)/)
    }
  })

  it('does not execute a changed module that was never loaded', () => {
    const { runtime, register } = fixture({ source: [] })
    register('source', 1)
    const prepared = runtime.prepareUpdate(['source'])
    runtime.applyPreparedUpdate(prepared)
    expect(prepared.updateSet).toEqual([])
    expect(runtime.isExecuted('source')).toBe(false)
  })
})
