import { parseLogicalEntryId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
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
  const sourceId = sidecar?.kind === 'script'
    ? sidecar.sourceId
    : getNativeComponentSidecarSource(id, srcRoot, entryIds) ?? (id.includes('?') ? undefined : id)
  if (!sourceId) {
    return false
  }
  const normalizedSourceId = normalizeFsResolvedId(sourceId)
  const normalizedSrcRoot = normalizeFsResolvedId(srcRoot).replace(/\/$/, '')
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
    if (normalizeFsResolvedId(entryId) === normalizedSourceId) {
      return true
    }
  }
  return false
}
