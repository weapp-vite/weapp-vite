import type { AnalyzeChunkGraphView } from './analyzeChunkGraph'
import { describe, expect, it } from 'vitest'
import { createChunkGraphFocus } from './chunkGraphFocus'

function createView(): AnalyzeChunkGraphView {
  return {
    nodes: ['package:main', 'entry.js', 'shared.js', 'caller.js', 'deep.js', 'isolated.js'].map(id => ({
      id,
      kind: id.startsWith('package:') ? 'package' : 'chunk',
      label: id,
      packageId: 'main',
      packageLabel: '主包',
      size: 100,
    })),
    edges: [
      { id: 'entry-member', kind: 'contains', source: 'package:main', target: 'entry.js' },
      { id: 'shared-member', kind: 'contains', source: 'package:main', target: 'shared.js' },
      { id: 'outgoing', kind: 'static-import', source: 'entry.js', target: 'shared.js' },
      { id: 'lazy', kind: 'dynamic-import', source: 'entry.js', target: 'shared.js' },
      { id: 'incoming', kind: 'static-import', source: 'caller.js', target: 'entry.js' },
      { id: 'second-hop', kind: 'static-import', source: 'shared.js', target: 'deep.js' },
    ],
    truncatedNodeCount: 0,
    truncatedEdgeCount: 0,
  }
}

describe('chunk graph focus', () => {
  it('includes both import directions and membership but not second-hop or unrelated nodes', () => {
    expect(createChunkGraphFocus(createView(), 'entry.js', null)).toEqual({
      nodeIds: new Set(['entry.js', 'shared.js', 'caller.js', 'package:main']),
      edgeIds: new Set(['entry-member', 'outgoing', 'lazy', 'incoming']),
      previewEdgeId: null,
    })
  })

  it('focuses package membership without expanding the imports of its children', () => {
    expect(createChunkGraphFocus(createView(), 'package:main', null)).toEqual({
      nodeIds: new Set(['package:main', 'entry.js', 'shared.js']),
      edgeIds: new Set(['entry-member', 'shared-member']),
      previewEdgeId: null,
    })
  })

  it('isolates the exact previewed relation, not every edge sharing its endpoints', () => {
    expect(createChunkGraphFocus(createView(), 'entry.js', 'lazy')).toEqual({
      nodeIds: new Set(['entry.js', 'shared.js']),
      edgeIds: new Set(['lazy']),
      previewEdgeId: 'lazy',
    })
    expect(createChunkGraphFocus(createView(), 'entry.js', 'incoming')).toEqual({
      nodeIds: new Set(['caller.js', 'entry.js']),
      edgeIds: new Set(['incoming']),
      previewEdgeId: 'incoming',
    })
  })

  it('restores one-hop focus after preview and ignores removed or unrelated relations', () => {
    const view = createView()
    const selected = createChunkGraphFocus(view, 'entry.js', null)
    expect(createChunkGraphFocus(view, 'entry.js', 'second-hop')).toEqual(selected)
    view.edges = view.edges.filter(edge => edge.id !== 'lazy')
    expect(createChunkGraphFocus(view, 'entry.js', 'lazy')).toEqual({
      ...selected,
      edgeIds: new Set(['entry-member', 'outgoing', 'incoming']),
    })
  })

  it('clears preview when selection is cleared or removed, even if the edge still exists', () => {
    const view = createView()
    expect(createChunkGraphFocus(view, null, 'second-hop')).toEqual({ nodeIds: null, edgeIds: null, previewEdgeId: null })
    expect(createChunkGraphFocus(view, 'removed.js', 'outgoing')).toEqual({ nodeIds: null, edgeIds: null, previewEdgeId: null })
  })

  it('keeps an isolated selection visible without borrowing relationships from its package', () => {
    expect(createChunkGraphFocus(createView(), 'isolated.js', null)).toEqual({
      nodeIds: new Set(['isolated.js']),
      edgeIds: new Set(),
      previewEdgeId: null,
    })
  })
})
