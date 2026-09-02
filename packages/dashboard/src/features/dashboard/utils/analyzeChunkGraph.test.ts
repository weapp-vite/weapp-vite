import type { AnalyzeSubpackagesResult } from '../types'
import { describe, expect, it } from 'vitest'
import { createAnalyzeChunkGraph } from './analyzeChunkGraph'

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
})
