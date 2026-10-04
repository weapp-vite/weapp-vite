import type { AnalyzeSubpackagesResult, ModuleSourceType } from '../../analyze/subpackages/types'
import type { DuplicateModuleInsight } from './types'
import { createModuleByteMap } from './moduleBytes'

function createDuplicateAdvice(sourceType: ModuleSourceType, hasIndependentPackage: boolean, estimatedSavingBytes: number) {
  if (hasIndependentPackage) {
    return estimatedSavingBytes > 0
      ? '含独立分包，先确认隔离要求，再评估是否抽公共入口。'
      : '含独立分包，重复可能来自隔离边界。'
  }
  if (sourceType === 'node_modules') {
    return '依赖被多个包带入，检查引用边界或考虑主包公共入口。'
  }
  if (sourceType === 'src' || sourceType === 'workspace') {
    return '共享源码跨包重复，优先抽公共模块或调整分包归属。'
  }
  if (sourceType === 'plugin') {
    return '插件生成内容跨包重复，检查插件产物输出策略。'
  }
  return '检查该模块是否需要在多个包内重复存在。'
}

/** 按原始模块 ID 统计跨包重复，节省量是估算值，不代表可安全移除的字节。 */
export function createDuplicateModuleInsights(result: Pick<AnalyzeSubpackagesResult, 'packages' | 'modules'>): DuplicateModuleInsight[] {
  const moduleBytes = createModuleByteMap(result)
  const packageTypes = new Map(result.packages.map(pkg => [pkg.id, pkg.type]))

  return result.modules
    .filter(module => module.packages.length > 1)
    .map((module) => {
      const bytes = moduleBytes.get(module.id) ?? 0
      const packages = module.packages.map(pkg => pkg.packageId)
      const estimatedSavingBytes = bytes * (packages.length - 1)
      const hasIndependentPackage = packages.some(id => packageTypes.get(id) === 'independent')
      return {
        id: module.id,
        source: module.source,
        sourceType: module.sourceType,
        packageCount: packages.length,
        bytes,
        estimatedSavingBytes,
        packages,
        hasIndependentPackage,
        advice: createDuplicateAdvice(module.sourceType, hasIndependentPackage, estimatedSavingBytes),
      }
    })
    .sort((a, b) =>
      b.estimatedSavingBytes - a.estimatedSavingBytes
      || b.packageCount - a.packageCount
      || b.bytes - a.bytes
      || a.source.localeCompare(b.source)
      || a.id.localeCompare(b.id),
    )
}
