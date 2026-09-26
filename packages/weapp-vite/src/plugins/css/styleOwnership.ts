import { isCSSRequest } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { getCssRealPath, parseRequest } from '../utils/parse'

interface StyleModuleInfo {
  importedIds: string[]
  meta?: Record<string, unknown>
}

/** 在样式模块上保存实际消费的源文件，避免把仅用于失效的图边当作产物所有权。 */
export function createStyleSourceMeta(sources: Iterable<string>) {
  return { weappViteStyleSources: Array.from(sources, source => normalizeFsResolvedId(source)) }
}

/** 从当前 owner 的真实模块导入图收集 CSS 来源；不读取历史构建缓存。 */
export function collectRenderedStyleSources(
  pluginCtx: { getModuleInfo?: (id: string) => StyleModuleInfo | null },
  owner: string,
) {
  const sources = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visited.has(id)) {
      return
    }
    visited.add(id)
    const query = new URLSearchParams(id.split('?')[1] ?? '')
    if (query.has('raw') || query.has('url')) {
      return
    }
    const info = pluginCtx.getModuleInfo?.(id)
    if (!info) {
      return
    }
    if (isCSSRequest(id)) {
      sources.add(normalizeFsResolvedId(getCssRealPath(parseRequest(id))))
      const styleSources = info.meta?.weappViteStyleSources
      if (Array.isArray(styleSources)) {
        for (const source of styleSources) {
          if (typeof source === 'string') {
            sources.add(normalizeFsResolvedId(source))
          }
        }
      }
    }
    for (const imported of info.importedIds) {
      visit(imported)
    }
  }
  visit(owner)
  return sources
}
