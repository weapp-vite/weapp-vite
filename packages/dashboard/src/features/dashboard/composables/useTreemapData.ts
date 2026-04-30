import type { Ref } from 'vue'
import type { AnalyzeSubpackagesResult, AnalyzeTreemapFilterMode, ResolvedTheme, TreemapNode, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import {
  createTreemapAssetNodeId,
  createTreemapFileNodeId,
  createTreemapModuleNodeId,
  createTreemapPackageNodeId,
  formatTreemapTooltip,
  PACKAGE_STYLES,
  TREEMAP_LEVELS,
} from '../utils/treemap'

function createModuleTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  moduleUsageCount: Map<string, number>,
  module: NonNullable<AnalyzeSubpackagesResult['packages'][number]['files'][number]['modules']>[number],
): TreemapNode {
  const nodeId = createTreemapModuleNodeId(packageId, fileName, module.id)
  return {
    id: nodeId,
    name: module.source,
    value: Math.max(module.bytes ?? module.originalBytes ?? 1, 1),
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
      packageCount: moduleUsageCount.get(module.id) ?? 1,
    },
  }
}

function createAssetTreemapNode(
  packageId: string,
  packageLabel: string,
  fileName: string,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
): TreemapNode {
  const nodeId = createTreemapAssetNodeId(packageId, fileName)
  return {
    id: nodeId,
    name: file.source ?? fileName,
    value: Math.max(file.size ?? 1, 1),
    meta: {
      kind: 'asset',
      nodeId,
      packageId,
      packageLabel,
      fileName,
      source: file.source ?? fileName,
      bytes: file.size,
    },
  }
}

function createFileTreemapNode(
  packageLabel: string,
  packageId: string,
  packageLabelMap: Map<string, string>,
  file: AnalyzeSubpackagesResult['packages'][number]['files'][number],
  children: TreemapNode[],
  value = file.size ?? 1,
): TreemapNode {
  const nodeId = createTreemapFileNodeId(packageId, file.file)
  return {
    id: nodeId,
    name: file.file,
    value: Math.max(value, 1),
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
    children: children.length > 0 ? children : undefined,
  }
}

function createPackageTreemapNode(
  pkg: AnalyzeSubpackagesResult['packages'][number],
  totalBytes: number,
  fileNodes: TreemapNode[],
): TreemapNode {
  const style = PACKAGE_STYLES[pkg.type]
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
    itemStyle: {
      color: style.fill,
      borderColor: style.border,
    },
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

    return result.packages.flatMap((pkg) => {
      if (filter.mode === 'selected-package' && (!filter.selectedPackageId || pkg.id !== filter.selectedPackageId)) {
        return []
      }

      const fileNodes = pkg.files.flatMap((file) => {
        const fileHasGrowth = filter.mode === 'growth' && filter.growthFileKeys.has(createFileKey(pkg.id, file.file))
        const moduleNodes = file.type === 'chunk'
          ? filterModules(filter, file.modules ?? []).map(module => createModuleTreemapNode(pkg.id, pkg.label, file.file, moduleUsageCount.value, module))
          : shouldIncludeAsset(pkg.id, file, filter)
            ? [createAssetTreemapNode(pkg.id, pkg.label, file.file, file)]
            : []

        if (filter.mode !== 'all' && filter.mode !== 'selected-package' && moduleNodes.length === 0 && !fileHasGrowth) {
          return []
        }

        const filteredValue = filter.mode === 'all' || filter.mode === 'selected-package' || fileHasGrowth
          ? file.size ?? sumNodeValues(moduleNodes)
          : sumNodeValues(moduleNodes)

        return [createFileTreemapNode(pkg.label, pkg.id, packageLabelMap.value, file, moduleNodes, filteredValue)]
      })

      if (fileNodes.length === 0) {
        return []
      }

      const totalBytes = filter.mode === 'all' || filter.mode === 'selected-package'
        ? pkg.files.reduce((sum, file) => sum + (file.size ?? 0), 0)
        : sumNodeValues(fileNodes)

      return [createPackageTreemapNode(pkg, totalBytes, fileNodes)]
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
          color: resolvedTheme.value === 'dark' ? '#f8fafc' : '#0f172a',
          formatter: '{b}',
        },
        upperLabel: {
          show: true,
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
        colorAlpha: [0.94, 0.72],
        colorSaturation: [0.4, 0.9],
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
