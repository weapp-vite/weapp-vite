import type { SourceAnalysisCache } from '../sourceReader'
import type { CompileVueFileOptions } from '../types'
import { createAnalysisSourceReader } from '../sourceReader'

export { normalizeSourceId } from '../sourceReader'

/** 原生插槽继续由宿主管理单文件缓存，递归分类只在当轮保存。 */
export type NativeSlotContextAnalysisCache = SourceAnalysisCache

export function createSourceReader(options: CompileVueFileOptions | undefined, dependencies: Set<string>) {
  return createAnalysisSourceReader({
    source: options?.sfcSrc,
    cache: options?.nativeSlotContextCache,
    tolerateErrors: true,
  }, dependencies)
}
