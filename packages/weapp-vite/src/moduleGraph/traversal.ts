import type { BuildGraphContext, DevModuleNode, DevServerGraphHost } from './types'
import { realpathSync } from 'node:fs'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from './protocol'

export function normalizeSourceId(id: string) {
  const normalized = normalizeFsResolvedId(id).split('?')[0]!
  try {
    return normalizeFsResolvedId(realpathSync.native(normalized))
  }
  catch {
    return normalized
  }
}

/** 逻辑入口与源码按同一真实路径比较，避免 junction 或原生分隔符制造第二个输出归属。 */
export function isLogicalEntrySource(id: string, importers: Iterable<string> = []) {
  let normalizedSource: string | undefined
  for (const importer of importers) {
    const logicalEntry = parseLogicalEntryId(importer)
    if (!logicalEntry) {
      continue
    }
    normalizedSource ??= normalizeSourceId(id)
    if (logicalEntry.sourceId === normalizedSource) {
      return true
    }
  }
  return false
}

function moduleIdMatchesFile(id: string, file: string) {
  const sidecarSource = parseSidecarSourceRequest(id)
  if (sidecarSource) {
    return normalizeSourceId(sidecarSource.sourceId) === file
  }
  const sidecar = parseSidecarModuleId(id)
  if (sidecar) {
    return normalizeSourceId(sidecar.sourceId) === file
  }
  const logicalEntry = parseLogicalEntryId(id)
  if (logicalEntry) {
    return normalizeSourceId(logicalEntry.sourceId) === file
  }
  return normalizeSourceId(id) === file
}

export function collectBuildStartIds(context: BuildGraphContext, file: string) {
  const ids = new Set<string>()
  if (typeof context.getModuleIds !== 'function') {
    return ids
  }
  for (const id of context.getModuleIds()) {
    if (moduleIdMatchesFile(id, file)) {
      ids.add(id)
    }
  }
  return ids
}

export function collectDevStartNodes(server: DevServerGraphHost, file: string) {
  const nodes = new Set<DevModuleNode>(server.moduleGraph.getModulesByFile(file) ?? [])
  for (const [id, node] of server.moduleGraph.idToModuleMap ?? []) {
    if (moduleIdMatchesFile(id, file)) {
      nodes.add(node)
    }
  }
  return nodes
}
