import { parseLogicalEntryId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { normalizeSourceId } from '../../moduleGraph/traversal'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { getNativeComponentSidecarSource } from './nativeComponentSidecar'

export function isStatefulHmrBoundary(id: string, srcRoot: string, entryIds?: Iterable<string>, delegatedComponentEntryIds: ReadonlySet<string> = new Set()): boolean {
  const logicalEntry = parseLogicalEntryId(id)
  if (logicalEntry) {
    return logicalEntry.type === 'component'
      && delegatedComponentEntryIds.has(normalizeFsResolvedId(logicalEntry.sourceId))
      && isStatefulHmrBoundary(logicalEntry.sourceId, srcRoot, entryIds)
  }
  const sidecar = parseSidecarSourceRequest(id)
  // 组件源码仅导出 options 时，更新必须继续传播到实际执行注册的 logical entry。
  if (!sidecar && delegatedComponentEntryIds.has(normalizeFsResolvedId(id))) {
    return false
  }
  const nativeComponentSource = sidecar?.kind === 'script'
    ? undefined
    : getNativeComponentSidecarSource(id, srcRoot, entryIds)
  const sourceId = sidecar?.kind === 'script'
    ? sidecar.sourceId
    : nativeComponentSource ?? (id.includes('?') ? undefined : id)
  if (!sourceId) {
    return false
  }
  // 原生组件摘要已解析物理路径，根目录和入口也必须使用同一身份；普通模块保持原有快路径。
  const normalizeBoundaryId = nativeComponentSource ? normalizeSourceId : normalizeFsResolvedId
  const normalizedSourceId = nativeComponentSource ?? normalizeFsResolvedId(sourceId)
  const normalizedSrcRoot = normalizeBoundaryId(srcRoot).replace(/\/$/, '')
  if (
    !normalizedSourceId.startsWith(`${normalizedSrcRoot}/`)
    || !/\.(?:[cm]?[jt]sx?|vue)$/.test(normalizedSourceId)
  ) {
    return false
  }
  if (!entryIds) {
    return true
  }
  for (const entryId of entryIds) {
    if (normalizeBoundaryId(entryId) === normalizedSourceId) {
      return true
    }
  }
  return false
}
