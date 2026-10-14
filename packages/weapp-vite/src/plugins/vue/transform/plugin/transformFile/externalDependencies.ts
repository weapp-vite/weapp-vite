import type { VueCompilationCache } from './types'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'

/** 外部编译输入或原生插槽分析依赖变化时撤销编译副本；仅样式依赖仍交给原有刷新路径。 */
export function invalidateExternalSfcCompilation(file: string, compilationCache: VueCompilationCache) {
  const normalizedFile = normalizeFsResolvedId(file)
  for (const cached of compilationCache.values()) {
    if (
      cached.result.meta?.sfcSrcCompilationDeps?.some(id => normalizeFsResolvedId(id) === normalizedFile)
      || cached.result.meta?.nativeSlotContextDeps?.some(id => normalizeFsResolvedId(id) === normalizedFile)
    ) {
      cached.source = undefined
      cached.styleIndependentSignature = undefined
    }
  }
}
