import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'

/** 解析器发现的中间桶文件和缺失目标归属于当前编译选项。 */
export const componentResolutionDependencies = new WeakMap<CompileVueFileOptions, Set<string>>()

/** 将宿主解析输入并入编译依赖，统一 transform 与 bundle 的失效和图登记。 */
export function applyComponentResolutionDependencies(result: VueTransformResult, options: CompileVueFileOptions) {
  const resolved = componentResolutionDependencies.get(options)
  if (resolved) {
    result.meta ??= {}
    result.meta.sfcSrcCompilationDeps = [...new Set([
      ...(result.meta.sfcSrcCompilationDeps ?? []),
      ...resolved,
    ])]
  }
  if (result.meta?.sfcSrcCompilationDeps) {
    result.meta.sfcSrcCompilationDeps = [...new Set(result.meta.sfcSrcCompilationDeps.map(id => normalizeFsResolvedId(id)))]
  }
  if (result.meta?.nativeSlotContextDeps) {
    result.meta.nativeSlotContextDeps = [...new Set(result.meta.nativeSlotContextDeps.map(id => normalizeFsResolvedId(id)))]
  }
}
