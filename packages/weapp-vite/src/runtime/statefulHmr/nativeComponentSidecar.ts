import path from 'pathe'
import { parseSidecarModuleId, parseSidecarSourceRequest } from '../../moduleGraph/protocol'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export function getNativeComponentSidecarSource(id: string, root: string, entryIds?: Iterable<string>): string | undefined {
  const sidecar = parseSidecarSourceRequest(id) ?? parseSidecarModuleId(id)
  if (sidecar?.kind !== 'using-component' || !entryIds || !/\.[cm]?[jt]s$/.test(sidecar.sourceId)) {
    return
  }
  const sourceId = normalizeFsResolvedId(path.resolve(root, sidecar.sourceId))
  // 只有真实脚本已作为独立入口接受更新时，父页面的纯依赖摘要才能独立接受更新。
  for (const entryId of entryIds) {
    if (normalizeFsResolvedId(path.resolve(root, entryId)) === sourceId) {
      return sourceId
    }
  }
}

export function isChangedNativeComponentSidecar(
  id: string,
  files: string[],
  options: { root?: string, srcRoot?: string, entryIds?: Iterable<string> },
): boolean {
  const root = options.root
  if (!root) {
    return false
  }
  const sourceId = getNativeComponentSidecarSource(id, root, options.entryIds)
  const srcRoot = normalizeFsResolvedId(options.srcRoot ?? root).replace(/\/$/, '')
  return sourceId !== undefined
    && sourceId.startsWith(`${srcRoot}/`)
    && files.some(file => normalizeFsResolvedId(path.resolve(root, file)) === sourceId)
}
