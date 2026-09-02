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
    expect(view.truncatedNodeCount).toBeGreaterThan(0)
    expect(view.truncatedEdgeCount).toBeGreaterThan(0)
  })
})
