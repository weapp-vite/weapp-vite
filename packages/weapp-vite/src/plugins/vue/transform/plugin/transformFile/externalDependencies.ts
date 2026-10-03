import type { VueCompilationCache } from './types'
import { normalizeFsResolvedId } from '../../../../../utils/resolvedId'

/** 外部模板或脚本变化时，失效仍引用该输入的编译副本；样式仍交给原有刷新路径。 */
export function invalidateExternalSfcCompilation(file: string, compilationCache: VueCompilationCache) {
  const normalizedFile = normalizeFsResolvedId(file)
  for (const cached of compilationCache.values()) {
    if (cached.result.meta?.sfcSrcCompilationDeps?.some(id => normalizeFsResolvedId(id) === normalizedFile)) {
      cached.source = undefined
      cached.styleIndependentSignature = undefined
    }
  }
}
