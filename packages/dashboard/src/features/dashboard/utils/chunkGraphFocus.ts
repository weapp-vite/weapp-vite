import type { AnalyzeChunkGraphView } from './analyzeChunkGraph'

export interface ChunkGraphFocus {
  nodeIds: Set<string> | null
  edgeIds: Set<string> | null
  previewEdgeId: string | null
}

/** 仅突出当前视图的一跳关系；预览单条关系时保留其精确标识与两个端点。 */
export function createChunkGraphFocus(
  view: AnalyzeChunkGraphView,
  selectedId: string | null,
  previewEdgeId: string | null,
): ChunkGraphFocus {
  const selected = view.nodes.some(node => node.id === selectedId) ? selectedId : null
  if (selected === null) {
    return { nodeIds: null, edgeIds: null, previewEdgeId: null }
  }
  const preview = previewEdgeId === null
    ? undefined
    : view.edges.find(edge => edge.id === previewEdgeId
      && (edge.source === selected || edge.target === selected))

  if (preview) {
    return {
      nodeIds: new Set([preview.source, preview.target]),
      edgeIds: new Set([preview.id]),
      previewEdgeId: preview.id,
    }
  }

  const nodeIds = new Set([selected])
  const edgeIds = new Set<string>()
  for (const edge of view.edges) {
    if (edge.source === selected || edge.target === selected) {
      nodeIds.add(edge.source)
      nodeIds.add(edge.target)
      edgeIds.add(edge.id)
    }
  }
  return { nodeIds, edgeIds, previewEdgeId: null }
}
