import type { AnalyzeChunkGraphEdgeKind, AnalyzeChunkGraphNode, AnalyzeChunkGraphView } from './analyzeChunkGraph'

export interface ChunkGraphRelation {
  id: string
  kind: AnalyzeChunkGraphEdgeKind
  node: AnalyzeChunkGraphNode
}

export interface ChunkGraphDetails {
  selected: AnalyzeChunkGraphNode | null
  outgoing: ChunkGraphRelation[]
  incoming: ChunkGraphRelation[]
  children: ChunkGraphRelation[]
  staticImportCount: number
  dynamicImportCount: number
}

/** 从当前可见图派生节点详情，保留原始节点、边标识与方向。 */
export function createChunkGraphDetails(view: AnalyzeChunkGraphView, selectedId: string | null): ChunkGraphDetails {
  const nodesById = new Map<string, AnalyzeChunkGraphNode>()
  for (const node of view.nodes) {
    nodesById.set(node.id, node)
  }
  const selected = selectedId === null ? null : nodesById.get(selectedId) ?? null
  const details: ChunkGraphDetails = {
    selected,
    outgoing: [],
    incoming: [],
    children: [],
    staticImportCount: 0,
    dynamicImportCount: 0,
  }

  for (const edge of view.edges) {
    if (edge.kind === 'contains') {
      if (selected?.kind === 'package' && edge.source === selected.id) {
        const node = nodesById.get(edge.target)
        if (node?.kind === 'chunk') {
          details.children.push({ id: edge.id, kind: edge.kind, node })
        }
      }
      continue
    }

    if (edge.kind === 'static-import') {
      details.staticImportCount += 1
    }
    else {
      details.dynamicImportCount += 1
    }

    if (!selected) {
      continue
    }
    if (edge.source === selected.id) {
      const node = nodesById.get(edge.target)
      if (node) {
        details.outgoing.push({ id: edge.id, kind: edge.kind, node })
      }
    }
    if (edge.target === selected.id) {
      const node = nodesById.get(edge.source)
      if (node) {
        details.incoming.push({ id: edge.id, kind: edge.kind, node })
      }
    }
  }

  return details
}
