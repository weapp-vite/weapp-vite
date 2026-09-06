import type { AnalyzeSubpackagesResult } from '../types'
import type { AnalyzeChunkGraphModel } from './analyzeChunkGraph'
import { describe, expect, it } from 'vitest'
import { createAnalyzeChunkGraph, createAnalyzeChunkGraphView } from './analyzeChunkGraph'

function createResult(): AnalyzeSubpackagesResult {
  return {
    packages: [
      {
        id: '__main__',
        label: '主包',
        type: 'main',
        files: [
          {
            file: 'app.js',
            type: 'chunk',
            from: 'main',
            size: 120,
            isEntry: true,
            imports: ['./shared.js', './missing.js'],
            dynamicImports: ['./lazy.js'],
            modules: [],
          },
          {
            file: 'shared.js',
            type: 'chunk',
            from: 'main',
            size: 80,
            modules: [],
          },
          {
            file: 'lazy.js',
            type: 'chunk',
            from: 'main',
            size: 60,
            modules: [],
          },
        ],
      },
      {
        id: 'pkg',
        label: '分包 pkg',
        type: 'subPackage',
        files: [
          {
            file: 'pkg/page.js',
            type: 'chunk',
            from: 'main',
            size: 40,
            imports: ['../shared.js'],
            modules: [],
          },
        ],
      },
    ],
    modules: [],
    subPackages: [{ root: 'pkg', independent: false }],
  }
}

describe('analyze chunk graph', () => {
  it('builds package containment and static/dynamic chunk edges', () => {
    const graph = createAnalyzeChunkGraph(createResult())

    expect(graph.nodes).toHaveLength(6)
    expect(graph.edges.filter(edge => edge.kind === 'contains')).toHaveLength(4)
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'chunk:app.js', target: 'chunk:shared.js', kind: 'static-import' }),
      expect.objectContaining({ source: 'chunk:pkg/page.js', target: 'chunk:shared.js', kind: 'static-import' }),
      expect.objectContaining({ source: 'chunk:app.js', target: 'chunk:lazy.js', kind: 'dynamic-import' }),
    ]))
    expect(graph.staticImportCount).toBe(2)
    expect(graph.dynamicImportCount).toBe(1)
    expect(graph.unresolvedImportCount).toBe(1)
  })

  it('filters by search while retaining directly connected chunks', () => {
    const view = createAnalyzeChunkGraphView(createAnalyzeChunkGraph(createResult()), {
      maxEdges: 20,
      maxNodes: 20,
      packageId: 'all',
      query: 'lazy',
    })

    expect(view.nodes.map(node => node.id)).toEqual(expect.arrayContaining([
      'package:__main__',
      'chunk:app.js',
      'chunk:lazy.js',
    ]))
  })

  it.each([
    { packageCount: 80, maxNodes: 80, packageId: 'all', query: 'pkg-0/entry.js', visiblePackages: 1, truncatedNodes: 0 },
    { packageCount: 80, maxNodes: 80, packageId: 'pkg-0', query: 'pkg-0/entry.js', visiblePackages: 1, truncatedNodes: 0 },
    { packageCount: 221, maxNodes: 220, packageId: 'all', query: '', visiblePackages: 110, truncatedNodes: 222 },
  ])('budgets only displayed packages with $packageCount packages and filter $packageId/$query', ({
    packageCount,
    maxNodes,
    packageId,
    query,
    visiblePackages,
    truncatedNodes,
  }) => {
    const result: AnalyzeSubpackagesResult = {
      packages: Array.from({ length: packageCount }, (_, index) => ({
        id: `pkg-${index}`,
        label: `pkg-${index}`,
        type: 'subPackage',
        files: [{
          file: `pkg-${index}/entry.js`,
          type: 'chunk',
          from: 'main',
          size: packageCount - index,
        }],
      })),
      modules: [],
      subPackages: [],
    }
    const view = createAnalyzeChunkGraphView(createAnalyzeChunkGraph(result), {
      maxEdges: 900,
      maxNodes,
      packageId,
      query,
    })
    const visibleIds = Array.from({ length: visiblePackages }, (_, index) => `pkg-${index}`)

    expect(view.nodes.map(node => node.id)).toEqual([
      ...visibleIds.map(id => `package:${id}`),
      ...visibleIds.map(id => `chunk:${id}/entry.js`),
    ])
    expect(view.edges).toEqual(visibleIds.map(id => ({
      id: `package:${id}->chunk:${id}/entry.js:contains`,
      kind: 'contains',
      source: `package:${id}`,
      target: `chunk:${id}/entry.js`,
    })))
    expect(view.nodes.length).toBeLessThanOrEqual(maxNodes)
    expect(view.truncatedNodeCount).toBe(truncatedNodes)
    expect(view.truncatedEdgeCount).toBe(truncatedNodes / 2)
  })

  it('prioritizes matching chunks over larger neighbors when only the match and package fit', () => {
    const view = createAnalyzeChunkGraphView(createAnalyzeChunkGraph(createResult()), {
      maxEdges: 20,
      maxNodes: 2,
      packageId: 'all',
      query: 'lazy',
    })

    expect(view.nodes.map(node => node.id)).toEqual(['package:__main__', 'chunk:lazy.js'])
    expect(view.edges).toEqual([{
      id: 'package:__main__->chunk:lazy.js:contains',
      kind: 'contains',
      source: 'package:__main__',
      target: 'chunk:lazy.js',
    }])
    expect(view.truncatedNodeCount).toBe(1)
    expect(view.truncatedEdgeCount).toBe(2)
  })

  it('uses remaining capacity for an existing package when another package cannot fit', () => {
    const result = createResult()
    result.packages[1]!.files[0]!.size = 100
    const view = createAnalyzeChunkGraphView(createAnalyzeChunkGraph(result), {
      maxEdges: 20,
      maxNodes: 3,
      packageId: 'all',
      query: '',
    })

    expect(view.nodes.map(node => node.id)).toEqual([
      'package:__main__',
      'chunk:app.js',
      'chunk:shared.js',
    ])
    expect(view.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'chunk:app.js', target: 'chunk:shared.js', kind: 'static-import' }),
    ]))
    expect(view.truncatedNodeCount).toBe(3)
  })

  it('expands only direct neighbors independent of edge order', () => {
    const nodes = ['a', 'b', 'c'].map((name, index) => ({
      id: `chunk:${name}.js`,
      kind: 'chunk' as const,
      label: `${name}.js`,
      packageId: '__main__',
      packageLabel: '主包',
      size: 3 - index,
    }))
    const edges = [
      { id: 'a-b', kind: 'static-import' as const, source: 'chunk:a.js', target: 'chunk:b.js' },
      { id: 'b-c', kind: 'static-import' as const, source: 'chunk:b.js', target: 'chunk:c.js' },
    ]
    const options = {
      maxEdges: 10,
      maxNodes: 10,
      packageId: 'all',
      query: 'a.js',
    }
    const base = {
      dynamicImportCount: 0,
      staticImportCount: 2,
      unresolvedImportCount: 0,
      nodes,
    }
    const forward = createAnalyzeChunkGraphView({ ...base, edges }, options)
    const reversed = createAnalyzeChunkGraphView({ ...base, edges: [...edges].reverse() }, options)

    expect(forward.nodes.map(node => node.id)).toEqual(['chunk:a.js', 'chunk:b.js'])
    expect(reversed.nodes.map(node => node.id)).toEqual(['chunk:a.js', 'chunk:b.js'])
  })

  it('enforces final node and edge budgets after expanding neighbors', () => {
    const chunks = Array.from({ length: 300 }, (_, index) => ({
      id: `chunk:chunk-${index}.js`,
      kind: 'chunk' as const,
      label: `chunk-${index}.js`,
      packageId: '__main__',
      packageLabel: '主包',
      size: 300 - index,
    }))
    const graph: AnalyzeChunkGraphModel = {
      dynamicImportCount: 0,
      staticImportCount: 299,
      unresolvedImportCount: 0,
      nodes: [
        {
          id: 'package:__main__',
          kind: 'package',
          label: '主包',
          packageId: '__main__',
          packageLabel: '主包',
          size: 45_000,
          fileCount: 300,
        },
        ...chunks,
      ],
      edges: [
        ...chunks.map(node => ({
          id: `package:__main__->${node.id}:contains`,
          kind: 'contains' as const,
          source: 'package:__main__',
          target: node.id,
        })),
        ...chunks.slice(1).map(node => ({
          id: `chunk:chunk-0.js->${node.id}:static-import`,
          kind: 'static-import' as const,
          source: 'chunk:chunk-0.js',
          target: node.id,
        })),
      ],
    }
    const view = createAnalyzeChunkGraphView(graph, {
      maxEdges: 100,
      maxNodes: 220,
      packageId: 'all',
      query: '',
    })

    expect(view.nodes.length).toBeLessThanOrEqual(220)
    expect(view.edges.length).toBeLessThanOrEqual(100)
    expect(view.truncatedNodeCount).toBe(81)
    expect(view.truncatedEdgeCount).toBe(499)
  })
})
