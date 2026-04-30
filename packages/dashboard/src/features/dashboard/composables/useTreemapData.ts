import type { Ref } from 'vue'
import type { AnalyzeBudgetConfig, AnalyzeSubpackagesResult, AnalyzeTreemapFilterMode, ResolvedTheme, TreemapNode, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
  formatTreemapTooltip,
  TREEMAP_LEVELS,
} from '../utils/treemap'

const defaultWarningRatio = 0.85
const healthPalette = {
  green: '#8fd3ad',
  yellow: '#ead486',
  red: '#eaa39b',
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  }
}

function mixColor(from: string, to: string, ratio: number) {
  const progress = clamp(ratio)
  const fromRgb = Object.values(parseHexColor(from))
  const toRgb = Object.values(parseHexColor(to))
  const mixed = fromRgb.map((channel, index) => Math.round(channel + (toRgb[index] - channel) * progress))
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

function createRiskColor(score: number) {
  const normalizedScore = clamp(score)
  if (normalizedScore <= 0.5) {
    return mixColor(healthPalette.green, healthPalette.yellow, normalizedScore / 0.5)
  }
  return mixColor(healthPalette.yellow, healthPalette.red, (normalizedScore - 0.5) / 0.5)
}

function createRiskBorderColor(score: number) {
  if (score >= 0.82) {
    return '#c6756f'
  }
  if (score >= 0.5) {
    return '#c3a24d'
  }
  return '#5caf82'
}

function getReadableTextColor(backgroundColor: string) {
  const { red, green, blue } = parseHexColor(backgroundColor)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.56 ? '#17231d' : '#f8fafc'
}

function createRiskLabelStyle(backgroundColor: string, emphasis = false) {
  const color = getReadableTextColor(backgroundColor)
  const isDarkText = color === '#17231d'
  const contrastStyle = emphasis
    ? {
        textBorderColor: isDarkText ? 'rgba(255, 255, 255, 0.72)' : 'rgba(15, 23, 42, 0.45)',
        textBorderWidth: 2,
      }
    : {
        backgroundColor: isDarkText ? 'rgba(255, 255, 255, 0.58)' : 'rgba(15, 23, 42, 0.46)',
        borderRadius: 3,
        padding: [1, 4],
        textBorderWidth: 0,
      }

  return {
    color,
    ellipsis: '…',
    fontSize: 12,
    fontWeight: emphasis ? 700 : 600,
    lineHeight: 16,
    minMargin: 4,
    overflow: 'truncate',
    ...contrastStyle,
  }
}

function createRiskNodeStyle(score: number) {
  const color = createRiskColor(score)

  return {
    itemStyle: {
      color,
      borderColor: createRiskBorderColor(score),
    },
    label: createRiskLabelStyle(color),
    upperLabel: createRiskLabelStyle(color, true),
  }
}

function getPackageLimitBytes(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  budgets: AnalyzeBudgetConfig | undefined,
) {
  if (!budgets) {
    return 0
  }
  if (pkg.type === 'main') {
    return budgets.mainBytes
  }
  if (pkg.type === 'subPackage') {
    return budgets.subPackageBytes
  }
  if (pkg.type === 'independent') {
    return budgets.independentBytes
  }
  return budgets.totalBytes
}

function createBudgetRiskScore(totalBytes: number, limitBytes: number, warningRatio = defaultWarningRatio) {
  if (limitBytes <= 0) {
    return 0
  }
  const ratio = totalBytes / limitBytes
  if (ratio >= 1) {
    return 1
  }
  if (ratio >= warningRatio) {
    return 0.58 + ((ratio - warningRatio) / Math.max(1 - warningRatio, 0.01)) * 0.32
  }
  return clamp((ratio / warningRatio) * 0.42, 0, 0.42)
}

function createShareRiskScore(bytes: number, parentBytes: number) {
  if (parentBytes <= 0) {
    return 0
  }
  const ratio = bytes / parentBytes
  if (ratio >= 0.72) {
    return 0.92
  }
  if (ratio >= 0.45) {
    return 0.64 + ((ratio - 0.45) / 0.27) * 0.22
  }
  return clamp(ratio / 0.45 * 0.46, 0, 0.46)
}

function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  fileBytes: number,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
): TreemapNode {
  const nodeId = createTreemapModuleNodeId(packageId, fileName, module.id)
  const value = Math.max(module.bytes ?? module.originalBytes ?? 1, 1)
  const usageCount = moduleUsageCount.get(module.id) ?? 1
  const riskScore = Math.max(
    createShareRiskScore(value, fileBytes),
    usageCount > 1 ? 0.62 : 0,
    module.sourceType === 'node_modules' ? 0.52 : 0,
  )
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
    ...createRiskNodeStyle(riskScore),
  }
}

function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  packageBytes: number,
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  const value = Math.max(file.size ?? 1, 1)
  const riskScore = createShareRiskScore(value, packageBytes)
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
    ...createRiskNodeStyle(riskScore),
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
): TreemapNode {
  const nodeId = createTreemapFileNodeId(packageId, file.file)
  const fileValue = Math.max(value, 1)
  const riskScore = Math.max(createShareRiskScore(fileValue, packageBytes), packageRiskScore * 0.72)
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
    ...createRiskNodeStyle(riskScore),
    children: children.length > 0 ? children : undefined,
  }
}

function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
  riskScore: number,
): TreemapNode {
  const nodeId = createTreemapPackageNodeId(pkg.id)

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
    ...createRiskNodeStyle(riskScore),
    children: fileNodes,
  }
}

interface TreemapFilterState {
  mode: AnalyzeTreemapFilterMode
  selectedPackageId: string | null
  growthFileKeys: Set<string>
  growthModuleIds: Set<string>
  duplicateModuleIds: Set<string>
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

export function useTreemapData(
  resultRef: Ref<AnalyzeSubpackagesResult | null>,
  resolvedTheme: Ref<ResolvedTheme>,
  filterRef?: Ref<TreemapFilterState>,
) {
  const packageLabelMap = computed(() =>
    new Map((resultRef.value?.packages ?? []).map(pkg => [pkg.id, pkg.label])),
  )

  const moduleUsageCount = computed(() =>
    new Map((resultRef.value?.modules ?? []).map(mod => [mod.id, mod.packages.length])),
  )

  const treemapNodes = computed<TreemapNode[]>(() => {
    const result = resultRef.value
    if (!result) {
      return []
    }

    const filter = filterRef?.value ?? {
      mode: 'all' as const,
      selectedPackageId: null,
      growthFileKeys: new Set<string>(),
      growthModuleIds: new Set<string>(),
      duplicateModuleIds: new Set<string>(),
    }
    const packageBudgetScores = new Map(result.packages.map((pkg) => {
      const totalBytes = pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
      const limitBytes = getPackageLimitBytes(pkg, result.metadata?.budgets)
      return [pkg.id, createBudgetRiskScore(totalBytes, limitBytes, result.metadata?.budgets?.warningRatio)]
    }))
    const packageTotalBytes = new Map(result.packages.map(pkg => [
      pkg.id,
      pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    ]))

    return result.packages.flatMap((pkg) => {
      if (filter.mode === 'selected-package' && (!filter.selectedPackageId || pkg.id !== filter.selectedPackageId)) {
        return []
      }

      const fileNodes = pkg.files.flatMap((file) => {
        const rawPackageBytes = packageTotalBytes.get(pkg.id) ?? 0
        const fileHasGrowth = filter.mode === 'growth' && filter.growthFileKeys.has(createFileKey(pkg.id, file.file))
        const fileBytes = Math.max(file.size ?? 1, 1)
        const moduleNodes = file.type === 'chunk'
          ? filterModules(filter, file.modules ?? []).map(module => createModuleTreemapNode(pkg.id, pkg.label, file.file, fileBytes, moduleUsageCount.value, module))
          : shouldIncludeAsset(pkg.id, file, filter)
            ? [createAssetTreemapNode(pkg.id, pkg.label, file.file, file, rawPackageBytes)]
            : []

        if (filter.mode !== 'all' && filter.mode !== 'selected-package' && moduleNodes.length === 0 && !fileHasGrowth) {
          return []
        }

        const filteredValue = filter.mode === 'all' || filter.mode === 'selected-package' || fileHasGrowth
          ? file.size ?? sumNodeValues(moduleNodes)
          : sumNodeValues(moduleNodes)

        return [createFileTreemapNode(
          pkg.label,
          pkg.id,
          packageLabelMap.value,
          file,
          moduleNodes,
          filteredValue,
          rawPackageBytes,
          packageBudgetScores.get(pkg.id) ?? 0,
        )]
      })

      if (fileNodes.length === 0) {
        return []
      }

      const totalBytes = filter.mode === 'all' || filter.mode === 'selected-package'
        ? pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
        : sumNodeValues(fileNodes)

      return [createPackageTreemapNode(pkg, totalBytes, fileNodes, packageBudgetScores.get(pkg.id) ?? 0)]
    })
  })

  const treemapOption = computed(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: { data?: { meta?: TreemapNodeMeta } }) => formatTreemapTooltip(params.data?.meta),
      borderColor: resolvedTheme.value === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(71, 85, 105, 0.14)',
      backgroundColor: resolvedTheme.value === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
      textStyle: {
        color: resolvedTheme.value === 'dark' ? '#e2e8f0' : '#0f172a',
      },
    },
    series: [
      {
        type: 'treemap',
        nodeClick: 'zoomToNode',
        roam: true,
        roamTrigger: 'global',
        zoomToNodeRatio: 0.72,
        breadcrumb: {
          show: false,
        },
        visibleMin: 1,
        label: {
          show: true,
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          borderRadius: 3,
          color: '#17231d',
          formatter: '{b}',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 16,
          minMargin: 4,
          overflow: 'truncate',
          padding: [1, 4],
          textBorderWidth: 0,
        },
        upperLabel: {
          show: true,
          color: '#17231d',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 16,
          overflow: 'truncate',
          textBorderColor: 'rgba(255, 255, 255, 0.72)',
          textBorderWidth: 2,
        },
        itemStyle: {
          borderColor: resolvedTheme.value === 'dark' ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
          borderWidth: 2,
          gapWidth: 2,
        },
        emphasis: {
          itemStyle: {
            borderColor: resolvedTheme.value === 'dark' ? '#f8fafc' : '#0f172a',
          },
        },
        levels: TREEMAP_LEVELS,
        data: treemapNodes.value,
      },
    ],
  }))

  return {
    treemapOption,
    treemapNodes,
  }
}
