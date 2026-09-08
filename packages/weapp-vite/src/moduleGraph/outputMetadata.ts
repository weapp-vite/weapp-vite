import {
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
} from '@weapp-core/constants'
import path from 'pathe'
import { parseLogicalEntryId, parseSidecarModuleId } from './protocol'

const GRAPH_OUTPUT_MARKERS = [
  WEAPP_VITE_LOGICAL_ENTRY_RESOLVED_PREFIX,
  WEAPP_VITE_SIDECAR_RESOLVED_PREFIX,
]

/** 从 Vite 资产来源或图资产文件名恢复模块协议，避免把虚拟入口当作磁盘路径。 */
export function parseGraphOutputModuleId(fileName: string) {
  for (const marker of GRAPH_OUTPUT_MARKERS) {
    const markerIndex = fileName.indexOf(marker)
    if (markerIndex < 0) {
      continue
    }
    const request = fileName.slice(markerIndex)
    const extension = path.extname(request)
    const moduleId = `${extension ? request.slice(0, -extension.length) : request}.js`
    if (parseLogicalEntryId(moduleId) || parseSidecarModuleId(moduleId)) {
      return moduleId
    }
  }
}

/** 资产元数据可以带相对或跨盘绝对前缀，实际输出归属始终由图协议的物理 owner 决定。 */
export function resolveGraphOutputOwner(fileName: string) {
  const moduleId = parseGraphOutputModuleId(fileName)
  return moduleId
    ? parseLogicalEntryId(moduleId)?.sourceId ?? parseSidecarModuleId(moduleId)?.ownerId
    : undefined
}
