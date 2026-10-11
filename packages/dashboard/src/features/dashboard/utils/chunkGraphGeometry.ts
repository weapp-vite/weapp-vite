export const CHUNK_GRAPH_ARROW_SIZE = 7

interface CircleGeometry {
  x?: number
  y?: number
  radius: number
  strokeWidth: number
}

export interface ChunkGraphLinkGeometry {
  x1: number
  y1: number
  x2: number
  y2: number
  visible: boolean
}

/** 原位更新连线端点，避开节点描边，并为完整箭头保留空间。 */
export function updateChunkGraphLinkGeometry(
  link: ChunkGraphLinkGeometry,
  source: CircleGeometry,
  target: CircleGeometry,
  directed: boolean,
): void {
  const sourceX = source.x ?? 0
  const sourceY = source.y ?? 0
  const targetX = target.x ?? 0
  const targetY = target.y ?? 0
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const distance = Math.hypot(dx, dy)
  const sourceInset = source.radius + source.strokeWidth / 2 + 2
  const targetInset = target.radius + target.strokeWidth / 2 + 2
  link.visible = Number.isFinite(distance)
    && distance > sourceInset + targetInset + (directed ? CHUNK_GRAPH_ARROW_SIZE : 0)
  if (!link.visible) {
    return
  }

  const ux = dx / distance
  const uy = dy / distance
  link.x1 = sourceX + ux * sourceInset
  link.y1 = sourceY + uy * sourceInset
  link.x2 = targetX - ux * targetInset
  link.y2 = targetY - uy * targetInset
}
