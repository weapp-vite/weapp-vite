import type { AnalyzeSubpackagesResult, DuplicateModuleEntry, ModuleSourceSummary, ModuleSourceType } from '../types'
import { createDuplicateModuleInsights } from 'weapp-vite/dashboard/analyze'
import { formatModuleIdentifier } from './format'

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

export function createDuplicateModules(options: {
  result: AnalyzeSubpackagesResult | null
  packageLabelMap: Map<string, string>
}): DuplicateModuleEntry[] {
  if (!options.result) {
    return []
  }

  const moduleUsages = new Map(options.result.modules.map(module => [module.id, module]))
  return createDuplicateModuleInsights(options.result).map((insight) => {
    const module = moduleUsages.get(insight.id)!
    return {
      ...insight,
      source: formatModuleIdentifier(insight.source),
      packages: module.packages.map(pkg => createDuplicateModulePackageEntry(options.packageLabelMap, pkg)),
    }
  })
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
