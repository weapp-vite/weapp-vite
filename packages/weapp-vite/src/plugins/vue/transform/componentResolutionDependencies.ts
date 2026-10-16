import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'

type HostCompilationMeta = NonNullable<VueTransformResult['meta']> & {
  componentResolutionDeps?: string[]
}

/** 解析器发现的中间桶文件和缺失目标归属于当前编译选项。 */
export const componentResolutionDependencies = new WeakMap<CompileVueFileOptions, Set<string>>()

/** 宿主解析输入独立保存，JSON-only 刷新可以替换编译器自己的外部块依赖。 */
export function applyComponentResolutionDependencies(result: VueTransformResult, options: CompileVueFileOptions) {
  const resolved = componentResolutionDependencies.get(options)
  if (resolved) {
    const meta: HostCompilationMeta = result.meta ??= {}
    meta.componentResolutionDeps = [...resolved]
  }
}

/** 在宿主消费边界合并依赖，各分析器只维护自己拥有的字段。 */
export function getVueCompilationDependencies(result: VueTransformResult): string[] {
  const meta = result.meta as HostCompilationMeta | undefined
  return [...new Set([
    ...(meta?.sfcSrcCompilationDeps ?? []),
    ...(meta?.nativeSlotContextDeps ?? []),
    ...(meta?.componentResolutionDeps ?? []),
  ].map(id => normalizeFsResolvedId(id)))]
}
