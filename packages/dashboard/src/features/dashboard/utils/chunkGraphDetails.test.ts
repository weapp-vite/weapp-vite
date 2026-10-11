import type { AnalyzeChunkGraphEdge, AnalyzeChunkGraphNode, AnalyzeChunkGraphView } from './analyzeChunkGraph'
import { describe, expect, it } from 'vitest'
import { createAnalyzeChunkGraph, createAnalyzeChunkGraphView } from './analyzeChunkGraph'
import { createChunkGraphDetails } from './chunkGraphDetails'

function createChunk(file: string, packageId = '__main__'): AnalyzeChunkGraphNode {
  return {
    id: `chunk:${file}`,
    kind: 'chunk',
    label: file,
    packageId,
    packageLabel: packageId,
    size: 100,
    moduleCount: 2,
  }
}

function createPackage(packageId: string): AnalyzeChunkGraphNode {
  return {
    id: `package:${packageId}`,
    kind: 'package',
    label: packageId,
    packageId,
    packageLabel: packageId,
    size: 200,
    fileCount: 2,
  }
}

function createView(nodes: AnalyzeChunkGraphNode[], edges: AnalyzeChunkGraphEdge[]): AnalyzeChunkGraphView {
  return { nodes, edges, truncatedNodeCount: 0, truncatedEdgeCount: 0 }
}

describe('chunk graph details', () => {
  it('preserves direction, edge identity, kind and full nodes across same-label packages', () => {
    const entry = { ...createChunk('app.js'), isEntry: true }
    const shared = { ...createChunk('common/shared.js'), label: 'shared.js' }
    const remote = { ...createChunk('pkg/shared.js', 'pkg'), label: 'shared.js' }
    const caller = createChunk('pkg/page.js', 'pkg')
    const view = createView([entry, shared, remote, caller], [
      { id: 'lazy-remote', kind: 'dynamic-import', source: entry.id, target: remote.id },
      { id: 'sync-shared', kind: 'static-import', source: entry.id, target: shared.id },
      { id: 'sync-remote', kind: 'static-import', source: entry.id, target: remote.id },
      { id: 'sync-caller', kind: 'static-import', source: caller.id, target: entry.id },
      { id: 'lazy-caller', kind: 'dynamic-import', source: shared.id, target: entry.id },
      { id: 'unrelated', kind: 'static-import', source: remote.id, target: caller.id },
    ])

    const details = createChunkGraphDetails(view, entry.id)

    expect(details.selected).toBe(entry)
    expect(details.outgoing).toEqual([
      { id: 'lazy-remote', kind: 'dynamic-import', node: remote },
      { id: 'sync-shared', kind: 'static-import', node: shared },
      { id: 'sync-remote', kind: 'static-import', node: remote },
    ])
    expect(details.incoming).toEqual([
      { id: 'sync-caller', kind: 'static-import', node: caller },
      { id: 'lazy-caller', kind: 'dynamic-import', node: shared },
    ])
    expect(details.outgoing[0]?.node).toBe(remote)
    expect(details.incoming[0]?.node).toBe(caller)
    expect(details.children).toEqual([])
    expect(createChunkGraphDetails(view, shared.id).selected).toBe(shared)
    expect(createChunkGraphDetails(view, remote.id).selected).toBe(remote)
    expect(createChunkGraphDetails(view, 'shared.js').selected).toBeNull()
  })

  it.each(['static-import', 'dynamic-import'] as const)('includes a %s self-import in both directions but counts it once', (kind) => {
    const node = createChunk('self.js')
    const view = createView([node], [{ id: 'self', kind, source: node.id, target: node.id }])
    const details = createChunkGraphDetails(view, node.id)

    expect(details.outgoing).toEqual([{ id: 'self', kind, node }])
    expect(details.incoming).toEqual([{ id: 'self', kind, node }])
    expect(details.staticImportCount).toBe(kind === 'static-import' ? 1 : 0)
    expect(details.dynamicImportCount).toBe(kind === 'dynamic-import' ? 1 : 0)
  })

  it('uses only outgoing package containment of visible chunks, never inferred membership or imports', () => {
    const parent = createPackage('__main__')
    const other = createPackage('pkg')
    const child = createChunk('child.js')
    const sibling = createChunk('sibling.js')
    const remote = createChunk('pkg/remote.js', 'pkg')
    const view = createView([parent, other, child, sibling, remote], [
      { id: 'member', kind: 'contains', source: parent.id, target: child.id },
      { id: 'other-member', kind: 'contains', source: other.id, target: remote.id },
      { id: 'package-target', kind: 'contains', source: parent.id, target: other.id },
      { id: 'reverse-membership', kind: 'contains', source: sibling.id, target: parent.id },
      { id: 'hidden-member', kind: 'contains', source: parent.id, target: 'chunk:hidden.js' },
      { id: 'child-import', kind: 'static-import', source: child.id, target: remote.id },
    ])

    expect(createChunkGraphDetails(view, parent.id)).toEqual({
      selected: parent,
      outgoing: [],
      incoming: [],
      children: [{ id: 'member', kind: 'contains', node: child }],
      staticImportCount: 1,
      dynamicImportCount: 0,
    })
    expect(createChunkGraphDetails(view, child.id)).toMatchObject({
      outgoing: [{ id: 'child-import', kind: 'static-import', node: remote }],
      incoming: [],
      children: [],
    })
    expect(createChunkGraphDetails(view, sibling.id).children).toEqual([])
  })

  it('omits missing import endpoints without substituting a same-label visible node', () => {
    const entry = createChunk('app.js')
    const visible = { ...createChunk('pkg/missing.js', 'pkg'), label: 'missing.js' }
    const view = createView([entry, visible], [
      { id: 'missing-target', kind: 'static-import', source: entry.id, target: 'chunk:missing.js' },
      { id: 'missing-source', kind: 'dynamic-import', source: 'chunk:missing.js', target: entry.id },
      { id: 'visible-target', kind: 'dynamic-import', source: entry.id, target: visible.id },
    ])

    expect(createChunkGraphDetails(view, entry.id)).toEqual({
      selected: entry,
      outgoing: [{ id: 'visible-target', kind: 'dynamic-import', node: visible }],
      incoming: [],
      children: [],
      staticImportCount: 1,
      dynamicImportCount: 2,
    })
  })

  it.each([null, 'chunk:removed.js', 'app.js'])('has no selected relations for absent or non-id selection %s', (selectedId) => {
    const entry = createChunk('app.js')
    const dependency = createChunk('shared.js')
    const view = createView([entry, dependency], [
      { id: 'import', kind: 'static-import', source: entry.id, target: dependency.id },
    ])

    expect(createChunkGraphDetails(view, selectedId)).toEqual({
      selected: null,
      outgoing: [],
      incoming: [],
      children: [],
      staticImportCount: 1,
      dynamicImportCount: 0,
    })
  })

  it.each([
    { query: '', packageId: 'all', maxNodes: 20, maxEdges: 20, staticCount: 2, dynamicCount: 2, selected: true },
    { query: 'app.js', packageId: 'all', maxNodes: 20, maxEdges: 20, staticCount: 1, dynamicCount: 1, selected: true },
    { query: '', packageId: '__main__', maxNodes: 20, maxEdges: 20, staticCount: 1, dynamicCount: 1, selected: true },
    { query: 'app.js', packageId: 'all', maxNodes: 2, maxEdges: 20, staticCount: 0, dynamicCount: 0, selected: true },
    { query: 'app.js', packageId: 'all', maxNodes: 20, maxEdges: 1, staticCount: 1, dynamicCount: 0, selected: true },
    { query: '', packageId: 'pkg', maxNodes: 20, maxEdges: 20, staticCount: 1, dynamicCount: 1, selected: false },
    { query: 'not-found', packageId: 'all', maxNodes: 20, maxEdges: 20, staticCount: 0, dynamicCount: 0, selected: false },
  ])('counts only the current view for $packageId/$query with budgets $maxNodes/$maxEdges', ({ staticCount, dynamicCount, selected, ...options }) => {
    const graph = createAnalyzeChunkGraph({
      packages: [
        {
          id: '__main__',
          label: '主包',
          type: 'main',
          files: [
            { file: 'app.js', type: 'chunk', from: 'main', size: 300, imports: ['./shared.js'], dynamicImports: ['./lazy.js'] },
            { file: 'shared.js', type: 'chunk', from: 'main', size: 200 },
            { file: 'lazy.js', type: 'chunk', from: 'main', size: 100 },
          ],
        },
        {
          id: 'pkg',
          label: '分包 pkg',
          type: 'subPackage',
          files: [
            { file: 'pkg/entry.js', type: 'chunk', from: 'main', size: 50, imports: ['./dependency.js'], dynamicImports: ['./dependency.js'] },
            { file: 'pkg/dependency.js', type: 'chunk', from: 'main', size: 40 },
          ],
        },
      ],
      modules: [],
      subPackages: [{ root: 'pkg', independent: false }],
    })
    const view = createAnalyzeChunkGraphView(graph, options)
    const details = createChunkGraphDetails(view, 'chunk:app.js')
    const unselected = createChunkGraphDetails(view, null)

    expect(details.staticImportCount).toBe(staticCount)
    expect(details.dynamicImportCount).toBe(dynamicCount)
    expect(unselected.staticImportCount).toBe(staticCount)
    expect(unselected.dynamicImportCount).toBe(dynamicCount)
    expect(details.selected?.id ?? null).toBe(selected ? 'chunk:app.js' : null)
    if (!selected) {
      expect(details.outgoing).toEqual([])
      expect(details.incoming).toEqual([])
      expect(details.children).toEqual([])
    }
  })

  it('drops stale relations and uses current node facts after report replacement', () => {
    const previous = createChunk('app.js')
    const dependency = createChunk('shared.js')
    const previousView = createView([previous, dependency], [
      { id: 'old-import', kind: 'static-import', source: previous.id, target: dependency.id },
    ])
    expect(createChunkGraphDetails(previousView, previous.id).outgoing).toHaveLength(1)

    const replacement = { ...previous, size: 900, moduleCount: 7 }
    const next = createChunkGraphDetails(createView([replacement], []), previous.id)
    expect(next.selected).toBe(replacement)
    expect(next.outgoing).toEqual([])
    expect(next.staticImportCount).toBe(0)
    expect(createChunkGraphDetails(createView([], []), previous.id)).toEqual({
      selected: null,
      outgoing: [],
      incoming: [],
      children: [],
      staticImportCount: 0,
      dynamicImportCount: 0,
    })
  })

  it('preserves input objects, arrays and their ordering when deriving details', () => {
    const parent = createPackage('__main__')
    const entry = createChunk('z-entry.js')
    const dependency = createChunk('a-dependency.js')
    const view = createView([entry, dependency, parent], [
      { id: 'z-import', kind: 'dynamic-import', source: entry.id, target: dependency.id },
      { id: 'z-child', kind: 'contains', source: parent.id, target: entry.id },
      { id: 'a-import', kind: 'static-import', source: entry.id, target: dependency.id },
      { id: 'a-child', kind: 'contains', source: parent.id, target: dependency.id },
    ])
    const before = structuredClone(view)
    view.nodes.forEach(node => Object.freeze(node))
    view.edges.forEach(edge => Object.freeze(edge))
    Object.freeze(view.nodes)
    Object.freeze(view.edges)
    Object.freeze(view)

    const details = createChunkGraphDetails(view, entry.id)
    const packageDetails = createChunkGraphDetails(view, parent.id)

    expect(details.outgoing.map(relation => relation.id)).toEqual(['z-import', 'a-import'])
    expect(packageDetails.children.map(relation => relation.id)).toEqual(['z-child', 'a-child'])
    expect(details.selected).toBe(entry)
    expect(packageDetails.children[0]?.node).toBe(entry)
    expect(view).toEqual(before)
  })
})
