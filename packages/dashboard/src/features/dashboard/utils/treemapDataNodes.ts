import type { AnalyzeSubpackagesResult, AnalyzeTreemapFilterMode, ResolvedTheme, TreemapNode } from '../types'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
} from './treemap'
import {
  createBudgetRiskScore,
  createRiskNodeStyle,
  createShareRiskScore,
  getPackageLimitBytes,
  normalizeTreemapRiskScore,
} from './treemapRisk'

export interface TreemapFilterState {
  mode: AnalyzeTreemapFilterMode
  selectedPackageId: string | null
  growthFileKeys: Set<string>
  growthModuleIds: Set<string>
  duplicateModuleIds: Set<string>
}

function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  fileBytes: number,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapModuleNodeId(packageId, fileName, module.id)
  const value = Math.max(module.bytes ?? module.originalBytes ?? 1, 1)
  const usageCount = moduleUsageCount.get(module.id) ?? 1
  const riskScore = Math.max(
    createShareRiskScore(value, fileBytes),
    usageCount > 1 ? 0.62 : 0,
    module.sourceType === 'node_modules' ? 0.52 : 0,
  )
  const normalizedRiskScore = normalizeTreemapRiskScore(riskScore, module.id, module.source, fileName)
  return {
    id: nodeId,
    name: module.source,
    value,
    meta: {
      kind: 'module',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: module.source,
      sourceType: module.sourceType,
      bytes: module.bytes,
      originalBytes: module.originalBytes,
      packageCount: usageCount,
    },
    ...createRiskNodeStyle(normalizedRiskScore, theme),
  }
}

function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  packageBytes: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  const value = Math.max(file.size ?? 1, 1)
  const riskScore = normalizeTreemapRiskScore(createShareRiskScore(value, packageBytes), file.file, file.source, packageId, packageLabel)
  return {
    id: nodeId,
    name: file.source ?? fileName,
    value,
    meta: {
      kind: 'asset',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: file.source ?? fileName,
      bytes: file.size,
    },
    ...createRiskNodeStyle(riskScore, theme),
  }
}

function createFileTreemapNode(
  packageLabel: string,
  packageId: string,
  packageLabelMap: Map<string, string>,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  children: TreemapNode[],
  value = file.size ?? 1,
  packageBytes: number,
  packageRiskScore: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapFileNodeId(packageId, file.file)
  const fileValue = Math.max(value, 1)
  const riskScore = normalizeTreemapRiskScore(
    Math.max(createShareRiskScore(fileValue, packageBytes), packageRiskScore * 0.72),
    file.file,
    file.source,
    packageId,
    packageLabel,
  )
  return {
    id: nodeId,
    name: file.file,
    value: fileValue,
    meta: {
      kind: 'file',
      nodeId,
      packageId,
      packageLabel: packageLabelMap.get(packageId) ?? packageLabel,
      fileName: file.file,
      from: file.from,
      childCount: children.length,
      type: file.type,
      bytes: file.size,
    },
    ...createRiskNodeStyle(riskScore, theme),
    children: children.length > 0 ? children : undefined,
  }
}

function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
  riskScore: number,
  theme: ResolvedTheme,
): TreemapNode {
  const nodeId = createTreemapPackageNodeId(pkg.id)
  const normalizedRiskScore = normalizeTreemapRiskScore(riskScore, pkg.id, pkg.label)

  return {
    id: nodeId,
    name: pkg.label,
    value: Math.max(totalBytes, 1),
    meta: {
      kind: 'package',
      nodeId,
      packageId: pkg.id,
      packageLabel: pkg.label,
      packageType: pkg.type,
      fileCount: pkg.files.length,
      totalBytes,
    },
    ...createRiskNodeStyle(normalizedRiskScore, theme),
    children: fileNodes,
  }
}

function createFileKey(packageId: string, fileName: string) {
  return `${packageId}\u0000${fileName}`
}

function sumNodeValues(nodes: TreemapNode[]) {
  return nodes.reduce((sum, node) => sum + node.value, 0)
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
        ? file.size ?? sumNodeValues(moduleNodes)
        : sumNodeValues(moduleNodes)

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
      : sumNodeValues(fileNodes)

    return [createPackageTreemapNode(pkg, totalBytes, fileNodes, packageBudgetScores.get(pkg.id) ?? 0, options.theme)]
  })
}
