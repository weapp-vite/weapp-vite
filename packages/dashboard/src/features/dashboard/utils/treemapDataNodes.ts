import type { AnalyzeSubpackagesResult, AnalyzeTreemapFilterMode, ResolvedTheme, TreemapNode } from '../types'
import {
  createAssetTreemapNode,
  createFileTreemapNode,
  createModuleTreemapNode,
  createPackageTreemapNode,
  sumTreemapNodeValues,
} from './treemapNodeFactories'
import { createBudgetRiskScore, getPackageLimitBytes } from './treemapRisk'

export interface TreemapFilterState {
  mode: AnalyzeTreemapFilterMode
  selectedPackageId: string | null
  growthFileKeys: Set<string>
  growthModuleIds: Set<string>
  duplicateModuleIds: Set<string>
}

function createFileKey(packageId: string, fileName: string) {
  return `${packageId}\u0000${fileName}`
}

function shouldIncludeAsset(
  packageId: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  filter: TreemapFilterState,
) {
  if (filter.mode === 'all' || filter.mode === 'selected-package') {
    return Boolean(file.source)
  }
  if (filter.mode === 'growth') {
    return filter.growthFileKeys.has(createFileKey(packageId, file.file))
  }
  if (filter.mode === 'source') {
    return Boolean(file.source)
  }
  return false
}

function filterModules(
  filter: TreemapFilterState,
  modules: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>,
) {
  if (filter.mode === 'all' || filter.mode === 'selected-package') {
    return modules
  }
  if (filter.mode === 'growth') {
    return modules.filter(module => filter.growthModuleIds.has(module.id))
  }
  if (filter.mode === 'duplicates') {
    return modules.filter(module => filter.duplicateModuleIds.has(module.id))
  }
  if (filter.mode === 'node_modules') {
    return modules.filter(module => module.sourceType === 'node_modules')
  }
  return modules.filter(module => module.sourceType === 'src' || module.sourceType === 'workspace')
}

export function createDefaultTreemapFilterState(): TreemapFilterState {
  return {
    mode: 'all',
    selectedPackageId: null,
    growthFileKeys: new Set<string>(),
    growthModuleIds: new Set<string>(),
    duplicateModuleIds: new Set<string>(),
  }
}

export function createTreemapNodes(options: {
  result: AnalyzeSubpackagesResult
  packageLabelMap: Map<string, string>
  moduleUsageCount: Map<string, number>
  filter: TreemapFilterState
  theme: ResolvedTheme
}): TreemapNode[] {
  const packageBudgetScores = new Map(options.result.packages.map((pkg) => {
    const totalBytes = pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
    const limitBytes = getPackageLimitBytes(pkg, options.result.metadata?.budgets)
    return [pkg.id, createBudgetRiskScore(totalBytes, limitBytes, options.result.metadata?.budgets?.warningRatio)]
  }))
  const packageTotalBytes = new Map(options.result.packages.map(pkg => [
    pkg.id,
    pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
  ]))

  return options.result.packages.flatMap((pkg) => {
    if (options.filter.mode === 'selected-package' && (!options.filter.selectedPackageId || pkg.id !== options.filter.selectedPackageId)) {
      return []
    }

    const fileNodes = pkg.files.flatMap((file) => {
      const rawPackageBytes = packageTotalBytes.get(pkg.id) ?? 0
      const fileHasGrowth = options.filter.mode === 'growth' && options.filter.growthFileKeys.has(createFileKey(pkg.id, file.file))
      const fileBytes = Math.max(file.size ?? 1, 1)
      const moduleNodes = file.type === 'chunk'
        ? filterModules(options.filter, file.modules ?? []).map(module =>
            createModuleTreemapNode(pkg.id, pkg.label, file.file, fileBytes, options.moduleUsageCount, module, options.theme),
          )
        : shouldIncludeAsset(pkg.id, file, options.filter)
          ? [createAssetTreemapNode(pkg.id, pkg.label, file.file, file, rawPackageBytes, options.theme)]
          : []

      if (options.filter.mode !== 'all' && options.filter.mode !== 'selected-package' && moduleNodes.length === 0 && !fileHasGrowth) {
        return []
      }

      const filteredValue = options.filter.mode === 'all' || options.filter.mode === 'selected-package' || fileHasGrowth
        ? file.size ?? sumTreemapNodeValues(moduleNodes)
        : sumTreemapNodeValues(moduleNodes)

      return [createFileTreemapNode(
        pkg.label,
        pkg.id,
        options.packageLabelMap,
        file,
        moduleNodes,
        filteredValue,
        rawPackageBytes,
        packageBudgetScores.get(pkg.id) ?? 0,
        options.theme,
      )]
    })

    if (fileNodes.length === 0) {
      return []
    }

    const totalBytes = options.filter.mode === 'all' || options.filter.mode === 'selected-package'
      ? pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
      : sumTreemapNodeValues(fileNodes)

    return [createPackageTreemapNode(pkg, totalBytes, fileNodes, packageBudgetScores.get(pkg.id) ?? 0, options.theme)]
  })
}
