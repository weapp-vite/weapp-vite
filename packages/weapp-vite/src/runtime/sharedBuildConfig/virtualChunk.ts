import { createHash } from 'node:crypto'
import path from 'pathe'
import { parseLogicalEntryId, parseSidecarModuleId } from '../../moduleGraph/protocol'

function virtualIdentity(id: string, root: string) {
  const entry = parseLogicalEntryId(id)
  const sidecar = parseSidecarModuleId(id)
  return entry
    ? ['entry', entry.type, path.relative(root, entry.sourceId)]
    : sidecar
      ? ['sidecar', sidecar.kind, path.relative(root, sidecar.ownerId), path.relative(root, sidecar.sourceId)]
      : undefined
}

/** 按逻辑 owner 命名实现 chunk，物理源码和 sidecar 合并后仍不把绝对路径写进文件名。 */
export function resolveVirtualChunkFileName(
  chunk: { facadeModuleId?: string | null, moduleIds?: readonly string[] },
  root: string,
) {
  const facade = chunk.facadeModuleId ? virtualIdentity(chunk.facadeModuleId, root) : undefined
  const identities = facade
    ? [facade]
    : (chunk.moduleIds ?? []).flatMap((id) => {
        const identity = virtualIdentity(id, root)
        return identity ? [identity] : []
      })
  const entries = identities.filter(identity => identity[0] === 'entry')
  const owners = [...new Set((entries.length ? entries : identities).map(identity => JSON.stringify(identity)))].sort()
  if (!owners.length) {
    return undefined
  }
  const first = JSON.parse(owners[0]!) as string[]
  const identity = owners.length === 1 ? first : owners.map(owner => JSON.parse(owner) as string[])
  const kind = owners.length === 1 ? `${first[0]}-${first[1]}` : 'graph'
  const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 16)
  return `weapp-${kind}-${hash}.js`
}
