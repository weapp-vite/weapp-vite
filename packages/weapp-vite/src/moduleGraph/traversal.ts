import type { BuildGraphContext, DevModuleNode, DevServerGraphHost } from './types'
import { readlinkSync } from 'node:fs'
import path from 'node:path'
import { resolveRealpath, withRealpathScope } from '../utils/realpathScope'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../utils/resolvedId'
import { parseLogicalEntryId, parseSidecarModuleId, parseSidecarSourceRequest } from './protocol'

export function normalizeSourceId(id: string) {
  const normalized = normalizeFsResolvedId(id)
  if (isSkippableResolvedId(normalized)) {
    return normalized
  }
  try {
    return normalizeFsResolvedId(resolveRealpath(normalized))
  }
  catch {
    if (!path.isAbsolute(normalized) && path.win32.isAbsolute(normalized)) {
      return normalized
    }
    // 叶子符号链接在目标删除后仍保留目标路径；不缓存身份，重建后继续观察新目标。
    let candidate = normalized
    let links: Set<string> | undefined
    for (;;) {
      let target: string
      try {
        target = readlinkSync(candidate)
      }
      catch {
        break
      }
      links ??= new Set<string>()
      if (links.has(candidate)) {
        return normalized
      }
      links.add(candidate)
      candidate = path.resolve(path.dirname(candidate), target)
    }
    try {
      return normalizeFsResolvedId(path.join(resolveRealpath(path.dirname(candidate)), path.basename(candidate)))
    }
    catch {
      return normalizeFsResolvedId(candidate)
    }
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

/** 存在性查询首次命中即返回，不为布尔结果收集全部模块。 */
export function hasBuildModule(context: BuildGraphContext, file: string) {
  return withRealpathScope(() => {
    for (const id of context.getModuleIds?.() ?? []) {
      if (moduleIdMatchesFile(id, file)) {
        return true
      }
    }
    return false
  })
}

/** 优先查询当前文件索引；未命中时仍按完整协议与真实路径查找别名。 */
export function hasDevModule(server: DevServerGraphHost, file: string) {
  return withRealpathScope(() => {
    if (server.moduleGraph.getModulesByFile(file)?.size) {
      return true
    }
    for (const [id] of server.moduleGraph.idToModuleMap ?? []) {
      if (moduleIdMatchesFile(id, file)) {
        return true
      }
    }
    return false
  })
}

export function collectBuildStartIds(context: BuildGraphContext, file: string) {
  return withRealpathScope(() => {
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
  })
}

export function collectDevStartNodes(server: DevServerGraphHost, file: string) {
  return withRealpathScope(() => {
    const nodes = new Set<DevModuleNode>(server.moduleGraph.getModulesByFile(file) ?? [])
    for (const [id, node] of server.moduleGraph.idToModuleMap ?? []) {
      if (moduleIdMatchesFile(id, file)) {
        nodes.add(node)
      }
    }
    return nodes
  })
}
