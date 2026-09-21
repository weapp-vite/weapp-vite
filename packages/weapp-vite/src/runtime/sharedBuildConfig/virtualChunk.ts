import { createHash } from 'node:crypto'
import path from 'pathe'
import { parseLogicalEntryId, parseSidecarModuleId } from '../../moduleGraph/protocol'

/** 虚拟模块的完整路径只作为标识参与散列，避免泄漏到文件名并超过文件系统长度限制。 */
export function resolveVirtualChunkFileName(
  chunk: { facadeModuleId?: string | null, moduleIds?: readonly string[] },
  root: string,
) {
  const ids = chunk.facadeModuleId ? [chunk.facadeModuleId] : chunk.moduleIds ?? []
  if (ids.length !== 1) {
    return undefined
  }
  const id = ids[0]!
  const entry = parseLogicalEntryId(id)
  const sidecar = parseSidecarModuleId(id)
  const identity = entry
    ? ['entry', entry.type, path.relative(root, entry.sourceId)]
    : sidecar
      ? ['sidecar', sidecar.kind, path.relative(root, sidecar.ownerId), path.relative(root, sidecar.sourceId)]
      : undefined
  if (!identity) {
    return undefined
  }
  const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 16)
  return `weapp-${identity[0]}-${identity[1]}-${hash}.js`
}
