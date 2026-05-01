import type { AnalyzeSubpackagesResult, DuplicateModuleEntry, ModuleSourceSummary, ModuleSourceType, PackageType } from '../types'

function createDuplicateModulePackageEntry(
  packageLabelMap: Map<string, string>,
  pkg: AnalyzeSubpackagesResult['modules'][number]['packages'][number],
): DuplicateModuleEntry['packages'][number] {
  return {
    packageId: pkg.packageId,
    packageLabel: packageLabelMap.get(pkg.packageId) ?? pkg.packageId,
    files: pkg.files,
  }
}

function classifyModuleSourceCategory(source: string, sourceType: ModuleSourceType) {
  if (source.includes('wevu') || source.includes('@weapp-vite/dashboard')) {
    return 'wevu / dashboard runtime'
  }
  if (sourceType === 'node_modules') {
    return '第三方依赖'
  }
  if (sourceType === 'plugin') {
    return '插件生成'
  }
  if (sourceType === 'workspace') {
    return '工作区包'
  }
  if (source.startsWith('pages/') || source.includes('/pages/')) {
    return '业务页面'
  }
  if (source.startsWith('components/') || source.includes('/components/')) {
    return '业务组件'
  }
  if (source.startsWith('shared/') || source.includes('/shared/') || source.includes('/utils/')) {
    return '业务共享'
  }
  return '业务源码'
}

function createModuleSourceSummary(sourceType: ModuleSourceType, sourceCategory: string): ModuleSourceSummary {
  return {
    sourceType,
    sourceCategory,
    count: 0,
    bytes: 0,
  }
}

function createDuplicateAdvice(
  sourceType: ModuleSourceType,
  packages: DuplicateModuleEntry['packages'],
  packageTypeMap: Map<string, PackageType>,
  estimatedSavingBytes: number,
) {
  const hasIndependentPackage = packages.some(pkg => packageTypeMap.get(pkg.packageId) === 'independent')
  if (hasIndependentPackage) {
    return estimatedSavingBytes > 0
      ? '含独立分包，先确认隔离要求，再评估公共入口。'
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

export function createDuplicateModules(options: {
  result: AnalyzeSubpackagesResult | null
  moduleInfoMap: Map<string, { bytes: number, originalBytes: number, sourceType: ModuleSourceType }>
  packageLabelMap: Map<string, string>
  packageTypeMap: Map<string, PackageType>
}): DuplicateModuleEntry[] {
  if (!options.result) {
    return []
  }

  return options.result.modules
    .filter(mod => mod.packages.length > 1)
    .map((mod) => {
      const info = options.moduleInfoMap.get(mod.id)
      const packages = mod.packages.map(pkg => createDuplicateModulePackageEntry(options.packageLabelMap, pkg))
      const bytes = info?.bytes ?? info?.originalBytes ?? 0
      const estimatedSavingBytes = bytes * Math.max(mod.packages.length - 1, 0)
      return {
        id: mod.id,
        source: mod.source,
        sourceType: mod.sourceType,
        packageCount: mod.packages.length,
        bytes,
        estimatedSavingBytes,
        advice: createDuplicateAdvice(mod.sourceType, packages, options.packageTypeMap, estimatedSavingBytes),
        packages,
      }
    })
    .sort((a, b) =>
      b.estimatedSavingBytes - a.estimatedSavingBytes
      || b.packageCount - a.packageCount
      || b.bytes - a.bytes
      || a.source.localeCompare(b.source),
    )
}

export function createModuleSourceSummaries(
  result: AnalyzeSubpackagesResult | null,
  moduleInfoMap: Map<string, { bytes: number, originalBytes: number, sourceType: ModuleSourceType }>,
): ModuleSourceSummary[] {
  const summaryMap = new Map<string, ModuleSourceSummary>()

  for (const mod of result?.modules ?? []) {
    const info = moduleInfoMap.get(mod.id)
    const sourceCategory = classifyModuleSourceCategory(mod.source, mod.sourceType)
    const entryKey = `${mod.sourceType}:${sourceCategory}`
    const entry = summaryMap.get(entryKey) ?? createModuleSourceSummary(mod.sourceType, sourceCategory)
    entry.count += 1
    entry.bytes += info?.bytes ?? info?.originalBytes ?? 0
    summaryMap.set(entryKey, entry)
  }

  return [...summaryMap.values()]
    .sort((a, b) => b.bytes - a.bytes || b.count - a.count || a.sourceCategory.localeCompare(b.sourceCategory))
}
