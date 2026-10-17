import type { ModuleGraphService } from '../../../../../moduleGraph/service'
import type { VueCompilationCache } from './types'
import { normalizeSourceId } from '../../../../../moduleGraph/traversal'
import { withRealpathScope } from '../../../../../utils/realpathScope'
import { getVueCompilationDependencies } from '../../componentResolutionDependencies'

/** 外部编译输入或原生插槽分析依赖变化时撤销编译副本；仅样式依赖仍交给原有刷新路径。 */
export function invalidateExternalSfcCompilation(file: string, compilationCache: VueCompilationCache, graph: ModuleGraphService) {
  return withRealpathScope(() => {
    const affected = graph.collectAffectedEntries(file, 'script')
    const dependencies = new Set<string>()
    for (const [owner, cached] of compilationCache) {
      if (!affected.has(normalizeSourceId(owner))) {
        continue
      }
      cached.source = undefined
      cached.styleIndependentSignature = undefined
      for (const dependency of getVueCompilationDependencies(cached.result)) {
        dependencies.add(dependency)
      }
    }
    return dependencies
  })
}
